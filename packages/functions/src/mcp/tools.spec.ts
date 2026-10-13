import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));
vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../firebase", () => ({ getDb: vi.fn(), getBucket: vi.fn() }));

import { logger } from "firebase-functions/v2";
import { Timestamp } from "../testing/fake-firestore";
import {
  ALICE,
  BOB,
  CAROL,
  DAY,
  NOW,
  callTool,
  config,
  errorText,
  rpc,
  seedAccessToken,
  seedWorkspace,
  taskData,
} from "../testing/mcp-fixtures";
import { createClientResolver } from "../oauth/clients";
import { createTokenVerifier } from "../oauth/verifier";
import { createMcpApp, type McpApp } from "./app";
import { PALETTE } from "./tools/shared";

let db: ReturnType<typeof seedWorkspace>;
let app: McpApp;
let token: string;
let deleteStoragePaths: Mock<(paths: string[]) => Promise<void>>;

const call = (name: string, args: Record<string, unknown> = {}) =>
  callTool(app, token, name, args);

function history(taskPath: string) {
  return db.list(`${taskPath}/history`).map((path) => db.read(path) as Record<string, any> | undefined);
}

/** A task stored without the optional arrays that older tasks can lack. */
function bareTask(overrides: Record<string, unknown> = {}) {
  const task: Record<string, unknown> = taskData(overrides);
  delete task.assignedTo;
  delete task.labelIds;
  delete task.attachments;
  return task;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  db = seedWorkspace();
  token = seedAccessToken(db, ALICE);
  deleteStoragePaths = vi.fn(async (_paths: string[]) => {});
  app = createMcpApp({
    db: db.asFirestore(),
    config,
    resolveClient: createClientResolver({ db: db.asFirestore() }),
    verifier: createTokenVerifier(db.asFirestore()),
    deleteStoragePaths,
    now: () => NOW,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("tool listing", () => {
  it("exposes every tool with annotations", async () => {
    const { result } = await rpc(app, token, "tools/list");
    const tools = result?.tools as { name: string; annotations: Record<string, boolean> }[];
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "add_comment",
      "assign_task",
      "create_label",
      "create_list",
      "create_task",
      "delete_comment",
      "delete_task",
      "get_board",
      "get_current_user",
      "get_task",
      "label_task",
      "list_boards",
      "list_my_tasks",
      "move_task",
      "move_task_to_board",
      "search_tasks",
      "update_comment",
      "update_list",
      "update_task",
    ]);
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    expect(byName.get("get_board")?.annotations.readOnlyHint).toBe(true);
    expect(byName.get("delete_task")?.annotations.destructiveHint).toBe(true);
    expect(byName.get("create_task")?.annotations.readOnlyHint).toBe(false);
  });
});

describe("read tools", () => {
  it("get_current_user returns the token's user", async () => {
    const result = await call("get_current_user");
    expect(result.structuredContent).toEqual({
      id: ALICE,
      name: "Alice Adams",
      email: "alice@example.com",
    });
  });

  it("list_boards returns only boards the user belongs to, with folders", async () => {
    const result = await call("list_boards");
    expect(result.structuredContent?.boards).toEqual([
      {
        id: "b2",
        title: "Marketing",
        role: "collaborator",
        members: 2,
        url: "https://board.test/board/b2",
      },
      {
        id: "b1",
        title: "Product",
        role: "owner",
        folder: "Work",
        members: 2,
        url: "https://board.test/board/b1",
      },
    ]);
  });

  it("get_board shows lists in order with their active tasks", async () => {
    const board = (await call("get_board", { boardId: "b1" })).structuredContent!;
    expect(board.lists.map((list: any) => [list.title, list.activeTasks])).toEqual([
      ["To Do", 2],
      ["In Progress", 1],
      ["Done", 0],
      ["Archive", 0],
    ]);
    expect(board.lists[3].archival).toBe(true);
    expect(board.lists[0].tasks).toEqual([
      {
        id: "t-login",
        title: "Fix login bug",
        assignees: ["Alice Adams"],
        labels: ["🐛 Bug"],
        dueDate: new Date(NOW - 2 * DAY).toISOString(),
        overdue: true,
        comments: 1,
      },
      { id: "t-docs", title: "Write docs", assignees: ["Alice Adams"] },
    ]);
    expect(board.members).toEqual([
      { id: ALICE, name: "Alice Adams", email: "alice@example.com", role: "owner" },
      { id: BOB, name: "Bob Brown", email: "bob@example.com", role: "collaborator" },
    ]);
    expect(board.labels).toEqual([
      { id: "lb-bug", name: "Bug", emoji: "🐛", color: "#EF4444" },
      { id: "lb-hot", name: "Hot", color: "#F97316" },
    ]);
    expect(board.sprints).toEqual([
      expect.objectContaining({ name: "Sprint 7", current: true }),
    ]);
  });

  it("get_board can leave tasks out and flags full lists", async () => {
    for (let i = 0; i < 20; i++) {
      db.seed(`boards/b1/tasks/fill-${i}`, taskData({ listId: "l-done", order: `a${i}` }));
    }
    const board = (await call("get_board", { boardId: "b1", includeTasks: false }))
      .structuredContent!;
    expect(board.lists[2]).toEqual({ id: "l-done", title: "Done", activeTasks: 20, full: true });
    expect(board.lists[0].tasks).toBeUndefined();
  });

  it("refuses boards the user can't access, without revealing them", async () => {
    expect(errorText(await call("get_board", { boardId: "b3" }))).toMatch(
      /was not found or you don't have access/,
    );
    expect(errorText(await call("get_board", { boardId: "nope" }))).toMatch(
      /was not found or you don't have access/,
    );
  });

  it("list_my_tasks spans boards, sorted by due date, without archived tasks", async () => {
    const result = (await call("list_my_tasks")).structuredContent!;
    expect(result.tasks.map((task: any) => [task.title, task.board])).toEqual([
      ["Fix login bug", "Product"],
      ["Launch campaign", "Marketing"],
      ["Write docs", "Product"],
    ]);
    expect(result.count).toBe(3);
  });

  it("list_my_tasks can be limited to one board", async () => {
    const result = (await call("list_my_tasks", { boardId: "b2" })).structuredContent!;
    expect(result.tasks.map((task: any) => task.id)).toEqual(["t-campaign"]);
  });

  it("list_my_tasks orders tasks with the same due date by title", async () => {
    db.seed("boards/b1/tasks/t-alpha", taskData({ title: "Alpha", order: "a2", assignedTo: [ALICE] }));
    const result = (await call("list_my_tasks", { boardId: "b1" })).structuredContent!;
    expect(result.tasks.map((task: any) => task.title)).toEqual([
      "Fix login bug",
      "Alpha",
      "Write docs",
    ]);
  });

  describe("search_tasks", () => {
    const titles = async (args: Record<string, unknown>) =>
      ((await call("search_tasks", args)).structuredContent!.tasks as any[]).map(
        (task) => task.title,
      );

    it("finds a teammate's tasks by name across boards", async () => {
      expect(await titles({ assignee: "bob brown" })).toEqual(["Launch campaign", "Build API"]);
    });

    it("filters by list, label, text and due dates", async () => {
      expect(await titles({ list: "in progress" })).toEqual(["Build API"]);
      expect(await titles({ label: "bug" })).toEqual(["Fix login bug"]);
      expect(await titles({ text: "SAFARI" })).toEqual(["Fix login bug"]);
      expect(await titles({ overdue: true })).toEqual(["Fix login bug"]);
      expect(await titles({ dueAfter: "2026-10-13", dueBefore: "2026-10-16" })).toEqual([
        "Launch campaign",
      ]);
      expect(await titles({ assignee: "unassigned", boardId: "b1" })).toEqual([]);
    });

    it("finds unassigned tasks and tasks that aren't overdue", async () => {
      db.seed("boards/b1/tasks/t-bare", bareTask({ title: "Untouched", order: "a2" }));
      db.seed("boards/b1/tasks/t-free", taskData({ title: "Free", order: "a3" }));
      expect(await titles({ assignee: "unassigned", boardId: "b1" })).toEqual(["Free", "Untouched"]);
      expect(await titles({ overdue: false, boardId: "b1" })).toEqual([
        "Build API",
        "Free",
        "Untouched",
        "Write docs",
      ]);
    });

    it("includes archived tasks only when asked", async () => {
      expect(await titles({ text: "launch" })).toEqual(["Launch campaign"]);
      expect(await titles({ text: "launch", includeArchived: true })).toEqual([
        "Launch campaign",
        "Old launch",
      ]);
    });

    it("truncates to the limit", async () => {
      const result = (await call("search_tasks", { limit: 1 })).structuredContent!;
      expect(result).toMatchObject({ count: 4, truncated: true });
      expect(result.tasks).toHaveLength(1);
    });

    it("reports names that match nothing instead of returning nothing", async () => {
      expect(errorText(await call("search_tasks", { assignee: "Zed" }))).toMatch(
        /No member of any of your boards/,
      );
      expect(errorText(await call("search_tasks", { list: "Nowhere" }))).toMatch(
        /None of your boards has a list/,
      );
      expect(errorText(await call("search_tasks", { label: "Nope" }))).toMatch(
        /None of your boards has a label/,
      );
      expect(errorText(await call("search_tasks", { label: "Nope", boardId: "b1" }))).toMatch(
        /This board has no label/,
      );
      expect(errorText(await call("search_tasks", { assignee: "Zed", boardId: "b1" }))).toMatch(
        /No member of this board matches "Zed"/,
      );
      expect(errorText(await call("search_tasks", { list: "Nowhere", boardId: "b1" }))).toMatch(
        /This board has no list named "Nowhere"/,
      );
      // Resolves on b1 but not b2: that's a valid search, not an error.
      expect(await titles({ assignee: "Bob", list: "In Progress" })).toEqual(["Build API"]);
    });

    it("rejects a malformed date", async () => {
      expect(errorText(await call("search_tasks", { dueBefore: "next week" }))).toMatch(
        /dueBefore must be a date/,
      );
    });
  });

  it("get_task returns details, comments and history", async () => {
    const task = (await call("get_task", { boardId: "b1", taskId: "t-login", includeHistory: true }))
      .structuredContent!;
    expect(task).toMatchObject({
      id: "t-login",
      board: "Product",
      list: { id: "l-todo", title: "To Do" },
      description: "Users can't sign in.\n\n- Chrome\n- Safari",
      assignees: [{ id: ALICE, name: "Alice Adams", email: "alice@example.com" }],
      labels: [{ id: "lb-bug", name: "🐛 Bug" }],
      overdue: true,
      createdBy: "Alice Adams",
      comments: [{ id: "c1", author: "Bob Brown", authorId: BOB, text: "Seen on **Safari** too" }],
      history: [{ summary: "Bob Brown assigned Alice Adams" }],
    });
  });

  it("get_task shows escalation, color, calendar sync and attachments", async () => {
    db.seed(
      "boards/b1/tasks/t-hot",
      taskData({
        title: "Escalated",
        labelIds: ["lb-bug", "lb-deleted"],
        escalation: "level-2",
        color: "#EF4444",
        calendarSyncEnabled: true,
        attachments: [
          {
            id: "a1",
            fileName: "spec.pdf",
            fileType: "application/pdf",
            fileSize: 1200,
            downloadUrl: "https://files.test/spec.pdf",
            storagePath: "boards/b1/tasks/t-hot/attachments/spec.pdf",
          },
        ],
      }),
    );
    const task = (await call("get_task", { boardId: "b1", taskId: "t-hot" })).structuredContent!;
    expect(task).toMatchObject({
      labels: [{ id: "lb-bug", name: "🐛 Bug" }],
      escalation: "level-2",
      color: "#EF4444",
      syncedToGoogleCalendar: true,
      attachments: [
        {
          fileName: "spec.pdf",
          fileType: "application/pdf",
          fileSize: 1200,
          url: "https://files.test/spec.pdf",
        },
      ],
    });
    expect(task.history).toBeUndefined();
  });

  it("get_task copes with archived tasks and missing optional fields", async () => {
    const archived = (await call("get_task", { boardId: "b1", taskId: "t-old" })).structuredContent!;
    expect(archived).toMatchObject({ archived: true, list: { id: "l-archive", title: "Archive" } });

    db.seed(
      "boards/b1/tasks/t-bare",
      bareTask({ title: "Bare", listId: "l-gone", escalation: "none" }),
    );
    const bare = (await call("get_task", { boardId: "b1", taskId: "t-bare" })).structuredContent!;
    expect(bare).toMatchObject({
      list: { id: "l-gone", title: "Unknown list" },
      assignees: [],
      labels: [],
      attachments: [],
    });
    expect(bare.escalation).toBeUndefined();
    expect(bare.archived).toBeUndefined();
  });

  it("get_task reports a missing task", async () => {
    expect(errorText(await call("get_task", { boardId: "b1", taskId: "missing" }))).toMatch(
      /Task missing was not found/,
    );
  });
});

describe("create_task", () => {
  it("creates a task at the bottom of the first list with resolved people and labels", async () => {
    const result = (
      await call("create_task", {
        boardId: "b1",
        title: "Ship it",
        description: "Steps:\n- build\n- **deploy**",
        assignees: ["me", "bob@example.com"],
        labels: ["Hot"],
        dueDate: "2026-10-20",
        color: "#3b82f6",
      })
    ).structuredContent!;

    expect(result.task).toMatchObject({
      title: "Ship it",
      list: "To Do",
      assignees: ["Alice Adams", "Bob Brown"],
      labels: ["Hot"],
      dueDate: "2026-10-20T12:00:00.000Z",
    });
    const stored = db.read(`boards/b1/tasks/${result.task.id}`)!;
    expect(stored).toMatchObject({
      listId: "l-todo",
      createdBy: ALICE,
      archive: false,
      archivedAt: null,
      assignedTo: [ALICE, BOB],
      labelIds: ["lb-hot"],
      color: "#3B82F6",
      commentCount: 0,
      description: "<p>Steps:</p><ul><li>build</li><li><strong>deploy</strong></li></ul>",
    });
    expect((stored.order as string) > "a1").toBe(true);
    expect(stored.createdAt).toBeInstanceOf(Timestamp);
  });

  it("archives a task created straight into an archival list", async () => {
    const result = await call("create_task", { boardId: "b1", title: "Done already", list: "Archive" });
    const stored = db.read(`boards/b1/tasks/${result.structuredContent!.task.id}`)!;
    expect(stored.archive).toBe(true);
    expect(stored.archivedAt).toBeInstanceOf(Timestamp);
  });

  it("puts the task in a named list with a start date", async () => {
    const result = await call("create_task", {
      boardId: "b1",
      title: "Plan",
      list: "In Progress",
      startDate: "2026-10-14",
    });
    expect(result.structuredContent!.task.list).toBe("In Progress");
    const stored = db.read(`boards/b1/tasks/${result.structuredContent!.task.id}`)!;
    expect(stored.listId).toBe("l-doing");
    expect((stored.startDate as Timestamp).toDate().toISOString()).toBe("2026-10-14T12:00:00.000Z");
    expect(stored).toMatchObject({ description: "", color: null, assignedTo: [], labelIds: [] });
  });

  it("enforces the 20-task list limit", async () => {
    for (let i = 0; i < 18; i++) {
      db.seed(`boards/b1/tasks/fill-${i}`, taskData({ order: `b${i}` }));
    }
    expect(errorText(await call("create_task", { boardId: "b1", title: "One too many" }))).toMatch(
      /"To Do" is full \(max 20/,
    );
  });

  it("only assigns board members", async () => {
    const result = await call("create_task", { boardId: "b1", title: "X", assignees: ["Carol Cole"] });
    expect(errorText(result)).toMatch(/No member of this board matches "Carol Cole"/);
  });

  it("explains when the board has no lists to add to", async () => {
    db.seed("boards/b4", { title: "Empty", ownerId: ALICE, collaborators: [] });
    expect(errorText(await call("create_task", { boardId: "b4", title: "X" }))).toMatch(
      /no lists to add tasks to/,
    );
  });
});

describe("update_task", () => {
  it("updates fields and records history like the web app", async () => {
    const result = (
      await call("update_task", {
        boardId: "b1",
        taskId: "t-login",
        title: "Fix SSO login",
        dueDate: "2026-10-30",
        startDate: null,
        color: "#22c55e",
      })
    ).structuredContent!;

    expect(result.task).toMatchObject({ title: "Fix SSO login", dueDate: "2026-10-30T12:00:00.000Z" });
    expect(result.task.overdue).toBeUndefined();
    expect(db.read("boards/b1/tasks/t-login")).toMatchObject({
      title: "Fix SSO login",
      color: "#22C55E",
      startDate: null,
    });
    expect(history("boards/b1/tasks/t-login")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "field_changed",
          field: "title",
          userId: ALICE,
          metadata: { oldValue: "Fix login bug", newValue: "Fix SSO login" },
        }),
        expect.objectContaining({
          field: "dueDate",
          metadata: { oldValue: "10/11/2026", newValue: "10/30/2026" },
        }),
        expect.objectContaining({ field: "color", metadata: { oldValue: "", newValue: "#22C55E" } }),
      ]),
    );
    // startDate was already empty, so clearing it isn't a change.
    expect(history("boards/b1/tasks/t-login").some((h) => h?.field === "startDate")).toBe(false);
  });

  it("clears a deadline and warns about calendar-synced tasks", async () => {
    db.seed("boards/b1/tasks/t-api", taskData({
      title: "Build API",
      listId: "l-doing",
      calendarSyncEnabled: true,
      dueDate: Timestamp.fromMillis(NOW + DAY),
    }));
    const result = (await call("update_task", { boardId: "b1", taskId: "t-api", dueDate: null }))
      .structuredContent!;
    expect(db.read("boards/b1/tasks/t-api")?.dueDate).toBeNull();
    expect(result.note).toMatch(/Google Calendar/);
  });

  it("replaces the description and clears the color", async () => {
    db.seed("boards/b1/tasks/t-docs", taskData({ title: "Write docs", color: "#22C55E" }));
    const result = await call("update_task", {
      boardId: "b1",
      taskId: "t-docs",
      description: "Use **Markdown**",
      color: null,
    });
    expect(db.read("boards/b1/tasks/t-docs")).toMatchObject({
      description: "<p>Use <strong>Markdown</strong></p>",
      color: null,
    });
    expect(result.structuredContent!.note).toBeUndefined();
  });

  it("needs at least one field", async () => {
    expect(errorText(await call("update_task", { boardId: "b1", taskId: "t-login" }))).toMatch(
      /Nothing to update/,
    );
  });
});

