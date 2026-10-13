import { logger } from "firebase-functions/v2";
import type { Firestore } from "firebase-admin/firestore";
import {
  buildOAuthProtectedResourceMetadata,
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  oauthMetadataResponse,
  requireBearerAuth,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import { handleAuthorize } from "../oauth/authorize";
import { handleRegister, type ClientResolver } from "../oauth/clients";
import { CORS_HEADERS, jsonResponse, withCors } from "../oauth/http";
import { authMetadataOptions } from "../oauth/metadata";
import { handleRevoke } from "../oauth/revoke";
import { BOARDS_SCOPE } from "../oauth/store";
import { handleToken } from "../oauth/token";
import type { BoardAuthExtra } from "../oauth/verifier";
import type { McpConfig } from "./config";
import { createBoardMcpServer } from "./server";

export type McpAppDeps = {
  db: Firestore;
  config: McpConfig;
  resolveClient: ClientResolver;
  verifier: OAuthTokenVerifier;
  deleteStoragePaths: (paths: string[]) => Promise<void>;
  now?: () => number;
};

export type McpApp = (request: Request) => Promise<Response>;

const ROUTE_METHODS: Record<string, string> = {
  "/oauth/register": "POST",
  "/oauth/authorize": "GET",
  "/oauth/token": "POST",
  "/oauth/revoke": "POST",
};

/**
 * The whole HTTP surface behind the `mcp` function, as a web-standard
 * `Request -> Response` handler:
 *
 * - `/.well-known/oauth-protected-resource[/mcp]` and
 *   `/.well-known/oauth-authorization-server` — discovery documents
 * - `/oauth/register|authorize|token|revoke` — the authorization server
 * - `/mcp` — the MCP endpoint (Streamable HTTP, stateless), behind a bearer
 *   token check that answers 401 + `WWW-Authenticate` to start sign-in
 */
export function createMcpApp(deps: McpAppDeps): McpApp {
  const { config, db } = deps;
  const now = deps.now ?? Date.now;
  const metadataOptions = authMetadataOptions(config);
  // Validates the issuer up front, so a bad APP_URL fails at cold start.
  const protectedResource = buildOAuthProtectedResourceMetadata(metadataOptions);
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(
    new URL(config.resourceUrl),
  );
  const authenticate = requireBearerAuth({
    verifier: deps.verifier,
    requiredScopes: [BOARDS_SCOPE],
    resourceMetadataUrl,
    expectedResource: new URL(config.resourceUrl),
  });
  const mcpHandler = createMcpHandler(
    ({ authInfo }) =>
      createBoardMcpServer({
        db,
        uid: (authInfo?.extra as BoardAuthExtra).uid,
        appUrl: config.appUrl,
        now,
        deleteStoragePaths: deps.deleteStoragePaths,
      }),
    {
      onerror: (error) => logger.warn("MCP request rejected", { error: String(error) }),
    },
  );
  const oauthDeps = { ...deps, now };

  async function route(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const discovery = oauthMetadataResponse(request, metadataOptions);
    if (discovery) return discovery;
    // Some clients probe the root document rather than the path-scoped one.
    if (pathname === "/.well-known/oauth-protected-resource" && request.method === "GET") {
      return jsonResponse(protectedResource, 200, { "cache-control": "public, max-age=3600" });
    }

    if (pathname === "/mcp") {
      const auth = await authenticate(request);
      if (auth instanceof Response) return withCors(auth);
      return withCors(await mcpHandler.fetch(request, { authInfo: auth }));
    }

    const method = ROUTE_METHODS[pathname];
    if (!method) return jsonResponse({ error: "not_found" }, 404);
    if (request.method !== method) {
      return jsonResponse({ error: "method_not_allowed" }, 405, { allow: method });
    }
    switch (pathname) {
      case "/oauth/register":
        return handleRegister(request, db);
      case "/oauth/authorize":
        return handleAuthorize(request, oauthDeps);
      case "/oauth/token":
        return handleToken(request, oauthDeps);
      default:
        return handleRevoke(request, oauthDeps);
    }
  }

  return async (request) => {
    try {
      return await route(request);
    } catch (error) {
      logger.error("MCP app request failed", {
        path: new URL(request.url).pathname,
        error: String(error),
      });
      return jsonResponse(
        { error: "server_error", error_description: "Unexpected error." },
        500,
      );
    }
  };
}
