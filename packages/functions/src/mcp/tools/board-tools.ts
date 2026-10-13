import { FieldValue } from "firebase-admin/firestore";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Comment } from "@blotch/model";
import { z } from "zod";
import { compareOrder, getOrderAtEnd, getOrderAtIndex } from "../../util/ordering";
import {
  ToolError,
  boardDoc,
  findLabel,
  findList,
  loadBoardContext,
  requireBoard,
  requireTask,
  resolveList,
  taskDoc,
} from "../board-data";
import {
  DESTRUCTIVE,
  PALETTE,
  WRITE,
  boardIdField,
  colorField,
  runTool,
  taskIdField,
  type ToolContext,
} from "./shared";

const commentTextField = z
  .string()
  .trim()
  .min(1)
  .max(10_000)
  .describe("Comment text. Markdown is supported.");
const commentIdField = z.string().min(1).describe("Comment id, from get_task.");

/** Comment, list and label tools. */
export function registerBoardTools(server: McpServer, ctx: ToolContext): void {
  const { db, uid } = ctx;

  const commentDoc = (boardId: string, taskId: string, commentId: string) =>
    taskDoc(db, boardId, taskId).collection("comments").doc(commentId);

  async function requireComment(boardId: string, taskId: string, commentId: string) {
    const snap = await commentDoc(boardId, taskId, commentId).get();
    if (!snap.exists) {
      throw new ToolError(`Comment ${commentId} was not found on that task.`);
    }
    return { id: snap.id, ...snap.data() } as Comment;
  }

  server.registerTool(
    "add_comment",
    {
      title: "Comment on a task",
      description: "Add a comment to a task, posted as the signed-in user.",
      inputSchema: z.object({ boardId: boardIdField, taskId: taskIdField, text: commentTextField }),
      annotations: WRITE,
    },
    (args) =>
      runTool("add_comment", async () => {
        await requireBoard(db, uid, args.boardId);
        const task = await requireTask(db, args.boardId, args.taskId);
        const ref = taskDoc(db, args.boardId, args.taskId).collection("comments").doc();
        const batch = db.batch();
        batch.set(ref, {
          text: args.text,
          authorId: uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        batch.update(taskDoc(db, args.boardId, args.taskId), {
          commentCount: FieldValue.increment(1),
        });
        await batch.commit();
        return { comment: { id: ref.id, text: args.text }, task: { id: task.id, title: task.title } };
      }),
  );

  server.registerTool(
    "update_comment",
    {
      title: "Edit a comment",
      description: "Replace the text of a comment. You can only edit your own comments.",
      inputSchema: z.object({
        boardId: boardIdField,
        taskId: taskIdField,
        commentId: commentIdField,
        text: commentTextField,
      }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    (args) =>
      runTool("update_comment", async () => {
        await requireBoard(db, uid, args.boardId);
        const comment = await requireComment(args.boardId, args.taskId, args.commentId);
        if (comment.authorId !== uid) {
          throw new ToolError("You can only edit your own comments.");
        }
        await commentDoc(args.boardId, args.taskId, args.commentId).update({
          text: args.text,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { comment: { id: comment.id, text: args.text } };
      }),
  );

  server.registerTool(
    "delete_comment",
    {
      title: "Delete a comment",
      description:
        "Delete a comment. You can delete your own comments, or any comment on a board you own.",
      inputSchema: z.object({
        boardId: boardIdField,
        taskId: taskIdField,
        commentId: commentIdField,
      }),
      annotations: DESTRUCTIVE,
    },
    (args) =>
      runTool("delete_comment", async () => {
        const board = await requireBoard(db, uid, args.boardId);
        const comment = await requireComment(args.boardId, args.taskId, args.commentId);
        if (comment.authorId !== uid && board.ownerId !== uid) {
          throw new ToolError("You can only delete your own comments, unless you own the board.");
        }
        const batch = db.batch();
        batch.delete(commentDoc(args.boardId, args.taskId, args.commentId));
        batch.update(taskDoc(db, args.boardId, args.taskId), {
          commentCount: FieldValue.increment(-1),
        });
        await batch.commit();
        return { deleted: { id: comment.id } };
      }),
  );

  server.registerTool(
    "create_list",
    {
      title: "Create a list",
      description: "Add a list (column) to a board, at the end or at a given position.",
      inputSchema: z.object({
        boardId: boardIdField,
        title: z.string().trim().min(1).max(200).describe("List title, e.g. \"Review\"."),
        index: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("0-based position among the lists; omit to add at the end."),
      }),
      annotations: WRITE,
    },
    (args) =>
      runTool("create_list", async () => {
        const board = await loadBoardContext(db, uid, args.boardId);
        if (findList(board.lists, args.title)) {
          throw new ToolError(`A list named "${args.title}" already exists on this board.`);
        }
        const order =
          args.index === undefined
            ? getOrderAtEnd(board.lists)
            : getOrderAtIndex(board.lists, args.index);
        const ref = boardDoc(db, args.boardId).collection("lists").doc();
        await ref.set({ title: args.title, order, createdAt: FieldValue.serverTimestamp() });
        return { list: { id: ref.id, title: args.title } };
      }),
  );

  server.registerTool(
    "update_list",
    {
      title: "Rename or reorder a list",
      description: "Rename a list (column) and/or move it to another position on the board.",
      inputSchema: z.object({
        boardId: boardIdField,
        list: z.string().min(1).describe("The list's current name or id."),
        title: z.string().trim().min(1).max(200).optional().describe("New title."),
        index: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("New 0-based position among the lists; 0 is the leftmost."),
      }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    (args) =>
      runTool("update_list", async () => {
        const board = await loadBoardContext(db, uid, args.boardId);
        const list = resolveList(board.lists, args.list);
        const payload: Record<string, unknown> = {};
        if (args.title !== undefined) {
          const clash = findList(board.lists, args.title);
          if (clash && clash.id !== list.id) {
            throw new ToolError(`A list named "${args.title}" already exists on this board.`);
          }
          payload.title = args.title;
        }
        const others = board.lists.filter((other) => other.id !== list.id);
        if (args.index !== undefined) payload.order = getOrderAtIndex(others, args.index);
        if (Object.keys(payload).length === 0) {
          throw new ToolError("Nothing to update. Pass title and/or index.");
        }
        await boardDoc(db, args.boardId).collection("lists").doc(list.id).update(payload);

        const updated = { ...list, ...payload } as typeof list;
        return {
          list: { id: list.id, title: updated.title },
          // The board's lists, left to right, after the change.
          lists: [...others, updated]
            .sort((a, b) => compareOrder(a.order, b.order))
            .map((l) => l.title),
        };
      }),
  );

  server.registerTool(
    "create_label",
    {
      title: "Create a label",
      description:
        "Add a label to a board so tasks can be tagged with it (see label_task). Colors default to an unused one from the app's palette.",
      inputSchema: z.object({
        boardId: boardIdField,
        name: z.string().trim().min(1).max(50).describe("Label name, e.g. \"Bug\"."),
        color: colorField.optional(),
        emoji: z.string().max(16).optional().describe("Optional emoji shown before the name."),
      }),
      annotations: WRITE,
    },
    (args) =>
      runTool("create_label", async () => {
        const board = await loadBoardContext(db, uid, args.boardId);
        if (findLabel(board.labels, args.name)) {
          throw new ToolError(`A label named "${args.name}" already exists on this board.`);
        }
        const used = new Set(board.labels.map((label) => label.color.toUpperCase()));
        const color =
          args.color?.toUpperCase() ??
          PALETTE.find((candidate) => !used.has(candidate)) ??
          (PALETTE[board.labels.length % PALETTE.length] as string);
        const ref = boardDoc(db, args.boardId).collection("labels").doc();
        await ref.set({
          name: args.name,
          color,
          emoji: args.emoji || null,
          order: getOrderAtEnd(board.labels),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return {
          label: { id: ref.id, name: args.name, color, ...(args.emoji ? { emoji: args.emoji } : {}) },
        };
      }),
  );
}