describe("assign_task and label_task", () => {
  it("adds and removes assignees with history", async () => {
    const result = (
      await call("assign_task", { boardId: "b1", taskId: "t-login", add: ["Bob"], remove: ["me"] })
    ).structuredContent!;
    expect(result.task.assignees).toEqual(["Bob Brown"]);
    expect(db.read("boards/b1/tasks/t-login")?.assignedTo).toEqual([BOB]);
    expect(history("boards/b1/tasks/t-login").map((h) => [h?.action, h?.metadata?.userName])).toEqual(
      expect.arrayContaining([
        ["assignee_added", "Bob Brown"],
        ["assignee_removed", "Alice Adams"],
      ]),
    );
  });

  it("removes a former member by id and ignores no-op changes", async () => {
    db.seed("boards/b1/tasks/t-docs", taskData({ title: "Write docs", assignedTo: ["u-gone"] }));
    await call("assign_task", { boardId: "b1", taskId: "t-docs", remove: ["u-gone"] });
    expect(db.read("boards/b1/tasks/t-docs")?.assignedTo).toEqual([]);

    const before = history("boards/b1/tasks/t-api").length;
    await call("assign_task", { boardId: "b1", taskId: "t-api", add: ["Bob"] });
    expect(history("boards/b1/tasks/t-api")).toHaveLength(before);
  });

  it("requires something to change", async () => {
    expect(errorText(await call("assign_task", { boardId: "b1", taskId: "t-login" }))).toMatch(
      /Pass people/,
    );
    expect(errorText(await call("label_task", { boardId: "b1", taskId: "t-login" }))).toMatch(
      /Pass labels/,
    );
  });

  it("adds and removes labels by name", async () => {
    const result = (
      await call("label_task", { boardId: "b1", taskId: "t-login", add: ["hot", "Hot"], remove: ["🐛 Bug"] })
    ).structuredContent!;
    expect(result.task.labels).toEqual(["Hot"]);
    expect(db.read("boards/b1/tasks/t-login")?.labelIds).toEqual(["lb-hot"]);
    expect(history("boards/b1/tasks/t-login").map((h) => h?.action)).toEqual(
      expect.arrayContaining(["label_added", "label_removed"]),
    );
  });

  it("removes labels on their own and skips no-op label changes", async () => {
    await call("label_task", { boardId: "b1", taskId: "t-login", remove: ["Bug"] });
    expect(db.read("boards/b1/tasks/t-login")?.labelIds).toEqual([]);

    const before = history("boards/b1/tasks/t-login").length;
    const result = (await call("label_task", { boardId: "b1", taskId: "t-login", remove: ["Hot"] }))
      .structuredContent!;
    expect(result.task.labels).toBeUndefined();
    expect(history("boards/b1/tasks/t-login")).toHaveLength(before);
  });

  it("assigns and labels a task stored without assignees or labels", async () => {
    db.seed("boards/b1/tasks/t-bare", bareTask({ title: "Bare" }));
    await call("assign_task", { boardId: "b1", taskId: "t-bare", add: ["me"] });
    await call("label_task", { boardId: "b1", taskId: "t-bare", add: ["Bug"] });
    expect(db.read("boards/b1/tasks/t-bare")).toMatchObject({
      assignedTo: [ALICE],
      labelIds: ["lb-bug"],
    });
  });

  it("points at create_label for unknown labels", async () => {
    const result = await call("label_task", { boardId: "b1", taskId: "t-login", add: ["Urgent"] });
    expect(errorText(result)).toMatch(/No label matches "Urgent".*create_label/);
  });
});

