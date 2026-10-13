import type { McpServer } from "@modelcontextprotocol/server";
import type { Board, Comment, HistoryEntry, Task, User } from "@blotch/model";
import { z } from "zod";
import { compareOrder } from "../../util/ordering";
import {
  MAX_TASKS_PER_LIST,
  ToolError,
  findLabel,
  findList,
  findMember,
  isArchivalList,
  listAccessibleBoards,
  loadActiveTasks,
  loadArchivedTasks,
  loadBoardContext,
  loadBoardParts,
  loadSprints,
  requireBoard,
  requireTask,
  taskDoc,
  type BoardContext,
} from "../board-data";
import {
  boardUrl,
  describeHistory,
  formatComment,
  formatContext,
  htmlToText,
  isOverdue,
  labelName,
  memberRef,
  parseDateArg,
  summarizeTask,
  toIso,
  type TaskSummary,
} from "../format";
import {
  READ_ONLY,
  boardIdField,
  dateField,
  runTool,
  taskIdField,
  type ToolContext,
} from "./shared";

const HISTORY_LIMIT = 50;
const SEARCH_LIMIT_DEFAULT = 50;

function role(board: Board, uid: string): "owner" | "collaborator" {
  return board.ownerId === uid ? "owner" : "collaborator";
}

/** Due date ascending with undated last, then title — "what's next" order. */
function byDueDate(a: Task, b: Task): number {
  const due = (task: Task) => task.dueDate?.toMillis() ?? Number.POSITIVE_INFINITY;
  return due(a) - due(b) || a.title.localeCompare(b.title);
}

async function boardsInScope(
  ctx: ToolContext,
  boardId: string | undefined,
): Promise<Board[]> {
  return boardId
    ? [await requireBoard(ctx.db, ctx.uid, boardId)]
    : listAccessibleBoards(ctx.db, ctx.uid);
}

