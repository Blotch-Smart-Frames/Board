import type { CallToolResult } from "@modelcontextprotocol/server";
import { Timestamp, createFakeFirestore, type FakeFirestore } from "./fake-firestore";
import { createMcpConfig } from "../mcp/config";
import { OAUTH_COLLECTIONS, hashSecret } from "../oauth/store";

/**
 * A small workspace for MCP tests:
 *
 * - "Product" (b1): Alice owns, Bob collaborates. Lists To Do / In Progress /
 *   Done / Archive (archival). Labels Bug 🐛 and Hot.
 * - "Marketing" (b2): Bob owns, Alice collaborates. One list, Backlog.
 * - "Secret" (b3): Carol's; Alice has no access.
 */
export const ALICE = "u-alice";
export const BOB = "u-bob";
export const CAROL = "u-carol";

export const NOW = Date.UTC(2026, 9, 13, 9, 0, 0);
export const DAY = 86_400_000;
export const config = createMcpConfig("https://board.test");

const ts = (millis: number) => Timestamp.fromMillis(millis);

export function taskData(overrides: Record<string, unknown> = {}) {
  return {
    listId: "l-todo",
    title: "Untitled",
    description: "",
    order: "a0",
    startDate: null,
    dueDate: null,
    calendarEventId: null,
    calendarSyncEnabled: false,
    archive: false,
    archivedAt: null,
    createdBy: ALICE,
    assignedTo: [],
    labelIds: [],
    color: null,
    attachments: [],
    commentCount: 0,
    createdAt: ts(NOW - 10 * DAY),
    updatedAt: ts(NOW - 10 * DAY),
    ...overrides,
  };
}

export function seedWorkspace(db = createFakeFirestore()) {
  db.seed(`users/${ALICE}`, { email: "alice@example.com", displayName: "Alice Adams" });
  db.seed(`users/${BOB}`, { email: "bob@example.com", displayName: "Bob Brown" });
  db.seed(`users/${CAROL}`, { email: "carol@example.com", displayName: "Carol Cole" });
  db.seed(`users/${ALICE}/preferences/boardOrder`, {
    folders: { f1: { name: "Work", order: "a0" } },
    boardFolders: { b1: "f1" },
  });

  db.seed("boards/b1", {
    title: "Product",
    ownerId: ALICE,
    collaborators: [BOB],
    archivalListIds: ["l-archive"],
    createdAt: ts(NOW - 30 * DAY),
    updatedAt: ts(NOW - 30 * DAY),
  });
  const lists = [
    ["l-todo", "To Do", "a0"],
    ["l-doing", "In Progress", "a1"],
    ["l-done", "Done", "a2"],
    ["l-archive", "Archive", "a3"],
  ] as const;
  for (const [id, title, order] of lists) {
    db.seed(`boards/b1/lists/${id}`, { title, order, createdAt: ts(NOW - 30 * DAY) });
  }
  db.seed("boards/b1/labels/lb-bug", {
    name: "Bug",
    emoji: "🐛",
    color: "#EF4444",
    order: "a0",
  });
  db.seed("boards/b1/labels/lb-hot", { name: "Hot", color: "#F97316", order: "a1" });
  db.seed("boards/b1/sprints/s1", {
    name: "Sprint 7",
    startDate: ts(NOW - 3 * DAY),
    endDate: ts(NOW + 11 * DAY),
    order: "a0",
  });

  db.seed(
    "boards/b1/tasks/t-login",
    taskData({
      title: "Fix login bug",
      description: "<p>Users <strong>can't</strong> sign in.</p><ul><li>Chrome</li><li>Safari</li></ul>",
      assignedTo: [ALICE],
      labelIds: ["lb-bug"],
      dueDate: ts(NOW - 2 * DAY),
      commentCount: 1,
    }),
  );
  db.seed("boards/b1/tasks/t-login/comments/c1", {
    text: "Seen on **Safari** too",
    authorId: BOB,
    createdAt: ts(NOW - 2 * DAY),
    updatedAt: ts(NOW - 2 * DAY),
  });
  db.seed("boards/b1/tasks/t-login/history/h1", {
    action: "assignee_added",
    userId: BOB,
    metadata: { userName: "Alice Adams" },
    createdAt: ts(NOW - 3 * DAY),
  });
  db.seed(
    "boards/b1/tasks/t-api",
    taskData({
      title: "Build API",
      listId: "l-doing",
      assignedTo: [BOB],
      dueDate: ts(NOW + 5 * DAY),
    }),
  );
  db.seed(
    "boards/b1/tasks/t-docs",
    taskData({ title: "Write docs", order: "a1", assignedTo: [ALICE] }),
  );
  db.seed(
    "boards/b1/tasks/t-old",
    taskData({
      title: "Old launch",
      listId: "l-archive",
      archive: true,
      archivedAt: ts(NOW - 20 * DAY),
      assignedTo: [ALICE],
    }),
  );

  db.seed("boards/b2", {
    title: "Marketing",
    ownerId: BOB,
    collaborators: [ALICE],
    createdAt: ts(NOW - 20 * DAY),
    updatedAt: ts(NOW - 20 * DAY),
  });
  db.seed("boards/b2/lists/l2-backlog", { title: "Backlog", order: "a0" });
  db.seed(
    "boards/b2/tasks/t-campaign",
    taskData({
      listId: "l2-backlog",
      title: "Launch campaign",
      assignedTo: [ALICE, BOB],
      dueDate: ts(NOW + 1 * DAY),
    }),
  );

  db.seed("boards/b3", {
    title: "Secret",
    ownerId: CAROL,
    collaborators: [],
    createdAt: ts(NOW - 5 * DAY),
    updatedAt: ts(NOW - 5 * DAY),
  });
  db.seed("boards/b3/lists/l3", { title: "Plans", order: "a0" });
  db.seed("boards/b3/tasks/t-secret", taskData({ listId: "l3", title: "Secret plan" }));

  return db;
}