describe("move_task", () => {
  it("moves to another list at the bottom and logs it", async () => {
    const result = (await call("move_task", { boardId: "b1", taskId: "t-login", list: "Done" }))
      .structuredContent!;
    expect(result.task.list).toBe("Done");
    expect(db.read("boards/b1/tasks/t-login")?.listId).toBe("l-done");
    expect(history("boards/b1/tasks/t-login")).toContainEqual(
      expect.objectContaining({
        action: "moved",
        metadata: { fromListName: "To Do", toListName: "Done" },
      }),
    );
  });

  it("reorders within a list by index", async () => {
    await call("move_task", { boardId: "b1", taskId: "t-docs", list: "To Do", index: 0 });
    const order = (id: string) => db.read(`boards/b1/tasks/${id}`)?.order as string;
    expect(order("t-docs") < order("t-login")).toBe(true);
    expect(history("boards/b1/tasks/t-docs")).toEqual([]);
  });

  it("is a no-op when the task is already there", async () => {
    const result = (await call("move_task", { boardId: "b1", taskId: "t-docs", list: "l-todo" }))
      .structuredContent!;
    expect(result.note).toMatch(/already in "To Do"/);
  });

  it("archives into an archival list and restores out of it", async () => {
    await call("move_task", { boardId: "b1", taskId: "t-login", list: "Archive" });
    expect(db.read("boards/b1/tasks/t-login")).toMatchObject({ archive: true });
    expect(db.read("boards/b1/tasks/t-login")?.archivedAt).toBeInstanceOf(Timestamp);

    await call("move_task", { boardId: "b1", taskId: "t-old", list: "In Progress" });
    expect(db.read("boards/b1/tasks/t-old")).toMatchObject({ archive: false, archivedAt: null });
    expect(history("boards/b1/tasks/t-old")).toContainEqual(
      expect.objectContaining({ action: "unarchived" }),
    );
  });

  it("won't move into a full list", async () => {
    for (let i = 0; i < 19; i++) {
      db.seed(`boards/b1/tasks/fill-${i}`, taskData({ listId: "l-doing", order: `b${i}` }));
    }
    const result = await call("move_task", { boardId: "b1", taskId: "t-login", list: "In Progress" });
    expect(errorText(result)).toMatch(/"In Progress" is full/);
  });

  it("names the board's lists when the list is unknown", async () => {
    const result = await call("move_task", { boardId: "b1", taskId: "t-login", list: "QA" });
    expect(errorText(result)).toMatch(/Lists on this board: To Do, In Progress, Done, Archive/);
  });
});

