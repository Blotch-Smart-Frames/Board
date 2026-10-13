import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));
vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../firebase", () => ({ getDb: vi.fn(), getBucket: vi.fn() }));

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  type OAuthClientProvider,
} from "@modelcontextprotocol/client";
import { ALICE, seedWorkspace } from "../testing/mcp-fixtures";
import { runDecideMcpConnectRequest } from "../callable/mcp-connect";
import { createClientResolver } from "../oauth/clients";
import { createTokenVerifier } from "../oauth/verifier";
import { createMcpApp } from "./app";
import { createMcpConfig } from "./config";

/**
 * Connects the official MCP TypeScript client — an independent OAuth and
 * Streamable HTTP implementation — to the server over real HTTP, playing the
 * part ChatGPT or Claude would: discovery from the 401, dynamic registration,
 * PKCE, the consent redirect, code exchange, then tool calls.
 */

const db = seedWorkspace();
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  const config = createMcpConfig(baseUrl);
  const firestore = db.asFirestore();
  const app = createMcpApp({
    db: firestore,
    config,
    resolveClient: createClientResolver({ db: firestore }),
    verifier: createTokenVerifier(firestore),
    deleteStoragePaths: async () => {},
  });

  server.on("request", async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(name, value);
    }
    const response = await app(
      new Request(new URL(req.url ?? "/", baseUrl), {
        method: req.method,
        headers,
        body: body.length > 0 ? body : undefined,
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

class InMemoryOAuthProvider implements OAuthClientProvider {
  readonly redirectUrl = "http://localhost:53682/callback";
  private client?: Awaited<ReturnType<OAuthClientProvider["clientInformation"]>>;
  private saved?: Awaited<ReturnType<OAuthClientProvider["tokens"]>>;
  private verifier = "";
  authorizationUrl?: URL;

  get clientMetadata() {
    return {
      client_name: "Interop test client",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  clientInformation() {
    return this.client;
  }

  saveClientInformation(info: NonNullable<typeof this.client>) {
    this.client = info;
  }

  tokens() {
    return this.saved;
  }

  saveTokens(tokens: NonNullable<typeof this.saved>) {
    this.saved = tokens;
  }

  redirectToAuthorization(url: URL) {
    this.authorizationUrl = url;
  }

  saveCodeVerifier(verifier: string) {
    this.verifier = verifier;
  }

  codeVerifier() {
    return this.verifier;
  }
}

describe("official MCP client", () => {
  it("connects through the full OAuth flow and calls tools", async () => {
    const provider = new InMemoryOAuthProvider();
    const mcpUrl = new URL(`${baseUrl}/mcp`);

    // 1. First connect hits the 401, discovers the AS, registers and asks
    //    the "browser" to open the authorization URL.
    const first = new Client({ name: "interop", version: "1.0.0" });
    await expect(
      first.connect(new StreamableHTTPClientTransport(mcpUrl, { authProvider: provider })),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(provider.authorizationUrl?.pathname).toBe("/oauth/authorize");

    // 2. The browser follows it to the consent screen, where Alice approves.
    const authorize = await fetch(provider.authorizationUrl!, { redirect: "manual" });
    const consent = new URL(authorize.headers.get("location")!);
    expect(consent.pathname).toBe("/connect");
    const { redirectUrl } = await runDecideMcpConnectRequest(
      { auth: { uid: ALICE }, data: { requestId: consent.searchParams.get("request"), approve: true } } as unknown as CallableRequest<unknown>,
      { db: db.asFirestore(), issuer: baseUrl, now: Date.now },
    );

    // 3. The client receives the callback and exchanges the code.
    const callback = new URL(redirectUrl);
    expect(callback.searchParams.get("state")).toBe(provider.authorizationUrl!.searchParams.get("state"));
    const transport = new StreamableHTTPClientTransport(mcpUrl, { authProvider: provider });
    await transport.finishAuth(callback.searchParams);

    // 4. Now it's connected as Alice.
    const client = new Client({ name: "interop", version: "1.0.0" });
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain("list_my_tasks");

    const result = await client.callTool({ name: "list_my_tasks", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { count: number }).count).toBe(3);
    await client.close();
  });
});
