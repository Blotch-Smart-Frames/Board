import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));
vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../firebase", () => ({ getDb: vi.fn(), getBucket: vi.fn() }));

import type { CallableRequest } from "firebase-functions/v2/https";
import type { FakeFirestore } from "../testing/fake-firestore";
import {
  ALICE,
  NOW,
  callTool,
  config,
  errorText,
  rpc,
  seedWorkspace,
} from "../testing/mcp-fixtures";
import {
  runDecideMcpConnectRequest,
  runGetMcpConnectRequest,
} from "../callable/mcp-connect";
import { createClientResolver } from "../oauth/clients";
import { OAUTH_COLLECTIONS, pkceS256 } from "../oauth/store";
import { createTokenVerifier } from "../oauth/verifier";
import { createMcpApp, type McpApp } from "./app";

const ORIGIN = config.appUrl;
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "verifier-".padEnd(64, "x");
const CHALLENGE = pkceS256(VERIFIER);

let db: FakeFirestore & { asFirestore(): any };
let app: McpApp;
let fetchMetadata: ReturnType<typeof vi.fn>;
let clock: number;

const connectDeps = () => ({ db: db.asFirestore(), issuer: config.issuer, now: () => clock });
const asUser = (data: unknown, uid = ALICE) =>
  ({ auth: { uid }, data }) as unknown as CallableRequest<unknown>;

function get(path: string, headers: Record<string, string> = {}) {
  return app(new Request(`${ORIGIN}${path}`, { headers }));
}

function postForm(path: string, params: Record<string, string>, headers: Record<string, string> = {}) {
  return app(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
      body: new URLSearchParams(params).toString(),
    }),
  );
}

