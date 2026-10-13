import { logger } from "firebase-functions/v2";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Task } from "@blotch/model";
import { z } from "zod";
import { migrateTaskAsUser } from "../../callable/migrate-task";
import { getOrderAtEnd, getOrderAtIndex } from "../../util/ordering";
import {
  LIST_FULL_MESSAGE,
  MAX_TASKS_PER_LIST,
  ToolError,
  boardDoc,
  defaultList,
  isArchivalList,
  loadBoardContext,
  loadListTasks,
  requireBoard,
  requireTask,
  resolveLabels,
  resolveList,
  resolveMembers,
  taskDoc,
  type BoardContext,
} from "../board-data";
import {
  boardUrl,
  formatContext,
  parseDateArg,
  summarizeTask,
  textToHtml,
} from "../format";
import {
  addHistory,
  assigneeEntries,
  fieldChangeEntries,
  labelEntries,
  type FieldChanges,
} from "../history";
import {
  DESTRUCTIVE,
  WRITE,
  boardIdField,
  colorField,
  dateField,
  labelRefsField,
  memberRefsField,
  runTool,
  taskIdField,
  type ToolContext,
} from "./shared";

const titleField = z.string().trim().min(1).max(500);
const descriptionField = z
  .string()
  .max(20_000)
  .describe(
    "Plain text or light Markdown: lines, '-' bullets, '1.' numbered items, **bold**, *italic*, `code`, [links](https://…).",
  );
const listRefField = z.string().min(1).describe("List (column) name or id.");
const indexField = z
  .number()
  .int()
  .min(0)
  .describe("0-based position in the list; 0 is the top. Omit to place at the bottom.");

const CALENDAR_NOTE =
  "This task syncs to Google Calendar. The calendar event isn't updated by this change; it catches up the next time someone edits the task in Board.";

function summary(board: BoardContext, task: Task, now: number) {
  const fmt = formatContext(board.lists, board.labels, board.members, now);
  return summarizeTask(task, fmt);
}

/** Active tasks a list already holds, ignoring `exceptTaskId`. */
function activeCount(tasks: Task[], exceptTaskId?: string): number {
  return tasks.filter((task) => !task.archive && task.id !== exceptTaskId).length;
}

