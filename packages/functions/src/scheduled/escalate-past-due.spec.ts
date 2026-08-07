import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ScheduledEvent } from "firebase-functions/v2/scheduler";
import type { Firestore } from "firebase-admin/firestore";
import type { EscalationContact } from "@blotch/model";

vi.mock("firebase-functions/v2", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (
    _opts: unknown,
    handler: (event: ScheduledEvent) => Promise<void>,
  ) => handler,
}));

// Avoid loading the real Twilio SDK / defineSecret at import time; the handler
// receives a spy sender via deps in these tests.
vi.mock("../notifications/whatsapp", () => ({
  TWILIO_ACCOUNT_SID: {},
  TWILIO_AUTH_TOKEN: {},
  TWILIO_WHATSAPP_FROM: {},
  sendWhatsApp: vi.fn(),
}));

import { logger } from "firebase-functions/v2";
import {
  escalatePastDue,
  nextEscalationLevel,
  runEscalatePastDue,
} from "./escalate-past-due";

function makeEvent(): ScheduledEvent {
  return {
    scheduleTime: "2026-08-06T09:00:00Z",
    jobName: "escalatePastDue",
  } as ScheduledEvent;
}

// Minimal Firestore Timestamp stand-in — the handler only calls toMillis/toDate.
function ts(millis: number) {
  return {
    toMillis: () => millis,
    toDate: () => new Date(millis),
    seconds: Math.floor(millis / 1000),
    nanoseconds: 0,
  };
}

const HOUR = 3_600_000;
const past = () => ts(Date.now() - 24 * HOUR);
const future = () => ts(Date.now() + 24 * HOUR);

type FakeTaskInput = {
  id: string;
  boardId: string;
  data: Record<string, unknown>;
};

type FakeDoc = {
  id: string;
  data: () => Record<string, unknown>;
  ref: {
    parent: { parent: { id: string } | null };
    update: ReturnType<typeof vi.fn>;
  };
};

function makeDb(opts: {
  tasks: FakeTaskInput[];
  boards?: Record<string, string>;
  users?: Record<string, { escalationContacts?: EscalationContact[] }>;
}): { db: Firestore; docs: Map<string, FakeDoc> } {
  const docs = new Map<string, FakeDoc>();
  const taskDocs: FakeDoc[] = opts.tasks.map((t) => {
    const doc: FakeDoc = {
      id: t.id,
      data: () => t.data,
      ref: {
        parent: { parent: { id: t.boardId } },
        update: vi.fn(async () => undefined),
      },
    };
    docs.set(t.id, doc);
    return doc;
  });

  const db = {
    collectionGroup: (_name: string) => ({
      where: (..._args: unknown[]) => ({
        get: async () => ({ docs: taskDocs }),
      }),
    }),
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (name === "boards") {
            const title = opts.boards?.[id];
            return { exists: title !== undefined, data: () => ({ title }) };
          }
          const user = opts.users?.[id];
          return { exists: !!user, id, data: () => user };
        },
      }),
    }),
  } as unknown as Firestore;

  return { db, docs };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("nextEscalationLevel", () => {
  it("steps up one level at a time and caps at level-3", () => {
    expect(nextEscalationLevel(undefined)).toBe("level-1");
    expect(nextEscalationLevel("none")).toBe("level-1");
    expect(nextEscalationLevel("level-1")).toBe("level-2");
    expect(nextEscalationLevel("level-2")).toBe("level-3");
    expect(nextEscalationLevel("level-3")).toBeNull();
  });

  it("returns null for an unknown value", () => {
    expect(nextEscalationLevel("bogus" as unknown as undefined)).toBeNull();
  });
});