export function registerReadTools(server: McpServer, ctx: ToolContext): void {
  const { db, uid, appUrl } = ctx;

  server.registerTool(
    "get_current_user",
    {
      title: "Who am I",
      description:
        "Get the signed-in Board user's id, name and email. Tasks are assigned to users by these ids.",
      annotations: READ_ONLY,
    },
    () =>
      runTool("get_current_user", async () => {
        const user = (await db.collection("users").doc(uid).get()).data() as
          | Partial<User>
          | undefined;
        return {
          id: uid,
          name: user?.displayName || user?.email || "Unknown user",
          email: user?.email ?? "",
        };
      }),
  );

  server.registerTool(
    "list_boards",
    {
      title: "List boards",
      description:
        "List every board the user owns or collaborates on, with the sidebar folder each sits in. Start here to find board ids.",
      annotations: READ_ONLY,
    },
    () =>
      runTool("list_boards", async () => {
        const [boards, preferencesSnap] = await Promise.all([
          listAccessibleBoards(db, uid),
          db.collection("users").doc(uid).collection("preferences").doc("boardOrder").get(),
        ]);
        const preferences = (preferencesSnap.data() ?? {}) as {
          folders?: Record<string, { name?: string }>;
          boardFolders?: Record<string, string>;
        };
        return {
          boards: boards.map((board) => {
            const folderId = preferences.boardFolders?.[board.id];
            const folder = folderId ? preferences.folders?.[folderId]?.name : undefined;
            return {
              id: board.id,
              title: board.title,
              role: role(board, uid),
              ...(folder ? { folder } : {}),
              members: 1 + (board.collaborators ?? []).length,
              url: boardUrl(appUrl, board.id),
            };
          }),
        };
      }),
  );

  server.registerTool(
    "get_board",
    {
      title: "View a board",
      description:
        "Show a board the way the team sees it: its lists (columns) in order with their active tasks, plus members, labels and sprints. Archived tasks are left out (use search_tasks with includeArchived). A list marked `archival` archives tasks moved into it; other lists hold at most 20 active tasks.",
      inputSchema: z.object({
        boardId: boardIdField,
        includeTasks: z
          .boolean()
          .optional()
          .describe("Include each list's tasks (default true). Set false for just the structure."),
      }),
      annotations: READ_ONLY,
    },
    ({ boardId, includeTasks = true }) =>
      runTool("get_board", async () => {
        const board = await loadBoardContext(db, uid, boardId);
        const [tasks, sprints] = await Promise.all([
          loadActiveTasks(db, boardId),
          loadSprints(db, boardId),
        ]);
        const now = ctx.now();
        const fmt = formatContext(board.lists, board.labels, board.members, now);
        return {
          id: board.board.id,
          title: board.board.title,
          url: boardUrl(appUrl, boardId),
          role: role(board.board, uid),
          lists: board.lists.map((list) => {
            const listTasks = tasks
              .filter((task) => task.listId === list.id)
              .sort((a, b) => compareOrder(a.order, b.order));
            const archival = isArchivalList(board.board, list.id);
            return {
              id: list.id,
              title: list.title,
              ...(archival ? { archival: true } : {}),
              activeTasks: listTasks.length,
              ...(!archival && listTasks.length >= MAX_TASKS_PER_LIST ? { full: true } : {}),
              ...(includeTasks
                ? {
                    tasks: listTasks.map((task) =>
                      summarizeTask(task, fmt, { includeList: false }),
                    ),
                  }
                : {}),
            };
          }),
          members: board.members,
          labels: board.labels.map((label) => ({
            id: label.id,
            name: label.name,
            ...(label.emoji ? { emoji: label.emoji } : {}),
            color: label.color,
          })),
          sprints: sprints.map((sprint) => {
            const start = sprint.startDate.toMillis();
            const end = sprint.endDate.toMillis();
            return {
              id: sprint.id,
              name: sprint.name,
              startDate: toIso(sprint.startDate),
              endDate: toIso(sprint.endDate),
              ...(start <= now && now <= end ? { current: true } : {}),
            };
          }),
        };
      }),
  );

  server.registerTool(
    "list_my_tasks",
    {
      title: "My tasks",
      description:
        "List the active (non-archived) tasks assigned to the signed-in user across all their boards, or one board. Sorted by due date, undated last; overdue tasks are flagged.",
      inputSchema: z.object({
        boardId: boardIdField.optional().describe("Only this board. Omit for all boards."),
      }),
      annotations: READ_ONLY,
    },
    ({ boardId }) =>
      runTool("list_my_tasks", async () => {
        const boards = await boardsInScope(ctx, boardId);
        const now = ctx.now();
        const perBoard = await Promise.all(
          boards.map(async (board) => {
            const [parts, tasks] = await Promise.all([
              loadBoardParts(db, board),
              loadActiveTasks(db, board.id),
            ]);
            const fmt = formatContext(parts.lists, parts.labels, parts.members, now);
            return tasks
              .filter((task) => task.assignedTo?.includes(uid))
              .map((task) => ({ task, fmt, board }));
          }),
        );
        const tasks = perBoard
          .flat()
          .sort((a, b) => byDueDate(a.task, b.task))
          .map(({ task, fmt, board }) =>
            summarizeTask(task, fmt, { board: { id: board.id, title: board.title } }),
          );
        return { count: tasks.length, tasks };
      }),
  );

  server.registerTool(
    "search_tasks",
    {
      title: "Search tasks",
      description:
        "Find tasks across all boards (or one) by text, assignee, list, label or due date. Use this for team views such as \"what is Sam working on\" or \"everything overdue\". Filters combine with AND. Archived tasks are excluded unless includeArchived is true.",
      inputSchema: z.object({
        boardId: boardIdField.optional().describe("Only this board. Omit for all boards."),
        text: z
          .string()
          .optional()
          .describe("Case-insensitive text to look for in titles and descriptions."),
        assignee: z
          .string()
          .optional()
          .describe(
            'A member\'s name, email or id; "me" for the signed-in user; "unassigned" for tasks with nobody assigned.',
          ),
        list: z.string().optional().describe("List (column) name or id, e.g. \"In Progress\"."),
        label: z.string().optional().describe("Label name or id."),
        dueBefore: dateField.optional().describe("Only tasks due before this date."),
        dueAfter: dateField.optional().describe("Only tasks due after this date."),
        overdue: z.boolean().optional().describe("true: only overdue tasks."),
        includeArchived: z.boolean().optional().describe("Also search archived tasks."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe(`Maximum results (default ${SEARCH_LIMIT_DEFAULT}).`),
      }),
      annotations: READ_ONLY,
    },
    (args) =>
      runTool("search_tasks", async () => {
        const boards = await boardsInScope(ctx, args.boardId);
        const now = ctx.now();
        const dueBefore = args.dueBefore
          ? parseDateArg(args.dueBefore, "dueBefore").getTime()
          : undefined;
        const dueAfter = args.dueAfter
          ? parseDateArg(args.dueAfter, "dueAfter").getTime()
          : undefined;
        const text = args.text?.trim().toLowerCase();
        const unassigned = args.assignee?.trim().toLowerCase() === "unassigned";
        const explicitBoard = args.boardId !== undefined;
        const resolved = { assignee: false, list: false, label: false };

        const perBoard = await Promise.all(
          boards.map(async (board) => {
            const [parts, active, archived] = await Promise.all([
              loadBoardParts(db, board),
              loadActiveTasks(db, board.id),
              args.includeArchived ? loadArchivedTasks(db, board.id) : [],
            ]);
            const { filters, unmatched } = resolveFilters(parts, args, uid, unassigned);
            if (filters.assigneeId) resolved.assignee = true;
            if (filters.listId) resolved.list = true;
            if (filters.labelId) resolved.label = true;
            if (unmatched) return [];

            const fmt = formatContext(parts.lists, parts.labels, parts.members, now);
            return [...active, ...archived]
              .filter((task) => {
                if (unassigned && (task.assignedTo ?? []).length > 0) return false;
                if (filters.assigneeId && !task.assignedTo?.includes(filters.assigneeId)) {
                  return false;
                }
                if (filters.listId && task.listId !== filters.listId) return false;
                if (filters.labelId && !task.labelIds?.includes(filters.labelId)) return false;
                const due = task.dueDate?.toMillis();
                if (dueBefore !== undefined && (due === undefined || due >= dueBefore)) {
                  return false;
                }
                if (dueAfter !== undefined && (due === undefined || due <= dueAfter)) {
                  return false;
                }
                if (args.overdue === true && !isOverdue(task, now)) return false;
                if (args.overdue === false && isOverdue(task, now)) return false;
                if (
                  text &&
                  !task.title.toLowerCase().includes(text) &&
                  !htmlToText(task.description).toLowerCase().includes(text)
                ) {
                  return false;
                }
                return true;
              })
              .map((task) => ({ task, fmt, board }));
          }),
        );

        // Searching every board, a name that matches nowhere is a typo, not
        // "no results" — say so instead of returning an empty list.
        if (!explicitBoard) {
          if (args.assignee && !unassigned && !resolved.assignee) {
            throw new ToolError(`No member of any of your boards matches "${args.assignee}".`);
          }
          if (args.list && !resolved.list) {
            throw new ToolError(`None of your boards has a list named "${args.list}".`);
          }
          if (args.label && !resolved.label) {
            throw new ToolError(`None of your boards has a label named "${args.label}".`);
          }
        }

        const limit = args.limit ?? SEARCH_LIMIT_DEFAULT;
        const all = perBoard.flat().sort((a, b) => byDueDate(a.task, b.task));
        const tasks: TaskSummary[] = all
          .slice(0, limit)
          .map(({ task, fmt, board }) =>
            summarizeTask(task, fmt, { board: { id: board.id, title: board.title } }),
          );
        return {
          count: all.length,
          tasks,
          ...(all.length > limit ? { truncated: true } : {}),
        };
      }),
  );

  server.registerTool(
    "get_task",
    {
      title: "View a task",
      description:
        "Get one task in full: description, assignees, labels, dates, attachments and comments, optionally with its activity history.",
      inputSchema: z.object({
        boardId: boardIdField,
        taskId: taskIdField,
        includeHistory: z
          .boolean()
          .optional()
          .describe(`Include up to ${HISTORY_LIMIT} recent activity entries (default false).`),
      }),
      annotations: READ_ONLY,
    },
    ({ boardId, taskId, includeHistory = false }) =>
      runTool("get_task", async () => {
        const board = await loadBoardContext(db, uid, boardId);
        const task = await requireTask(db, boardId, taskId);
        const ref = taskDoc(db, boardId, taskId);
        const [commentsSnap, historySnap] = await Promise.all([
          ref.collection("comments").orderBy("createdAt").get(),
          includeHistory
            ? ref.collection("history").orderBy("createdAt", "desc").limit(HISTORY_LIMIT).get()
            : null,
        ]);
        const fmt = formatContext(board.lists, board.labels, board.members, ctx.now());
        const list = board.lists.find((l) => l.id === task.listId);
        const escalation = task.escalation && task.escalation !== "none" ? task.escalation : null;

        return {
          id: task.id,
          boardId,
          board: board.board.title,
          url: boardUrl(appUrl, boardId),
          title: task.title,
          list: { id: task.listId, title: list?.title ?? "Unknown list" },
          ...(task.archive ? { archived: true, archivedAt: toIso(task.archivedAt) } : {}),
          description: htmlToText(task.description),
          assignees: (task.assignedTo ?? []).map((id) => memberRef(fmt, id)),
          labels: (task.labelIds ?? [])
            .map((id) => fmt.labels.get(id))
            .filter((label) => label !== undefined)
            .map((label) => ({ id: label.id, name: labelName(label) })),
          startDate: toIso(task.startDate),
          dueDate: toIso(task.dueDate),
          ...(isOverdue(task, fmt.now) ? { overdue: true } : {}),
          ...(escalation ? { escalation } : {}),
          ...(task.color ? { color: task.color } : {}),
          ...(task.calendarSyncEnabled ? { syncedToGoogleCalendar: true } : {}),
          attachments: (task.attachments ?? []).map((attachment) => ({
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            url: attachment.downloadUrl,
          })),
          createdBy: memberRef(fmt, task.createdBy).name,
          createdAt: toIso(task.createdAt),
          updatedAt: toIso(task.updatedAt),
          comments: commentsSnap.docs.map((doc) =>
            formatComment({ id: doc.id, ...doc.data() } as Comment, fmt),
          ),
          ...(historySnap
            ? {
                history: historySnap.docs.map((doc) =>
                  describeHistory({ id: doc.id, ...doc.data() } as HistoryEntry, fmt),
                ),
              }
            : {}),
        };
      }),
  );
}

type SearchFilterArgs = { assignee?: string; list?: string; label?: string; boardId?: string };

/**
 * Resolve name-based filters against one board. `unmatched` means some filter
 * names something this board doesn't have, so the board contributes no
 * results; with an explicit boardId that's an error the model should see.
 */
function resolveFilters(
  board: BoardContext,
  args: SearchFilterArgs,
  uid: string,
  unassigned: boolean,
): {
  filters: { assigneeId?: string; listId?: string; labelId?: string };
  unmatched: boolean;
} {
  const strict = args.boardId !== undefined;
  const filters: { assigneeId?: string; listId?: string; labelId?: string } = {};
  let unmatched = false;

  if (args.assignee && !unassigned) {
    const member = findMember(board.members, args.assignee, uid);
    if (member) filters.assigneeId = member.id;
    else if (strict) {
      throw new ToolError(`No member of this board matches "${args.assignee}".`);
    } else unmatched = true;
  }
  if (args.list) {
    const list = findList(board.lists, args.list);
    if (list) filters.listId = list.id;
    else if (strict) throw new ToolError(`This board has no list named "${args.list}".`);
    else unmatched = true;
  }
  if (args.label) {
    const label = findLabel(board.labels, args.label);
    if (label) filters.labelId = label.id;
    else if (strict) throw new ToolError(`This board has no label named "${args.label}".`);
    else unmatched = true;
  }
  return { filters, unmatched };
}