/** Store an access token for `uid` straight into the fake, returning the raw token. */
export function seedAccessToken(db: FakeFirestore, uid: string, token = `at-${uid}`) {
  db.seed(`${OAUTH_COLLECTIONS.tokens}/${hashSecret(token)}`, {
    kind: "access",
    uid,
    clientId: "client_test",
    grantId: "grant-test",
    scopes: ["boards"],
    resource: config.resourceUrl,
    createdAt: ts(NOW),
    expiresAt: ts(NOW + 3_600_000),
  });
  return token;
}

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  "mcp-protocol-version": "2025-11-25",
};

let rpcId = 0;

/** POST a JSON-RPC request to /mcp and return the parsed JSON-RPC response. */
export async function rpc(
  app: (request: Request) => Promise<Response>,
  token: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<{ result?: Record<string, unknown>; error?: { message: string } }> {
  rpcId += 1;
  const response = await app(
    new Request(`${config.appUrl}/mcp`, {
      method: "POST",
      headers: { ...MCP_HEADERS, authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: rpcId, method, params }),
    }),
  );
  const body = await response.text();
  // Stateless legacy responses arrive as one SSE event; modern ones as JSON.
  const data = body.startsWith("{")
    ? body
    : (body
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6) ?? body);
  return JSON.parse(data);
}

export type ToolResult = CallToolResult & {
  structuredContent?: Record<string, any>;
};

export async function callTool(
  app: (request: Request) => Promise<Response>,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const response = await rpc(app, token, "tools/call", { name, arguments: args });
  if (response.error) throw new Error(`JSON-RPC error: ${response.error.message}`);
  return response.result as ToolResult;
}

/** The text of an error result, for asserting on what the model is told. */
export function errorText(result: ToolResult): string {
  if (!result.isError) {
    throw new Error(`Expected an error result, got ${JSON.stringify(result.structuredContent)}`);
  }
  return (result.content[0] as { text: string }).text;
}