export function registerTaskTools(server: McpServer, ctx: ToolContext): void {
  const { db, uid } = ctx;

  server.registerTool(
    "create_task",
    {
      title: "Create a task",
      description:
        "Create a task (ticket) on a board. It goes to the bottom of the given list, or the board's first list. Non-archival lists hold at most 20 active tasks.",
      inputSchema: z.object({
        boardId: boardIdField,
        title: titleField.describe("Task title."),
        list: listRefField.optional().describe("List name or id. Defaults to the first list."),
        description: descriptionField.optional(),
        assignees: memberRefsField.optional(),
        labels: labelRefsField.optional(),
        startDate: dateField.optional(),
        dueDate: dateField.optional().describe("Deadline, as YYYY-MM-DD or an ISO 8601 date-time."),
        color: colorField.optional().describe("Card color, e.g. #3B82F6."),
      }),
      annotations: WRITE,
    },
    (args) =>
      runTool("create_task", async () => {
        const board = await loadBoardContext(db, uid, args.boardId);
        const list = args.list ? resolveList(board.lists, args.list) : defaultList(board);
        const archival = isArchivalList(board.board, list.id);
        const listTasks = await loadListTasks(db, args.boardId, list.id);
        if (!archival && activeCount(listTasks) >= MAX_TASKS_PER_LIST) {
          throw new ToolError(LIST_FULL_MESSAGE(list.title));
        }
        const assignees = resolveMembers(board.members, args.assignees ?? [], uid);
        const labels = resolveLabels(board.labels, args.labels ?? []);
        const startDate = args.startDate ? parseDateArg(args.startDate, "startDate") : null;
        const dueDate = args.dueDate ? parseDateArg(args.dueDate, "dueDate") : null;

        const ref = boardDoc(db, args.boardId).collection("tasks").doc();
        const fields = {
          listId: list.id,
          title: args.title,
          description: args.description ? textToHtml(args.description) : "",
          order: getOrderAtEnd(listTasks),
          startDate: startDate ? Timestamp.fromDate(startDate) : null,
          dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
          calendarEventId: null,
          calendarSyncEnabled: false,
          // Every task carries `archive` so the board's `archive == false`
          // query finds it; one created straight into an archive is archived.
          archive: archival,
          createdBy: uid,
          assignedTo: [...new Set(assignees.map((member) => member.id))],
          labelIds: [...new Set(labels.map((label) => label.id))],
          color: args.color?.toUpperCase() ?? null,
          attachments: [],
          commentCount: 0,
        };
        await ref.set({
          ...fields,
          archivedAt: archival ? FieldValue.serverTimestamp() : null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        const created = { id: ref.id, ...fields } as unknown as Task;
        return {
          task: summary(board, created, ctx.now()),
          boardId: args.boardId,
          url: boardUrl(ctx.appUrl, args.boardId),
        };
      }),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update a task",
      description:
        "Change a task's title, description, start date, due date (deadline) or card color. Pass null to clear a date or the color. Use assign_task, label_task and move_task for assignees, labels and lists.",
      inputSchema: z.object({
        boardId: boardIdField,
        taskId: taskIdField,
        title: titleField.optional().describe("New title."),
        description: descriptionField
          .optional()
          .describe("New description; replaces the old one. Plain text or light Markdown."),
        startDate: dateField.nullable().optional(),
        dueDate: dateField.nullable().optional().describe("New deadline, or null to clear it."),
        color: colorField.nullable().optional(),
      }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    (args) =>
      runTool("update_task", async () => {
        const board = await loadBoardContext(db, uid, args.boardId);
        const task = await requireTask(db, args.boardId, args.taskId);

        const changes: FieldChanges = {};
        const payload: Record<string, unknown> = {};
        if (args.title !== undefined) payload.title = changes.title = args.title;
        if (args.description !== undefined) {
          payload.description = changes.description = textToHtml(args.description);
        }
        for (const field of ["startDate", "dueDate"] as const) {
          const value = args[field];
          if (value === undefined) continue;
          const date = value === null ? null : parseDateArg(value, field);
          changes[field] = date;
          payload[field] = date ? Timestamp.fromDate(date) : null;
        }
        if (args.color !== undefined) {
          payload.color = changes.color = args.color?.toUpperCase() ?? null;
        }
        if (Object.keys(payload).length === 0) {
          throw new ToolError(
            "Nothing to update. Pass title, description, startDate, dueDate or color.",
          );
        }

        const batch = db.batch();
        batch.update(taskDoc(db, args.boardId, args.taskId), {
          ...payload,
          updatedAt: FieldValue.serverTimestamp(),
        });
        addHistory(db, batch, args.boardId, args.taskId, fieldChangeEntries(task, changes, uid));
        await batch.commit();

        const calendarFieldChanged =
          payload.title !== undefined ||
          payload.description !== undefined ||
          payload.dueDate !== undefined;
        return {
          task: summary(board, { ...task, ...payload } as Task, ctx.now()),
          ...(task.calendarSyncEnabled && calendarFieldChanged ? { note: CALENDAR_NOTE } : {}),
        };
      }),
  );

  server.registerTool(
    "assign_task",
    {
      title: "Assign people",
      description:
        "Add or remove assignees on a task. Only members of the task's board can be assigned (see get_board for members).",
      inputSchema: z.object({
        boardId: boardIdField,
        taskId: taskIdField,
        add: memberRefsField.optional().describe("People to assign (name, email, id or \"me\")."),
        remove: memberRefsField.optional().describe("People to unassign."),
      }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    (args) =>
      runTool("assign_task", async () => {
        if (!args.add?.length && !args.remove?.length) {
          throw new ToolError("Pass people to add and/or remove.");
        }
        const board = await loadBoardContext(db, uid, args.boardId);
        const task = await requireTask(db, args.boardId, args.taskId);
        const current = task.assignedTo ?? [];

        const toAdd = resolveMembers(board.members, args.add ?? [], uid).filter(
          (member, index, all) =>
            !current.includes(member.id) &&
            all.findIndex((other) => other.id === member.id) === index,
        );
        // A former member can still be unassigned by id.
        const removeIds = new Set(
          (args.remove ?? []).map((ref) =>
            current.includes(ref) ? ref : resolveMembers(board.members, [ref], uid)[0]!.id,
          ),
        );
        const removed = board.members.filter(
          (member) => removeIds.has(member.id) && current.includes(member.id),
        );
        const assignedTo = [
          ...current.filter((id) => !removeIds.has(id)),
          ...toAdd.map((member) => member.id),
        ];

        if (assignedTo.length !== current.length || toAdd.length > 0) {
          const batch = db.batch();
          batch.update(taskDoc(db, args.boardId, args.taskId), {
            assignedTo,
            updatedAt: FieldValue.serverTimestamp(),
          });
          addHistory(db, batch, args.boardId, args.taskId, assigneeEntries(toAdd, removed, uid));
          await batch.commit();
        }
        return { task: summary(board, { ...task, assignedTo }, ctx.now()) };
      }),
  );

  server.registerTool(
    "label_task",
    {
      title: "Label a task",
      description:
        "Add or remove labels on a task. Labels belong to the board; use create_label to make a new one.",
      inputSchema: z.object({
        boardId: boardIdField,
        taskId: taskIdField,
        add: labelRefsField.optional().describe("Labels to add."),
        remove: labelRefsField.optional().describe("Labels to remove."),
      }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    (args) =>
      runTool("label_task", async () => {
        if (!args.add?.length && !args.remove?.length) {
          throw new ToolError("Pass labels to add and/or remove.");
        }
        const board = await loadBoardContext(db, uid, args.boardId);
        const task = await requireTask(db, args.boardId, args.taskId);
        const current = task.labelIds ?? [];

        const added = resolveLabels(board.labels, args.add ?? []).filter(
          (label, index, all) =>
            !current.includes(label.id) && all.findIndex((l) => l.id === label.id) === index,
        );
        const removed = resolveLabels(board.labels, args.remove ?? []).filter((label) =>
          current.includes(label.id),
        );
        const removedIds = new Set(removed.map((label) => label.id));
        const labelIds = [
          ...current.filter((id) => !removedIds.has(id)),
          ...added.map((label) => label.id),
        ];

        if (added.length > 0 || removed.length > 0) {
          const batch = db.batch();
          batch.update(taskDoc(db, args.boardId, args.taskId), {
            labelIds,
            updatedAt: FieldValue.serverTimestamp(),
          });
          addHistory(db, batch, args.boardId, args.taskId, labelEntries(added, removed, uid));
          await batch.commit();
        }
        return { task: summary(board, { ...task, labelIds }, ctx.now()) };
      }),
  );

  server.registerTool(
    "move_task",
    {
      title: "Move a task",
      description:
        "Move a task to another list (column) on the same board, or reorder it within its list. Moving into an archival list archives the task; moving out restores it. Non-archival lists hold at most 20 active tasks.",
      inputSchema: z.object({
        boardId: boardIdField,
        taskId: taskIdField,
        list: listRefField.describe("Destination list name or id. Use the current list to reorder."),
        index: indexField.optional(),
      }),
      annotations: WRITE,
    },
    (args) =>
      runTool("move_task", async () => {
        const board = await loadBoardContext(db, uid, args.boardId);
        const task = await requireTask(db, args.boardId, args.taskId);
        const dest = resolveList(board.lists, args.list);
        const listChanged = task.listId !== dest.id;
        if (!listChanged && args.index === undefined) {
          return {
            task: summary(board, task, ctx.now()),
            note: `The task is already in "${dest.title}". Pass index to reorder it.`,
          };
        }

        const destArchival = isArchivalList(board.board, dest.id);
        const siblings = (await loadListTasks(db, args.boardId, dest.id)).filter(
          (other) => other.id !== task.id,
        );
        if (listChanged && !destArchival && activeCount(siblings) >= MAX_TASKS_PER_LIST) {
          throw new ToolError(LIST_FULL_MESSAGE(dest.title));
        }

        // Same rule as the board's drag and drop: into an archive archives,
        // back out restores; otherwise the flag is left alone.
        const wasArchived = !!task.archive;
        const archive =
          destArchival && !wasArchived ? true : !destArchival && wasArchived ? false : undefined;
        const order =
          args.index === undefined
            ? getOrderAtEnd(siblings)
            : getOrderAtIndex(siblings, args.index);

        const batch = db.batch();
        batch.update(taskDoc(db, args.boardId, args.taskId), {
          listId: dest.id,
          order,
          ...(archive === undefined
            ? {}
            : { archive, archivedAt: archive ? FieldValue.serverTimestamp() : null }),
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (listChanged) {
          const from = board.lists.find((list) => list.id === task.listId);
          addHistory(db, batch, args.boardId, args.taskId, [
            {
              action: archive === true ? "archived" : archive === false ? "unarchived" : "moved",
              userId: uid,
              metadata: { fromListName: from?.title ?? "", toListName: dest.title },
            },
          ]);
        }
        await batch.commit();

        return {
          task: summary(
            board,
            { ...task, listId: dest.id, order, archive: archive ?? wasArchived },
            ctx.now(),
          ),
        };
      }),
  );

  server.registerTool(
    "move_task_to_board",
    {
      title: "Move a task to another board",
      description:
        "Move a task, with its comments and history, to a list on a different board. The task gets a new id on the new board, and its labels are dropped because labels belong to each board. You must be a member of both boards.",
      inputSchema: z.object({
        boardId: boardIdField.describe("The board the task is on now."),
        taskId: taskIdField,
        targetBoardId: z.string().min(1).describe("The board to move the task to."),
        targetList: listRefField
          .optional()
          .describe("List on the target board. Defaults to its first list."),
      }),
      annotations: WRITE,
    },
    (args) =>
      runTool("move_task_to_board", async () => {
        if (args.boardId === args.targetBoardId) {
          throw new ToolError("The task is already on that board; use move_task instead.");
        }
        await requireBoard(db, uid, args.boardId);
        const target = await loadBoardContext(db, uid, args.targetBoardId);
        const list = args.targetList
          ? resolveList(target.lists, args.targetList)
          : defaultList(target);
        if (!isArchivalList(target.board, list.id)) {
          const listTasks = await loadListTasks(db, args.targetBoardId, list.id);
          if (activeCount(listTasks) >= MAX_TASKS_PER_LIST) {
            throw new ToolError(LIST_FULL_MESSAGE(list.title));
          }
        }

        const { newTaskId } = await migrateTaskAsUser(db, uid, {
          sourceBoardId: args.boardId,
          taskId: args.taskId,
          targetBoardId: args.targetBoardId,
          targetListId: list.id,
        });
        return {
          newTaskId,
          boardId: args.targetBoardId,
          board: target.board.title,
          list: list.title,
          url: boardUrl(ctx.appUrl, args.targetBoardId),
        };
      }),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete a task",
      description:
        "Permanently delete a task with its comments, history and attachments. This can't be undone; to keep a record, move it to an archival list instead.",
      inputSchema: z.object({ boardId: boardIdField, taskId: taskIdField }),
      annotations: DESTRUCTIVE,
    },
    (args) =>
      runTool("delete_task", async () => {
        await requireBoard(db, uid, args.boardId);
        const task = await requireTask(db, args.boardId, args.taskId);
        const paths = (task.attachments ?? []).map((attachment) => attachment.storagePath);
        if (paths.length > 0) {
          await ctx.deleteStoragePaths(paths).catch((error: unknown) => {
            logger.warn("Failed to delete task attachments", {
              boardId: args.boardId,
              taskId: args.taskId,
              error: String(error),
            });
          });
        }
        // recursiveDelete also clears the comments and history subcollections.
        await db.recursiveDelete(taskDoc(db, args.boardId, args.taskId));
        return { deleted: { id: task.id, title: task.title } };
      }),
  );
}