function postJson(path: string, body: unknown) {
  return app(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function register(metadata: Record<string, unknown> = {}) {
  const response = await postJson("/oauth/register", {
    client_name: "Claude",
    redirect_uris: [REDIRECT],
    token_endpoint_auth_method: "none",
    ...metadata,
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

function authorizeUrl(params: Record<string, string>) {
  return `/oauth/authorize?${new URLSearchParams({
    response_type: "code",
    redirect_uri: REDIRECT,
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    state: "st-123",
    scope: "boards offline_access",
    resource: config.resourceUrl,
    ...params,
  })}`;
}

/** Run authorize + consent, returning the redirect the browser lands on. */
async function authorizeAndApprove(clientId: string, extra: Record<string, string> = {}) {
  const response = await get(authorizeUrl({ client_id: clientId, ...extra }));
  expect(response.status).toBe(302);
  const consent = new URL(response.headers.get("location")!);
  expect(consent.origin + consent.pathname).toBe(`${ORIGIN}/connect`);
  const requestId = consent.searchParams.get("request")!;
  const { redirectUrl } = await runDecideMcpConnectRequest(
    asUser({ requestId, approve: true }),
    connectDeps(),
  );
  return new URL(redirectUrl);
}

async function exchange(clientId: string, code: string, extra: Record<string, string> = {}) {
  const response = await postForm("/oauth/token", {
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: VERIFIER,
    redirect_uri: REDIRECT,
    resource: config.resourceUrl,
    ...extra,
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

beforeEach(() => {
  clock = NOW;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  db = seedWorkspace() as FakeFirestore & { asFirestore(): any };
  fetchMetadata = vi.fn();
  app = createMcpApp({
    db: db.asFirestore(),
    config,
    resolveClient: createClientResolver({ db: db.asFirestore(), fetch: fetchMetadata }),
    verifier: createTokenVerifier(db.asFirestore(), () => clock),
    deleteStoragePaths: vi.fn(),
    now: () => clock,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("discovery", () => {
  it("serves authorization server metadata", async () => {
    const response = await get("/.well-known/oauth-authorization-server");
    const metadata = await response.json();
    expect(metadata).toMatchObject({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/oauth/token`,
      registration_endpoint: `${ORIGIN}/oauth/register`,
      code_challenge_methods_supported: ["S256"],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    });
    expect(metadata.token_endpoint_auth_methods_supported).toContain("none");
  });

  it("serves protected resource metadata at the path-scoped and root URLs", async () => {
    for (const path of [
      "/.well-known/oauth-protected-resource/mcp",
      "/.well-known/oauth-protected-resource",
    ]) {
      expect(await (await get(path)).json()).toMatchObject({
        resource: config.resourceUrl,
        authorization_servers: [ORIGIN],
        scopes_supported: ["boards"],
      });
    }
  });

  it("challenges unauthenticated MCP requests with a 401 pointing at the metadata", async () => {
    const response = await app(
      new Request(`${ORIGIN}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(401);
    const challenge = response.headers.get("www-authenticate")!;
    expect(challenge).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`,
    );
    expect(response.headers.get("access-control-expose-headers")).toContain("www-authenticate");
  });

  it("answers CORS preflight requests, unknown paths and wrong methods", async () => {
    const preflight = await app(new Request(`${ORIGIN}/mcp`, { method: "OPTIONS" }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-headers")).toContain("authorization");
    expect((await get("/nope")).status).toBe(404);
    const wrongMethod = await get("/oauth/token");
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("POST");
  });
});

describe("full connection flow (DCR public client)", () => {
  it("registers, authorizes, exchanges, calls tools, refreshes and revokes", async () => {
    const { status, body: client } = await register();
    expect(status).toBe(201);
    expect(client.client_secret).toBeUndefined();

    const redirect = await authorizeAndApprove(client.client_id);
    expect(redirect.origin + redirect.pathname).toBe(REDIRECT);
    expect(redirect.searchParams.get("state")).toBe("st-123");
    expect(redirect.searchParams.get("iss")).toBe(ORIGIN);

    const tokens = await exchange(client.client_id, redirect.searchParams.get("code")!);
    expect(tokens.status).toBe(200);
    expect(tokens.body).toMatchObject({
      token_type: "Bearer",
      expires_in: 3600,
      scope: "boards offline_access",
    });

    const me = await callTool(app, tokens.body.access_token, "get_current_user");
    expect(me.structuredContent?.id).toBe(ALICE);

    // Refresh rotates: the new pair works, the old refresh token is spent.
    const refreshed = await postForm("/oauth/token", {
      grant_type: "refresh_token",
      client_id: client.client_id,
      refresh_token: tokens.body.refresh_token,
    });
    const rotated = await refreshed.json();
    expect(refreshed.status).toBe(200);
    expect(rotated.refresh_token).not.toBe(tokens.body.refresh_token);
    const reused = await postForm("/oauth/token", {
      grant_type: "refresh_token",
      client_id: client.client_id,
      refresh_token: tokens.body.refresh_token,
    });
    expect(reused.status).toBe(400);
    expect((await reused.json()).error).toBe("invalid_grant");

    expect((await rpc(app, rotated.access_token, "tools/list")).error).toBeUndefined();

    // Revoking the refresh token ends the connection, access token included.
    const revoked = await postForm("/oauth/revoke", {
      client_id: client.client_id,
      token: rotated.refresh_token,
      token_type_hint: "refresh_token",
    });
    expect(revoked.status).toBe(200);
    expect(db.list(OAUTH_COLLECTIONS.grants)).toEqual([]);
    const afterRevoke = await app(
      new Request(`${ORIGIN}/mcp`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${rotated.access_token}`,
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(afterRevoke.status).toBe(401);
  });

  it("can narrow scope on refresh but not widen it", async () => {
    const { body: client } = await register();
    const redirect = await authorizeAndApprove(client.client_id, { scope: "boards" });
    const { body: tokens } = await exchange(client.client_id, redirect.searchParams.get("code")!);
    expect(tokens.scope).toBe("boards");
    const widened = await postForm("/oauth/token", {
      grant_type: "refresh_token",
      client_id: client.client_id,
      refresh_token: tokens.refresh_token,
      scope: "boards admin",
    });
    expect((await widened.json()).error).toBe("invalid_scope");
  });

  it("rejects expired access tokens", async () => {
    const { body: client } = await register();
    const redirect = await authorizeAndApprove(client.client_id);
    const { body: tokens } = await exchange(client.client_id, redirect.searchParams.get("code")!);
    clock += 3_600_001;
    vi.setSystemTime(clock);
    const response = await app(
      new Request(`${ORIGIN}/mcp`, {
        method: "POST",
        headers: { authorization: `Bearer ${tokens.access_token}`, "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(401);
  });
});

describe("authorization code protections", () => {
  async function codeFor(clientId: string) {
    return (await authorizeAndApprove(clientId)).searchParams.get("code")!;
  }

  it("burns the code on a failed PKCE check", async () => {
    const { body: client } = await register();
    const code = await codeFor(client.client_id);
    const wrong = await exchange(client.client_id, code, { code_verifier: "wrong".padEnd(50, "y") });
    expect(wrong.body).toMatchObject({ error: "invalid_grant", error_description: "PKCE verification failed." });
    expect((await exchange(client.client_id, code)).body.error).toBe("invalid_grant");
  });

  it("rejects another client, another redirect, another resource or an expired code", async () => {
    const { body: client } = await register();
    const { body: other } = await register();

    expect((await exchange(other.client_id, await codeFor(client.client_id))).body.error_description).toMatch(
      /another client/,
    );
    expect(
      (await exchange(client.client_id, await codeFor(client.client_id), {
        redirect_uri: "https://evil.test/cb",
      })).body.error_description,
    ).toMatch(/redirect_uri/);
    expect(
      (await exchange(client.client_id, await codeFor(client.client_id), {
        resource: "https://elsewhere.test/mcp",
      })).body.error,
    ).toBe("invalid_target");

    const code = await codeFor(client.client_id);
    clock += 5 * 60_000 + 1;
    expect((await exchange(client.client_id, code)).body.error_description).toMatch(/expired/);
  });

  it("requires the token request's parameters", async () => {
    const { body: client } = await register();
    const response = await postForm("/oauth/token", {
      grant_type: "authorization_code",
      client_id: client.client_id,
    });
    expect(await response.json()).toMatchObject({ error: "invalid_request" });
    const unsupported = await postForm("/oauth/token", {
      grant_type: "client_credentials",
      client_id: client.client_id,
    });
    expect((await unsupported.json()).error).toBe("unsupported_grant_type");
  });
});

describe("confidential clients", () => {
  it("issues a secret by default and requires it at the token endpoint", async () => {
    const { body: client } = await register({ token_endpoint_auth_method: undefined });
    expect(client.token_endpoint_auth_method).toBe("client_secret_basic");
    expect(client.client_secret).toMatch(/^secret_/);

    const code = (await authorizeAndApprove(client.client_id)).searchParams.get("code")!;
    const noSecret = await exchange(client.client_id, code);
    expect(noSecret.status).toBe(401);
    expect(noSecret.body.error).toBe("invalid_client");

    const code2 = (await authorizeAndApprove(client.client_id)).searchParams.get("code")!;
    const basic = Buffer.from(
      `${encodeURIComponent(client.client_id)}:${encodeURIComponent(client.client_secret)}`,
    ).toString("base64");
    const ok = await postForm(
      "/oauth/token",
      {
        grant_type: "authorization_code",
        code: code2,
        code_verifier: VERIFIER,
        redirect_uri: REDIRECT,
      },
      { authorization: `Basic ${basic}` },
    );
    expect(ok.status).toBe(200);
  });

  it("accepts client_secret_post and rejects a wrong secret", async () => {
    const { body: client } = await register({ token_endpoint_auth_method: "client_secret_post" });
    const code = (await authorizeAndApprove(client.client_id)).searchParams.get("code")!;
    expect((await exchange(client.client_id, code, { client_secret: "nope" })).status).toBe(401);
    const code2 = (await authorizeAndApprove(client.client_id)).searchParams.get("code")!;
    const ok = await exchange(client.client_id, code2, { client_secret: client.client_secret });
    expect(ok.status).toBe(200);
  });
});

describe("client registration validation", () => {
  it.each([
    [{ redirect_uris: [] }, "invalid_client_metadata"],
    [{ redirect_uris: ["http://evil.test/cb"] }, "invalid_redirect_uri"],
    [{ redirect_uris: ["javascript:alert(1)"] }, "invalid_redirect_uri"],
    [{ redirect_uris: ["https://ok.test/cb#frag"] }, "invalid_redirect_uri"],
    [{ token_endpoint_auth_method: "private_key_jwt" }, "invalid_client_metadata"],
    [{ grant_types: ["client_credentials"] }, "invalid_client_metadata"],
    [{ response_types: ["token"] }, "invalid_client_metadata"],
    [{ client_name: 42 }, "invalid_client_metadata"],
  ])("rejects %j", async (metadata, error) => {
    const { status, body } = await register(metadata);
    expect(status).toBe(400);
    expect(body.error).toBe(error);
  });

  it("accepts loopback and native-app redirect URIs", async () => {
    const { status } = await register({
      redirect_uris: ["http://127.0.0.1/callback", "http://localhost:4000/cb", "myapp://oauth/callback"],
    });
    expect(status).toBe(201);
  });

  it("rejects a non-JSON body", async () => {
    const response = await app(
      new Request(`${ORIGIN}/oauth/register`, { method: "POST", body: "nope" }),
    );
    expect(response.status).toBe(400);
  });
});

describe("authorization endpoint", () => {
  it("shows an error page (never redirects) for unknown clients or unregistered redirects", async () => {
    const unknown = await get(authorizeUrl({ client_id: "client_missing" }));
    expect(unknown.status).toBe(400);
    expect(unknown.headers.get("content-type")).toContain("text/html");
    expect(await unknown.text()).toContain("isn&#39;t registered");

    const { body: client } = await register();
    const badRedirect = await get(
      authorizeUrl({ client_id: client.client_id, redirect_uri: "https://evil.test/cb" }),
    );
    expect(badRedirect.status).toBe(400);
    expect((await get("/oauth/authorize")).status).toBe(400);
  });

  it("redirects protocol errors back to the client with state and iss", async () => {
    const { body: client } = await register();
    const cases: [Record<string, string>, string][] = [
      [{ response_type: "token" }, "unsupported_response_type"],
      [{ code_challenge_method: "plain" }, "invalid_request"],
      [{ code_challenge: "short" }, "invalid_request"],
      [{ resource: "https://elsewhere.test/mcp" }, "invalid_target"],
    ];
    for (const [params, error] of cases) {
      const response = await get(authorizeUrl({ client_id: client.client_id, ...params }));
      const location = new URL(response.headers.get("location")!);
      expect(location.searchParams.get("error")).toBe(error);
      expect(location.searchParams.get("state")).toBe("st-123");
      expect(location.searchParams.get("iss")).toBe(ORIGIN);
    }
  });

  it("defaults the redirect when exactly one is registered", async () => {
    const { body: client } = await register();
    const response = await get(
      `/oauth/authorize?${new URLSearchParams({
        client_id: client.client_id,
        response_type: "code",
        code_challenge: CHALLENGE,
        code_challenge_method: "S256",
      })}`,
    );
    expect(response.headers.get("location")).toMatch(/\/connect\?request=/);

    const { body: multi } = await register({ redirect_uris: [REDIRECT, "https://b.test/cb"] });
    const missing = await get(
      `/oauth/authorize?client_id=${multi.client_id}&response_type=code&code_challenge=${CHALLENGE}&code_challenge_method=S256`,
    );
    expect(missing.status).toBe(400);
  });

  it("matches loopback redirects on any port", async () => {
    const { body: client } = await register({ redirect_uris: ["http://localhost/callback"] });
    const response = await get(
      authorizeUrl({ client_id: client.client_id, redirect_uri: "http://localhost:53682/callback" }),
    );
    expect(response.headers.get("location")).toMatch(/\/connect\?request=/);
    const wrongPath = await get(
      authorizeUrl({ client_id: client.client_id, redirect_uri: "http://localhost:53682/other" }),
    );
    expect(wrongPath.status).toBe(400);
  });
});

describe("consent callables", () => {
  async function pendingRequest(redirectUri = REDIRECT) {
    const { body: client } = await register({ redirect_uris: [redirectUri] });
    const response = await get(authorizeUrl({ client_id: client.client_id, redirect_uri: redirectUri }));
    return new URL(response.headers.get("location")!).searchParams.get("request")!;
  }

  it("describes the pending request for the consent screen", async () => {
    const requestId = await pendingRequest();
    expect(await runGetMcpConnectRequest(asUser({ requestId }), connectDeps())).toEqual({
      clientName: "Claude",
      clientUri: null,
      redirectHost: "claude.ai",
      isLoopbackRedirect: false,
      expiresAt: NOW + 10 * 60_000,
    });
  });

  it("flags loopback redirects", async () => {
    const requestId = await pendingRequest("http://127.0.0.1:3000/cb");
    const info = await runGetMcpConnectRequest(asUser({ requestId }), connectDeps());
    expect(info).toMatchObject({ redirectHost: "127.0.0.1", isLoopbackRedirect: true });
  });

  it("returns access_denied when the user declines, and consumes the request", async () => {
    const requestId = await pendingRequest();
    const { redirectUrl } = await runDecideMcpConnectRequest(
      asUser({ requestId, approve: false }),
      connectDeps(),
    );
    const url = new URL(redirectUrl);
    expect(url.searchParams.get("error")).toBe("access_denied");
    expect(url.searchParams.get("state")).toBe("st-123");
    await expect(
      runDecideMcpConnectRequest(asUser({ requestId, approve: true }), connectDeps()),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("expires requests and requires sign-in and a request id", async () => {
    const requestId = await pendingRequest();
    clock += 10 * 60_000 + 1;
    await expect(runGetMcpConnectRequest(asUser({ requestId }), connectDeps())).rejects.toMatchObject({
      code: "not-found",
    });
    await expect(
      runDecideMcpConnectRequest(asUser({ requestId, approve: true }), connectDeps()),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(
      runGetMcpConnectRequest({ data: { requestId } } as CallableRequest<unknown>, connectDeps()),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(runGetMcpConnectRequest(asUser({}), connectDeps())).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("binds the code to the approving user", async () => {
    const { body: client } = await register();
    const response = await get(authorizeUrl({ client_id: client.client_id }));
    const requestId = new URL(response.headers.get("location")!).searchParams.get("request")!;
    const { redirectUrl } = await runDecideMcpConnectRequest(
      asUser({ requestId, approve: true }, "u-bob"),
      connectDeps(),
    );
    const { body: tokens } = await exchange(client.client_id, new URL(redirectUrl).searchParams.get("code")!);
    const me = await callTool(app, tokens.access_token, "get_current_user");
    expect(me.structuredContent?.id).toBe("u-bob");
  });
});

describe("client ID metadata documents", () => {
  const CIMD = "https://claude.ai/oauth/claude-code-client-metadata";

  function serveDocument(doc: Record<string, unknown>) {
    fetchMetadata.mockResolvedValue(new Response(JSON.stringify(doc), { status: 200 }));
  }

  it("authorizes a client identified by its metadata URL, caching the document", async () => {
    serveDocument({
      client_id: CIMD,
      client_name: "Claude Code",
      redirect_uris: ["http://localhost/callback", "http://127.0.0.1/callback"],
      token_endpoint_auth_method: "none",
    });
    const redirect = "http://localhost:4242/callback";
    const response = await get(authorizeUrl({ client_id: CIMD, redirect_uri: redirect }));
    const requestId = new URL(response.headers.get("location")!).searchParams.get("request")!;
    const info = await runGetMcpConnectRequest(asUser({ requestId }), connectDeps());
    expect(info).toMatchObject({ clientName: "Claude Code", isLoopbackRedirect: true });

    const { redirectUrl } = await runDecideMcpConnectRequest(
      asUser({ requestId, approve: true }),
      connectDeps(),
    );
    const { status } = await exchange(CIMD, new URL(redirectUrl).searchParams.get("code")!, {
      redirect_uri: redirect,
    });
    expect(status).toBe(200);
    expect(fetchMetadata).toHaveBeenCalledTimes(1);
  });

  it("rejects documents that don't name themselves or have bad redirects", async () => {
    serveDocument({ client_id: "https://evil.test/client.json", redirect_uris: [REDIRECT] });
    expect((await get(authorizeUrl({ client_id: CIMD }))).status).toBe(400);

    serveDocument({ client_id: CIMD, redirect_uris: ["http://evil.test/cb"] });
    expect((await get(authorizeUrl({ client_id: CIMD }))).status).toBe(400);

    fetchMetadata.mockResolvedValue(new Response("nope", { status: 404 }));
    expect((await get(authorizeUrl({ client_id: CIMD }))).status).toBe(400);
  });

  it("never fetches internal-looking URLs", async () => {
    for (const clientId of [
      "https://127.0.0.1/client.json",
      "https://localhost/client.json",
      "https://[::1]/client.json",
      "http://plain.test/client.json",
      "https://no-path.test/",
    ]) {
      expect((await get(authorizeUrl({ client_id: clientId }))).status).toBe(400);
    }
    expect(fetchMetadata).not.toHaveBeenCalled();
  });
});

describe("token endpoint inputs", () => {
  it("accepts JSON bodies and rejects malformed ones", async () => {
    const { body: client } = await register();
    const code = (await authorizeAndApprove(client.client_id)).searchParams.get("code")!;
    const response = await postJson("/oauth/token", {
      grant_type: "authorization_code",
      client_id: client.client_id,
      code,
      code_verifier: VERIFIER,
    });
    expect(response.status).toBe(200);

    const malformed = await app(
      new Request(`${ORIGIN}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect((await malformed.json()).error).toBe("invalid_request");
  });

  it("rejects unknown clients and malformed Basic credentials", async () => {
    const unknown = await postForm("/oauth/token", { grant_type: "refresh_token", client_id: "client_x" });
    expect(unknown.status).toBe(401);
    const missing = await postForm("/oauth/token", { grant_type: "refresh_token" });
    expect(missing.status).toBe(401);
    const malformed = await postForm(
      "/oauth/token",
      { grant_type: "refresh_token" },
      { authorization: `Basic ${Buffer.from("no-colon").toString("base64")}` },
    );
    expect(malformed.status).toBe(401);
  });

  it("revocation ignores unknown tokens and other clients' tokens", async () => {
    const { body: client } = await register();
    const { body: other } = await register();
    const code = (await authorizeAndApprove(client.client_id)).searchParams.get("code")!;
    const { body: tokens } = await exchange(client.client_id, code);

    expect((await postForm("/oauth/revoke", { client_id: other.client_id, token: tokens.access_token })).status).toBe(200);
    expect(errorText(await callTool(app, tokens.access_token, "get_board", { boardId: "b3" }))).toMatch(
      /not found/,
    );
    expect((await postForm("/oauth/revoke", { client_id: client.client_id, token: "unknown" })).status).toBe(200);
    expect((await postForm("/oauth/revoke", { client_id: client.client_id })).status).toBe(400);

    await postForm("/oauth/revoke", { client_id: client.client_id, token: tokens.access_token });
    const after = await app(
      new Request(`${ORIGIN}/mcp`, {
        method: "POST",
        headers: { authorization: `Bearer ${tokens.access_token}`, "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(after.status).toBe(401);
  });
});
