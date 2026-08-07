import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CallableRequest } from "firebase-functions/v2/https";
import type { Firestore } from "firebase-admin/firestore";

vi.mock("firebase-functions/v2", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Reimplement HttpsError as a plain Error carrying `code`, and shim onCall to
// return the raw handler so tests can invoke it directly. This keeps the
// firebase-functions v2 https module out of import-time initialization.
vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    HttpsError,
    onCall: (_opts: unknown, handler: unknown) => handler,
  };
});

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

vi.mock("../firebase", () => ({ getDb: vi.fn() }));

import { HttpsError } from "firebase-functions/v2/https";
import { migrateTask, runMigrateTask } from "./migrate-task";

type BoardDoc = {
  ownerId: string;
  collaborators?: string[];
  title: string;
};

type TaskDoc = {
  listId?: string;
  order?: string;
  title?: string;
  description?: string;
  createdBy?: string;
  assignedTo?: string[];
  labelIds?: string[];
  color?: string | null;
  attachments?: unknown[];
  commentCount?: number;
  archive?: boolean;
  archivedAt?: unknown;
  calendarSyncEnabled?: boolean;
  calendarEventId?: string | null;
  startDate?: unknown;
  dueDate?: unknown;
  createdAt?: unknown;
};

type Setup = {
  boards?: Record<string, BoardDoc | undefined>;
  task?: TaskDoc;
  taskExists?: boolean;
  targetListExists?: boolean;
  comments?: { id: string; data: Record<string, unknown> }[];
  history?: { id: string; data: Record<string, unknown> }[];
  targetListTasks?: { data: Record<string, unknown> }[];
};

type BatchSpy = {
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
};

function makeDb(setup: Setup): {
  db: Firestore;
  batches: BatchSpy[];
  newTaskId: string;
  refs: {
    sourceTask: { path: string };
    newTask: { path: string };
  };
} {
  const batches: BatchSpy[] = [];
  const newTaskId = "new-task-id";

  const commentRef = (id: string) => ({
    path: `boards/board-src/tasks/task-1/comments/${id}`,
  });
  const historyRef = (id: string) => ({
    path: `boards/board-src/tasks/task-1/history/${id}`,
  });
  const sourceTaskRef = { path: "boards/board-src/tasks/task-1" };
  const newTaskRef = { path: `boards/board-dst/tasks/${newTaskId}` };

  const commentsSnap = {
    docs: (setup.comments ?? []).map((c) => ({
      id: c.id,
      data: () => c.data,
      ref: commentRef(c.id),
    })),
  };
  const historySnap = {
    docs: (setup.history ?? []).map((h) => ({
      id: h.id,
      data: () => h.data,
      ref: historyRef(h.id),
    })),
  };
  const targetTasksSnap = {
    docs: (setup.targetListTasks ?? []).map((t) => ({ data: () => t.data })),
  };

  const sourceCommentsColl = { get: vi.fn(async () => commentsSnap) };
  const sourceHistoryColl = { get: vi.fn(async () => historySnap) };

  const targetCommentsCollections = new Map<
    string,
    { doc: (id: string) => { path: string } }
  >();
  const targetHistoryDocs: { path: string }[] = [];
  const targetHistoryColl = {
    doc: (id?: string) => {
      const path = id
        ? `boards/board-dst/tasks/${newTaskId}/history/${id}`
        : `boards/board-dst/tasks/${newTaskId}/history/auto-${targetHistoryDocs.length}`;
      const ref = { path };
      targetHistoryDocs.push(ref);
      return ref;
    },
  };
  const targetCommentsColl = {
    doc: (id: string) => ({
      path: `boards/board-dst/tasks/${newTaskId}/comments/${id}`,
    }),
  };

  const newTaskFullRef = {
    ...newTaskRef,
    id: newTaskId,
    collection: (name: string) => {
      if (name === "comments") return targetCommentsColl;
      if (name === "history") return targetHistoryColl;
      throw new Error(`Unexpected subcollection ${name}`);
    },
  };

  const targetTasksColl = {
    doc: () => newTaskFullRef,
    where: () => ({ get: vi.fn(async () => targetTasksSnap) }),
  };

  const sourceTaskFullRef = {
    ...sourceTaskRef,
    get: vi.fn(async () => ({
      exists: setup.taskExists ?? true,
      data: () => setup.task ?? {},
    })),
    collection: (name: string) => {
      if (name === "comments") return sourceCommentsColl;
      if (name === "history") return sourceHistoryColl;
      throw new Error(`Unexpected subcollection ${name}`);
    },
  };

  const sourceBoardRef = {
    get: vi.fn(async () => ({
      exists: !!(setup.boards ?? {})["board-src"],
      data: () => (setup.boards ?? {})["board-src"],
    })),
    collection: (name: string) => {
      if (name === "tasks") {
        return {
          doc: (id: string) => {
            if (id !== "task-1") throw new Error(`unexpected task id ${id}`);
            return sourceTaskFullRef;
          },
        };
      }
      throw new Error(`Unexpected subcollection ${name}`);
    },
  };

  const targetListRef = {
    get: vi.fn(async () => ({ exists: setup.targetListExists ?? true })),
  };

  const targetBoardRef = {
    get: vi.fn(async () => ({
      exists: !!(setup.boards ?? {})["board-dst"],
      data: () => (setup.boards ?? {})["board-dst"],
    })),
    collection: (name: string) => {
      if (name === "tasks") return targetTasksColl;
      if (name === "lists") {
        return { doc: () => targetListRef };
      }
      throw new Error(`Unexpected subcollection ${name}`);
    },
  };

  const db = {
    collection: (name: string) => {
      if (name !== "boards")
        throw new Error(`Unexpected root collection ${name}`);
      return {
        doc: (id: string) => {
          if (id === "board-src") return sourceBoardRef;
          if (id === "board-dst") return targetBoardRef;
          throw new Error(`unexpected board id ${id}`);
        },
      };
    },
    batch: () => {
      const batch: BatchSpy = {
        set: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn(async () => undefined),
      };
      batches.push(batch);
      return batch;
    },
  } as unknown as Firestore;

  targetCommentsCollections.set("root", targetCommentsColl);

  return {
    db,
    batches,
    newTaskId,
    refs: { sourceTask: sourceTaskRef, newTask: newTaskRef },
  };
}

