import type { Firestore } from "firebase-admin/firestore";
import type { Board, Label, List, Sprint, Task, User } from "@blotch/model";
import { compareOrder } from "../util/ordering";

/**
 * Most active tasks a non-archival list may hold. Mirrors the client's
 * `MAX_TASKS_PER_LIST` (packages/client/src/app/features/board/list-limit.ts).
 */
export const MAX_TASKS_PER_LIST = 20;

export const LIST_FULL_MESSAGE = (title: string) =>
  `The list "${title}" is full (max ${MAX_TASKS_PER_LIST} active tasks). Finish, archive or move some tasks first.`;

/**
 * An error whose message is safe and useful to show the model, which can
 * usually recover (pick another list, fix an id, …). Anything else thrown by a
 * tool is logged and reported generically.
 */
export class ToolError extends Error {}

export type Member = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "collaborator";
};

/** Everything about a board that tools need to validate input and name things. */
export type BoardContext = {
  board: Board;
  lists: List[];
  labels: Label[];
  members: Member[];
};

function withId<T>(snap: { id: string; data(): unknown }): T {
  return { id: snap.id, ...(snap.data() as object) } as T;
}

export function boardDoc(db: Firestore, boardId: string) {
  return db.collection("boards").doc(boardId);
}

export function taskDoc(db: Firestore, boardId: string, taskId: string) {
  return boardDoc(db, boardId).collection("tasks").doc(taskId);
}

export function isMember(board: Board, uid: string): boolean {
  return board.ownerId === uid || (board.collaborators ?? []).includes(uid);
}

