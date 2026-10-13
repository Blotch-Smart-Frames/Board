import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallableRequest } from "firebase-functions/v2/https";

vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));
vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("firebase-functions/params", () => ({
  defineString: () => ({ value: () => "https://board.test/" }),
}));
// Shim onCall to return the raw handler so the exported callables can be
// invoked directly, and HttpsError as a plain Error carrying `code`.
vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return { HttpsError, onCall: (_opts: unknown, handler: unknown) => handler };
});
vi.mock("../firebase", () => ({ getDb: vi.fn() }));

import { getDb } from "../firebase";
import { Timestamp, createFakeFirestore } from "../testing/fake-firestore";
import { OAUTH_COLLECTIONS, hashSecret } from "../oauth/store";
import { decideMcpConnectRequest, getMcpConnectRequest } from "./mcp-connect";

const NOW = Date.UTC(2026, 9, 13, 9, 0, 0);
const REQUEST_ID = "req-123";

type Callable = (request: CallableRequest<unknown>) => Promise<Record<string, unknown>>;
const getRequest = getMcpConnectRequest as unknown as Callable;
const decide = decideMcpConnectRequest as unknown as Callable;

const asUser = (data: unknown) =>
  ({ auth: { uid: "u-alice" }, data }) as unknown as CallableRequest<unknown>;

let db: ReturnType<typeof createFakeFirestore>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  db = createFakeFirestore();
  vi.mocked(getDb).mockReturnValue(db.asFirestore());
  db.seed(`${OAUTH_COLLECTIONS.requests}/${hashSecret(REQUEST_ID)}`, {
    clientId: "client-1",
    clientName: "Claude",
    clientUri: "https://claude.ai",
    redirectUri: "myapp:/callback",
    codeChallenge: "challenge",
    state: null,
    scopes: ["boards"],
    resource: "https://board.test/mcp",
    createdAt: Timestamp.fromMillis(NOW),
    expiresAt: Timestamp.fromMillis(NOW + 60_000),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("mcp-connect callables", () => {
  it("read the request from the default database and clock", async () => {
    expect(await getRequest(asUser({ requestId: REQUEST_ID }))).toMatchObject({
      clientName: "Claude",
      clientUri: "https://claude.ai",
      // Custom-scheme redirects have no host, so the scheme is shown instead.
      redirectHost: "myapp",
      isLoopbackRedirect: false,
    });
    vi.setSystemTime(NOW + 60_000);
    await expect(getRequest(asUser({ requestId: REQUEST_ID }))).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("issue codes signed with the configured issuer", async () => {
    const { redirectUrl } = await decide(asUser({ requestId: REQUEST_ID, approve: true }));
    const url = new URL(redirectUrl as string);
    expect(url.protocol).toBe("myapp:");
    expect(url.searchParams.get("iss")).toBe("https://board.test");
    expect(url.searchParams.has("state")).toBe(false);
    expect(db.list(OAUTH_COLLECTIONS.codes)).toHaveLength(1);
    expect(db.list(OAUTH_COLLECTIONS.requests)).toHaveLength(0);
  });

  it("require a request id even when no data is sent", async () => {
    await expect(getRequest(asUser(undefined))).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await expect(decide(asUser(null))).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });
});