function makeRequest(
  data: unknown,
  uid: string | null = "user-1",
): CallableRequest<unknown> {
  return {
    data,
    auth: uid ? ({ uid } as { uid: string }) : undefined,
  } as CallableRequest<unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runMigrateTask", () => {
  const baseBoards = {
    "board-src": { ownerId: "user-1", collaborators: [], title: "Source" },
    "board-dst": { ownerId: "user-1", collaborators: [], title: "Target" },
  } satisfies Record<string, BoardDoc>;
  const basePayload = {
    sourceBoardId: "board-src",
    taskId: "task-1",
    targetBoardId: "board-dst",
    targetListId: "list-dst",
  };
  const baseTask: TaskDoc = {
    listId: "list-src",
    title: "Move me",
    order: "a0",
    createdBy: "user-1",
    createdAt: { seconds: 1 },
  };

  it("rejects unauthenticated callers", async () => {
    const { db } = makeDb({});
    await expect(
      runMigrateTask(makeRequest(basePayload, null), { db }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("validates the required string fields", async () => {
    const { db } = makeDb({});
    await expect(
      runMigrateTask(makeRequest({ ...basePayload, targetListId: "" }), { db }),
    ).rejects.toBeInstanceOf(HttpsError);
    await expect(
      runMigrateTask(makeRequest({ ...basePayload, taskId: 42 }), { db }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("refuses a same-board migration before touching Firestore", async () => {
    const { db } = makeDb({});
    await expect(
      runMigrateTask(
        makeRequest({ ...basePayload, targetBoardId: "board-src" }),
        { db },
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("rejects callers who aren't a member of the source board", async () => {
    const { db } = makeDb({
      boards: {
        "board-src": { ownerId: "other", collaborators: [], title: "Source" },
        "board-dst": baseBoards["board-dst"],
      },
      task: baseTask,
    });
    await expect(
      runMigrateTask(makeRequest(basePayload), { db }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects callers who aren't a member of the target board", async () => {
    const { db } = makeDb({
      boards: {
        "board-src": baseBoards["board-src"],
        "board-dst": { ownerId: "other", collaborators: [], title: "Target" },
      },
      task: baseTask,
    });
    await expect(
      runMigrateTask(makeRequest(basePayload), { db }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("accepts a collaborator on both boards", async () => {
    const { db, batches } = makeDb({
      boards: {
        "board-src": {
          ownerId: "someone-else",
          collaborators: ["user-1"],
          title: "Source",
        },
        "board-dst": {
          ownerId: "someone-else",
          collaborators: ["user-1"],
          title: "Target",
        },
      },
      task: baseTask,
    });
    const result = await runMigrateTask(makeRequest(basePayload), { db });
    expect(result.newTaskId).toBe("new-task-id");
    // At least one write batch committed successfully.
    expect(batches[0]!.commit).toHaveBeenCalledTimes(1);
  });

  it("returns not-found when the source task is missing", async () => {
    const { db } = makeDb({ boards: baseBoards, taskExists: false });
    await expect(
      runMigrateTask(makeRequest(basePayload), { db }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("returns not-found when the target list is missing", async () => {
    const { db } = makeDb({
      boards: baseBoards,
      task: baseTask,
      targetListExists: false,
    });
    await expect(
      runMigrateTask(makeRequest(basePayload), { db }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("copies the task with cross-board fields dropped and stamps board_migrated history", async () => {
    const { db, batches } = makeDb({
      boards: baseBoards,
      task: {
        ...baseTask,
        description: "D",
        assignedTo: ["u2"],
        labelIds: ["l1"],
        color: "#fff",
        attachments: [],
        commentCount: 3,
      },
      comments: [{ id: "c1", data: { text: "Hi", authorId: "other-user" } }],
      history: [{ id: "h1", data: { action: "moved", userId: "other-user" } }],
    });

    const result = await runMigrateTask(makeRequest(basePayload), { db });

    expect(result.newTaskId).toBe("new-task-id");

    const writes = batches[0]!;
    // 1 new task + 1 copied comment + 1 copied history + 1 board_migrated marker
    expect(writes.set).toHaveBeenCalledTimes(4);

    const taskPayload = writes.set.mock.calls[0]![1] as Record<string, unknown>;
    expect(taskPayload).toMatchObject({
      listId: "list-dst",
      title: "Move me",
      description: "D",
      assignedTo: ["u2"],
      labelIds: [], // dropped
      commentCount: 3,
    });

    const migrationEntry = writes.set.mock.calls.find(
      (c) => (c[1] as { action?: string }).action === "board_migrated",
    );
    expect(migrationEntry).toBeDefined();
    expect(migrationEntry![1]).toMatchObject({
      action: "board_migrated",
      userId: "user-1",
      metadata: { fromBoardName: "Source", toBoardName: "Target" },
    });

    // A copied comment carries its original authorId — client rules would have
    // rejected this create, which is exactly why the migration runs server-side.
    const copiedComment = writes.set.mock.calls.find(
      (c) => (c[1] as { text?: string; authorId?: string }).text === "Hi",
    );
    expect(copiedComment![1]).toMatchObject({
      text: "Hi",
      authorId: "other-user",
    });
  });

  it("commits the write batch before the delete batch", async () => {
    const { db, batches } = makeDb({
      boards: baseBoards,
      task: baseTask,
      comments: [{ id: "c1", data: { text: "Hi" } }],
      history: [{ id: "h1", data: { action: "moved" } }],
    });

    await runMigrateTask(makeRequest(basePayload), { db });

    expect(batches).toHaveLength(2);
    // Writes come first (target task + comment + history + migration entry).
    expect(batches[0]!.set).toHaveBeenCalledTimes(4);
    // Deletes second: the source task, its comment, and its history entry.
    expect(batches[1]!.delete).toHaveBeenCalledTimes(3);
    // Both batches committed once.
    expect(batches[0]!.commit).toHaveBeenCalledTimes(1);
    expect(batches[1]!.commit).toHaveBeenCalledTimes(1);
  });

  it("chunks the delete batch when it exceeds Firestore's 500-op limit", async () => {
    const comments = Array.from({ length: 501 }, (_, i) => ({
      id: `c${i}`,
      data: { text: `t${i}` },
    }));
    const { db, batches } = makeDb({
      boards: baseBoards,
      task: baseTask,
      comments,
    });

    await runMigrateTask(makeRequest(basePayload), { db });

    // batches: [writes, deletes-chunk-1, deletes-chunk-2]
    expect(batches.length).toBe(3);
    // 502 deletes total: 501 comments + 1 source task. Split into 500 + 2.
    expect(batches[1]!.delete).toHaveBeenCalledTimes(500);
    expect(batches[2]!.delete).toHaveBeenCalledTimes(2);
  });

  it("returns not-found when the source board is missing", async () => {
    const { db } = makeDb({
      boards: { "board-dst": baseBoards["board-dst"] },
      task: baseTask,
    });
    await expect(
      runMigrateTask(makeRequest(basePayload), { db }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("orders the copied task after existing tasks in the target list", async () => {
    const { db, batches } = makeDb({
      boards: baseBoards,
      task: baseTask,
      targetListTasks: [{ data: { order: "a1" } }, { data: { order: "a0" } }],
    });

    await runMigrateTask(makeRequest(basePayload), { db });

    const taskPayload = batches[0]!.set.mock.calls[0]![1] as {
      order: string;
    };
    // Any generated key must sort after the largest existing order.
    expect(taskPayload.order > "a1").toBe(true);
  });

  it("exposes migrateTask as a callable that delegates to runMigrateTask", async () => {
    const { db } = makeDb({ boards: baseBoards, task: baseTask });
    // The mocked onCall just returns the handler, so calling migrateTask hits
    // the arrow wrapper that re-dispatches to runMigrateTask (without deps).
    // We only care that it forwards through and rejects on missing auth,
    // proving the wrapper is exercised.
    await expect(
      (
        migrateTask as unknown as (
          req: CallableRequest<unknown>,
        ) => Promise<unknown>
      )(makeRequest(basePayload, null)),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    // Reference db so the setup helper stays symmetric across tests.
    expect(db).toBeDefined();
  });
});