/** Boards the user owns or collaborates on, most recently created first. */
export async function listAccessibleBoards(
  db: Firestore,
  uid: string,
): Promise<Board[]> {
  const boards = db.collection("boards");
  const [owned, shared] = await Promise.all([
    boards.where("ownerId", "==", uid).get(),
    boards.where("collaborators", "array-contains", uid).get(),
  ]);
  const merged = new Map<string, Board>();
  for (const snap of [...shared.docs, ...owned.docs]) {
    merged.set(snap.id, withId<Board>(snap));
  }
  return [...merged.values()].sort(
    (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
  );
}

/**
 * Load a board the user can access. Missing and forbidden boards get the same
 * message so a guessed id reveals nothing.
 */
export async function requireBoard(
  db: Firestore,
  uid: string,
  boardId: string,
): Promise<Board> {
  const snap = await boardDoc(db, boardId).get();
  const board = snap.exists ? withId<Board>(snap) : null;
  if (!board || !isMember(board, uid)) {
    throw new ToolError(
      `Board ${boardId} was not found or you don't have access to it. Use list_boards to see your boards.`,
    );
  }
  return board;
}

async function loadOrdered<T extends { order?: string }>(
  db: Firestore,
  boardId: string,
  collection: "lists" | "labels" | "sprints",
): Promise<T[]> {
  const snap = await boardDoc(db, boardId).collection(collection).get();
  return snap.docs
    .map((doc) => withId<T>(doc))
    .sort((a, b) => compareOrder(a.order, b.order));
}

export async function loadMembers(db: Firestore, board: Board): Promise<Member[]> {
  const ids = [board.ownerId, ...(board.collaborators ?? [])];
  const unique = [...new Set(ids)];
  const snaps = await db.getAll(
    ...unique.map((id) => db.collection("users").doc(id)),
  );
  return unique.map((id, index) => {
    const snap = snaps[index];
    const user = snap?.exists ? (snap.data() as Partial<User>) : {};
    return {
      id,
      name: user.displayName || user.email || "Unknown user",
      email: user.email ?? "",
      role: id === board.ownerId ? "owner" : "collaborator",
    };
  });
}

/** Lists, labels and members of a board already loaded (and access-checked). */
export async function loadBoardParts(
  db: Firestore,
  board: Board,
): Promise<BoardContext> {
  const [lists, labels, members] = await Promise.all([
    loadOrdered<List>(db, board.id, "lists"),
    loadOrdered<Label>(db, board.id, "labels"),
    loadMembers(db, board),
  ]);
  return { board, lists, labels, members };
}

export async function loadBoardContext(
  db: Firestore,
  uid: string,
  boardId: string,
): Promise<BoardContext> {
  return loadBoardParts(db, await requireBoard(db, uid, boardId));
}

/** All tasks in one list, archived or not (order keys span both). */
export async function loadListTasks(
  db: Firestore,
  boardId: string,
  listId: string,
): Promise<Task[]> {
  const snap = await boardDoc(db, boardId)
    .collection("tasks")
    .where("listId", "==", listId)
    .get();
  return snap.docs.map((doc) => withId<Task>(doc));
}

/** The list new tasks go to by default: the first non-archival one. */
export function defaultList(ctx: BoardContext): List {
  const list = ctx.lists.find((l) => !isArchivalList(ctx.board, l.id));
  if (!list) {
    throw new ToolError(
      "This board has no lists to add tasks to yet. Create one with create_list.",
    );
  }
  return list;
}

export function loadSprints(db: Firestore, boardId: string): Promise<Sprint[]> {
  return loadOrdered<Sprint>(db, boardId, "sprints");
}

/** Active (non-archived) tasks — the same set the board view streams. */
export async function loadActiveTasks(
  db: Firestore,
  boardId: string,
): Promise<Task[]> {
  const snap = await boardDoc(db, boardId)
    .collection("tasks")
    .where("archive", "==", false)
    .get();
  return snap.docs.map((doc) => withId<Task>(doc));
}

export async function loadArchivedTasks(
  db: Firestore,
  boardId: string,
): Promise<Task[]> {
  const snap = await boardDoc(db, boardId)
    .collection("tasks")
    .where("archive", "==", true)
    .get();
  return snap.docs.map((doc) => withId<Task>(doc));
}

export async function requireTask(
  db: Firestore,
  boardId: string,
  taskId: string,
): Promise<Task> {
  const snap = await taskDoc(db, boardId, taskId).get();
  if (!snap.exists) {
    throw new ToolError(
      `Task ${taskId} was not found on board ${boardId}. Use search_tasks or get_board to find task ids.`,
    );
  }
  return withId<Task>(snap);
}

export function isArchivalList(board: Board, listId: string): boolean {
  return (board.archivalListIds ?? []).includes(listId);
}

const normalize = (value: string) => value.trim().toLowerCase();

function describeOptions(names: string[]): string {
  return names.length > 0 ? names.join(", ") : "(none)";
}

/** Find a list by id or (case-insensitive) title. */
export function findList(lists: List[], ref: string): List | undefined {
  return (
    lists.find((list) => list.id === ref) ??
    lists.find((list) => normalize(list.title) === normalize(ref))
  );
}

export function resolveList(lists: List[], ref: string): List {
  const list = findList(lists, ref);
  if (!list) {
    throw new ToolError(
      `No list matches "${ref}". Lists on this board: ${describeOptions(lists.map((l) => l.title))}.`,
    );
  }
  return list;
}

/** Find a label by id or name, case-insensitive, with or without its emoji. */
export function findLabel(labels: Label[], ref: string): Label | undefined {
  const wanted = normalize(ref);
  return (
    labels.find((label) => label.id === ref) ??
    labels.find(
      (label) =>
        normalize(label.name) === wanted ||
        normalize(`${label.emoji ?? ""} ${label.name}`) === wanted,
    )
  );
}

export function resolveLabels(labels: Label[], refs: string[]): Label[] {
  return refs.map((ref) => {
    const label = findLabel(labels, ref);
    if (!label) {
      throw new ToolError(
        `No label matches "${ref}". Labels on this board: ${describeOptions(labels.map((l) => l.name))}. Use create_label to add one.`,
      );
    }
    return label;
  });
}

/**
 * Find a board member by "me", id, email, full name or first name
 * (case-insensitive). Returns undefined when nobody matches; throws when a
 * name is ambiguous.
 */
export function findMember(
  members: Member[],
  ref: string,
  uid: string,
): Member | undefined {
  const wanted = normalize(ref);
  if (wanted === "me") return members.find((member) => member.id === uid);
  const direct =
    members.find((member) => member.id === ref) ??
    members.find((member) => member.email && normalize(member.email) === wanted);
  if (direct) return direct;

  const unique = (matches: Member[]) => {
    if (matches.length > 1) {
      throw new ToolError(
        `More than one member matches "${ref}" (${matches.map((m) => m.name).join(", ")}); use their email instead.`,
      );
    }
    return matches[0];
  };
  return (
    unique(members.filter((member) => normalize(member.name) === wanted)) ??
    unique(members.filter((member) => normalize(member.name).split(/\s+/)[0] === wanted))
  );
}

export function resolveMembers(
  members: Member[],
  refs: string[],
  uid: string,
): Member[] {
  return refs.map((ref) => {
    const member = findMember(members, ref, uid);
    if (!member) {
      throw new ToolError(
        `No member of this board matches "${ref}". Members: ${describeOptions(
          members.map((m) => (m.email ? `${m.name} <${m.email}>` : m.name)),
        )}. Only board members can be assigned.`,
      );
    }
    return member;
  });
}
