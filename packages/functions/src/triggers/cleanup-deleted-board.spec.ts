import { describe, expect, it, vi, beforeEach } from "vitest";
import type {
  FirestoreEvent,
  QueryDocumentSnapshot,
} from "firebase-functions/v2/firestore";
import type { Firestore } from "firebase-admin/firestore";

vi.mock("firebase-functions/v2", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentDeleted: (
    _opts: unknown,
    handler: (
      event: FirestoreEvent<
        QueryDocumentSnapshot | undefined,
        { boardId: string }
      >,
    ) => Promise<void>,
  ) => handler,
}));

// Keep the Admin SDK out of the test — the handler receives fakes via deps for
// most cases, and mocked getDb/getBucket cover the default-dependency path.
vi.mock("../firebase", () => ({
  getDb: vi.fn(),
  getBucket: vi.fn(),
}));

import { logger } from "firebase-functions/v2";
import { getBucket, getDb } from "../firebase";
import {
  cleanupDeletedBoard,
  runCleanupDeletedBoard,
} from "./cleanup-deleted-board";

function makeEvent(boardId: string) {
  return { params: { boardId } } as FirestoreEvent<
    QueryDocumentSnapshot | undefined,
    { boardId: string }
  >;
}

// Minimal Firestore stand-in: the handler only builds a board doc ref and calls
// recursiveDelete on it.
function makeDb() {
  const doc = vi.fn((id: string) => ({ path: `boards/${id}` }));
  const collection = vi.fn((_name: string) => ({ doc }));
  const recursiveDelete = vi.fn(async () => undefined);
  const db = { collection, recursiveDelete } as unknown as Firestore;
  return { db, collection, doc, recursiveDelete };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runCleanupDeletedBoard", () => {
  it("recursively deletes the board subtree then removes its Storage objects", async () => {
    const { db, collection, doc, recursiveDelete } = makeDb();
    const deleteBoardFiles = vi.fn(async () => undefined);

    await runCleanupDeletedBoard(makeEvent("board-1"), { db, deleteBoardFiles });

    expect(collection).toHaveBeenCalledWith("boards");
    expect(doc).toHaveBeenCalledWith("board-1");
    expect(recursiveDelete).toHaveBeenCalledTimes(1);
    expect(recursiveDelete).toHaveBeenCalledWith({ path: "boards/board-1" });
    expect(deleteBoardFiles).toHaveBeenCalledWith("board-1");

    // Firestore purge must happen before Storage cleanup.
    expect(recursiveDelete.mock.invocationCallOrder[0]).toBeLessThan(
      deleteBoardFiles.mock.invocationCallOrder[0]!,
    );
  });

  it("logs start and finish with the board id", async () => {
    const { db } = makeDb();

    await runCleanupDeletedBoard(makeEvent("board-9"), {
      db,
      deleteBoardFiles: vi.fn(async () => undefined),
    });

    expect(logger.info).toHaveBeenCalledWith("Board cleanup started", {
      boardId: "board-9",
    });
    expect(logger.info).toHaveBeenCalledWith("Board cleanup finished", {
      boardId: "board-9",
    });
  });

  it("propagates errors so the trigger retries instead of leaking data", async () => {
    const { db, recursiveDelete } = makeDb();
    recursiveDelete.mockRejectedValueOnce(new Error("boom"));

    await expect(
      runCleanupDeletedBoard(makeEvent("board-1"), {
        db,
        deleteBoardFiles: vi.fn(async () => undefined),
      }),
    ).rejects.toThrow("boom");
  });

  it("falls back to the Admin Firestore + Storage bucket when no deps are given", async () => {
    const { db, recursiveDelete } = makeDb();
    const deleteFiles = vi.fn(async () => undefined);
    vi.mocked(getDb).mockReturnValue(db);
    vi.mocked(getBucket).mockReturnValue({ deleteFiles } as never);

    await runCleanupDeletedBoard(makeEvent("board-default"));

    expect(getDb).toHaveBeenCalledTimes(1);
    expect(recursiveDelete).toHaveBeenCalledTimes(1);
    expect(deleteFiles).toHaveBeenCalledWith({
      prefix: "boards/board-default/",
    });
  });
});

describe("cleanupDeletedBoard", () => {
  it("is a deployable trigger handler", () => {
    expect(typeof cleanupDeletedBoard).toBe("function");
  });
});