describe("runEscalatePastDue", () => {
  it("escalates an overdue task and messages only the new level's contacts", async () => {
    const send = vi.fn(async () => undefined);
    const { db, docs } = makeDb({
      tasks: [
        {
          id: "t1",
          boardId: "b1",
          data: {
            title: "Ship it",
            dueDate: past(),
            escalation: "none",
            assignedTo: ["u1"],
            calendarSyncEnabled: false,
          },
        },
      ],
      boards: { b1: "Roadmap" },
      users: {
        u1: {
          escalationContacts: [
            { name: "Me", number: "+111", escalation: "level-1" },
            { name: "Boss", number: "+222", escalation: "level-2" },
          ],
        },
      },
    });

    await runEscalatePastDue(makeEvent(), { db, sendWhatsApp: send });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      "+111",
      expect.stringContaining("level-1"),
    );
    expect(send).toHaveBeenCalledWith(
      "+111",
      expect.stringContaining("Roadmap"),
    );
    expect(docs.get("t1")!.ref.update).toHaveBeenCalledWith(
      expect.objectContaining({ escalation: "level-1" }),
    );
  });

  it("skips archived, not-yet-due, and already-max tickets", async () => {
    const send = vi.fn(async () => undefined);
    const { db, docs } = makeDb({
      tasks: [
        {
          id: "done",
          boardId: "b1",
          data: {
            title: "Done",
            dueDate: past(),
            archive: true,
            assignedTo: ["u1"],
          },
        },
        {
          id: "future",
          boardId: "b1",
          data: {
            title: "Later",
            dueDate: future(),
            escalation: "none",
            assignedTo: ["u1"],
          },
        },
        {
          id: "maxed",
          boardId: "b1",
          data: {
            title: "Maxed",
            dueDate: past(),
            escalation: "level-3",
            assignedTo: ["u1"],
          },
        },
      ],
      users: {
        u1: {
          escalationContacts: [
            { name: "Me", number: "+111", escalation: "level-1" },
          ],
        },
      },
    });

    await runEscalatePastDue(makeEvent(), { db, sendWhatsApp: send });

    expect(send).not.toHaveBeenCalled();
    expect(docs.get("done")!.ref.update).not.toHaveBeenCalled();
    expect(docs.get("future")!.ref.update).not.toHaveBeenCalled();
    expect(docs.get("maxed")!.ref.update).not.toHaveBeenCalled();
  });

  it("de-dupes the same number across multiple assignees", async () => {
    const send = vi.fn(async () => undefined);
    const { db } = makeDb({
      tasks: [
        {
          id: "t1",
          boardId: "b1",
          data: {
            title: "Shared",
            dueDate: past(),
            escalation: "none",
            assignedTo: ["u1", "u2"],
          },
        },
      ],
      users: {
        u1: {
          escalationContacts: [
            { name: "A", number: "+111", escalation: "level-1" },
          ],
        },
        u2: {
          escalationContacts: [
            { name: "B", number: "+111", escalation: "level-1" },
          ],
        },
      },
    });

    await runEscalatePastDue(makeEvent(), { db, sendWhatsApp: send });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("+111", expect.any(String));
  });

  it("bumps the level and warns when no contact is configured for it", async () => {
    const send = vi.fn(async () => undefined);
    const { db, docs } = makeDb({
      tasks: [
        {
          id: "t1",
          boardId: "b1",
          data: {
            title: "Orphan",
            dueDate: past(),
            escalation: "none",
            assignedTo: ["u1"],
          },
        },
      ],
      users: {
        // Only a level-2 contact — nothing matches the level-1 bump.
        u1: {
          escalationContacts: [
            { name: "Boss", number: "+222", escalation: "level-2" },
          ],
        },
      },
    });

    await runEscalatePastDue(makeEvent(), { db, sendWhatsApp: send });

    expect(send).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "No escalation contacts configured for level",
      expect.objectContaining({ taskId: "t1", level: "level-1" }),
    );
    expect(docs.get("t1")!.ref.update).toHaveBeenCalledWith(
      expect.objectContaining({ escalation: "level-1" }),
    );
  });
});

describe("escalatePastDue export", () => {
  it("is defined", () => {
    expect(escalatePastDue).toBeDefined();
  });
});