describe("move_task_to_board", () => {
  it("migrates the task with comments and drops labels", async () => {
    const result = (
      await call("move_task_to_board", { boardId: "b1", taskId: "t-login", targetBoardId: "b2" })
    ).structuredContent!;
    expect(result).toMatchObject({ boardId: "b2", board: "Marketing", list: "Backlog" });
    expect(db.read("boards/b1/tasks/t-login")).toBeUndefined();
    const moved = db.read(`boards/b2/tasks/${result.newTaskId}`)!;
    expect(moved).toMatchObject({ title: "Fix login bug", listId: "l2-backlog", labelIds: [] });
    expect(db.list(`boards/b2/tasks/${result.newTaskId}/comments`)).toHaveLength(1);
  });

  it("checks access to both boards and the same-board case", async () => {
    expect(
      errorText(await call("move_task_to_board", { boardId: "b1", taskId: "t-login", targetBoardId: "b3" })),
    ).toMatch(/not found or you don't have access/);
    expect(
      errorText(await call("move_task_to_board", { boardId: "b1", taskId: "t-login", targetBoardId: "b1" })),
    ).toMatch(/use move_task/);
  });

  it("surfaces errors from the shared migration code", async () => {
    const result = await call("move_task_to_board", {
      boardId: "b1",
      taskId: "missing",
      targetBoardId: "b2",
    });
    expect(errorText(result)).toBe("Task not found.");
  });

  it("respects the list limit on the target board", async () => {
    for (let i = 0; i < 19; i++) {
      db.seed(`boards/b2/tasks/fill-${i}`, taskData({ listId: "l2-backlog", order: `b${i}` }));
    }
    const result = await call("move_task_to_board", {
      boardId: "b1",
      taskId: "t-login",
      targetBoardId: "b2",
      targetList: "Backlog",
    });
    expect(errorText(result)).toMatch(/"Backlog" is full/);
  });
});

describe("delete_task", () => {
  it("deletes the task, its subcollections and its attachments", async () => {
    db.seed("boards/b1/tasks/t-login", {
      ...db.read("boards/b1/tasks/t-login"),
      attachments: [{ id: "a1", storagePath: "boards/b1/tasks/t-login/attachments/a1.png" }],
    });
    const result = await call("delete_task", { boardId: "b1", taskId: "t-login" });
    expect(result.structuredContent).toEqual({ deleted: { id: "t-login", title: "Fix login bug" } });
    expect(db.read("boards/b1/tasks/t-login")).toBeUndefined();
    expect(db.list("boards/b1/tasks/t-login/comments")).toEqual([]);
    expect(deleteStoragePaths).toHaveBeenCalledWith(["boards/b1/tasks/t-login/attachments/a1.png"]);
  });

  it("still deletes when attachment cleanup fails", async () => {
    db.seed("boards/b1/tasks/t-docs", taskData({
      attachments: [{ id: "a1", storagePath: "x" }],
    }));
    deleteStoragePaths.mockRejectedValueOnce(new Error("storage down"));
    await call("delete_task", { boardId: "b1", taskId: "t-docs" });
    expect(db.read("boards/b1/tasks/t-docs")).toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("skips storage cleanup for tasks without attachments", async () => {
    db.seed("boards/b1/tasks/t-bare", bareTask({ title: "Bare" }));
    await call("delete_task", { boardId: "b1", taskId: "t-bare" });
    await call("delete_task", { boardId: "b1", taskId: "t-docs" });
    expect(db.read("boards/b1/tasks/t-bare")).toBeUndefined();
    expect(db.read("boards/b1/tasks/t-docs")).toBeUndefined();
    expect(deleteStoragePaths).not.toHaveBeenCalled();
  });
});

describe("comments", () => {
  it("adds a comment as the user and bumps the count", async () => {
    const result = (await call("add_comment", { boardId: "b1", taskId: "t-login", text: "On it" }))
      .structuredContent!;
    expect(db.read(`boards/b1/tasks/t-login/comments/${result.comment.id}`)).toMatchObject({
      text: "On it",
      authorId: ALICE,
    });
    expect(db.read("boards/b1/tasks/t-login")?.commentCount).toBe(2);
  });

  it("only lets authors edit", async () => {
    const result = await call("update_comment", {
      boardId: "b1",
      taskId: "t-login",
      commentId: "c1",
      text: "Hijacked",
    });
    expect(errorText(result)).toMatch(/only edit your own/);

    const mine = (await call("add_comment", { boardId: "b1", taskId: "t-login", text: "Draft" }))
      .structuredContent!.comment.id;
    await call("update_comment", { boardId: "b1", taskId: "t-login", commentId: mine, text: "Final" });
    expect(db.read(`boards/b1/tasks/t-login/comments/${mine}`)?.text).toBe("Final");
  });

  it("lets the board owner delete anyone's comment, but not collaborators", async () => {
    await call("delete_comment", { boardId: "b1", taskId: "t-login", commentId: "c1" });
    expect(db.read("boards/b1/tasks/t-login/comments/c1")).toBeUndefined();
    expect(db.read("boards/b1/tasks/t-login")?.commentCount).toBe(0);

    db.seed("boards/b2/tasks/t-campaign/comments/c9", { text: "Bob's", authorId: BOB });
    const result = await call("delete_comment", {
      boardId: "b2",
      taskId: "t-campaign",
      commentId: "c9",
    });
    expect(errorText(result)).toMatch(/only delete your own/);
  });

  it("reports a missing comment", async () => {
    const result = await call("delete_comment", { boardId: "b1", taskId: "t-login", commentId: "zz" });
    expect(errorText(result)).toMatch(/Comment zz was not found/);
  });
});

describe("lists and labels", () => {
  it("creates lists at the end or at a position", async () => {
    await call("create_list", { boardId: "b1", title: "Review", index: 2 });
    const result = (await call("get_board", { boardId: "b1", includeTasks: false })).structuredContent!;
    expect(result.lists.map((list: any) => list.title)).toEqual([
      "To Do",
      "In Progress",
      "Review",
      "Done",
      "Archive",
    ]);
    expect(errorText(await call("create_list", { boardId: "b1", title: "review" }))).toMatch(
      /already exists/,
    );
  });

  it("adds a list at the end by default", async () => {
    const result = (await call("create_list", { boardId: "b1", title: "Later" })).structuredContent!;
    expect(result.list).toEqual({ id: expect.any(String), title: "Later" });
    const board = (await call("get_board", { boardId: "b1", includeTasks: false })).structuredContent!;
    expect(board.lists.map((list: any) => list.title).at(-1)).toBe("Later");
  });

  it("renames and reorders a list", async () => {
    const result = (
      await call("update_list", { boardId: "b1", list: "Done", title: "Shipped", index: 0 })
    ).structuredContent!;
    expect(result.lists).toEqual(["Shipped", "To Do", "In Progress", "Archive"]);
    expect(db.read("boards/b1/lists/l-done")?.title).toBe("Shipped");
    expect(errorText(await call("update_list", { boardId: "b1", list: "Shipped" }))).toMatch(
      /Nothing to update/,
    );
    expect(
      errorText(await call("update_list", { boardId: "b1", list: "Shipped", title: "To Do" })),
    ).toMatch(/already exists/);
  });

  it("creates labels with an unused palette color", async () => {
    const result = (await call("create_label", { boardId: "b1", name: "Docs", emoji: "📚" }))
      .structuredContent!;
    expect(result.label).toEqual({ id: expect.any(String), name: "Docs", color: "#F59E0B", emoji: "📚" });
    expect(errorText(await call("create_label", { boardId: "b1", name: "docs" }))).toMatch(
      /already exists/,
    );
  });

  it("takes an explicit label color, and cycles the palette once it's used up", async () => {
    const custom = (await call("create_label", { boardId: "b1", name: "Ops", color: "#abcdef" }))
      .structuredContent!;
    expect(custom.label).toEqual({ id: expect.any(String), name: "Ops", color: "#ABCDEF" });
    expect(db.read(`boards/b1/labels/${custom.label.id}`)?.emoji).toBeNull();

    // Valid fractional order keys after Ops (a2): a3, a4, ...
    const orderDigits = "3456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    PALETTE.forEach((color, i) =>
      db.seed(`boards/b1/labels/p${i}`, { name: `P${i}`, color, order: `a${orderDigits[i]}` }),
    );
    const overflow = (await call("create_label", { boardId: "b1", name: "Overflow" }))
      .structuredContent!;
    // Bug, Hot and Ops plus one label per palette color already exist.
    expect(overflow.label.color).toBe(PALETTE[(3 + PALETTE.length) % PALETTE.length]);
  });
});

describe("access and errors", () => {
  it("acts only on the token's user", async () => {
    const carol = seedAccessToken(db, CAROL);
    const result = await callTool(app, carol, "list_boards");
    expect(result.structuredContent?.boards.map((b: any) => b.id)).toEqual(["b3"]);
  });

  it("hides unexpected errors from the model", async () => {
    const original = db.getAll.bind(db);
    db.getAll = async () => {
      throw new Error("database exploded at 10.0.0.1");
    };
    const result = await call("get_board", { boardId: "b1" });
    expect(errorText(result)).toBe(
      "Board hit an unexpected error running this tool. Try again shortly.",
    );
    expect(logger.error).toHaveBeenCalled();
    db.getAll = original;
  });

  it("validates arguments against the schema", async () => {
    const result = await call("create_task", { boardId: "b1", title: "  " });
    expect(errorText(result)).toMatch(/Input validation error/);
  });
});
