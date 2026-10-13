import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";

/**
 * CORS headers for every OAuth and MCP response. Browser-based MCP clients
 * (e.g. the MCP Inspector) call these endpoints cross-origin; access is
 * controlled by bearer tokens, never cookies, so a wildcard origin is safe.
 */
export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers":
    "authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
  "access-control-expose-headers":
    "www-authenticate, mcp-protocol-version, mcp-session-id",
  "access-control-max-age": "86400",
};

/** Token responses carry credentials and must never be cached (RFC 6749 §5.1). */
const NO_STORE = { "cache-control": "no-store", pragma: "no-cache" };

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...NO_STORE,
      ...CORS_HEADERS,
      ...headers,
    },
  });
}

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function oauthErrorResponse(error: OAuthError): Response {
  const status =
    error.code === OAuthErrorCode.InvalidClient
      ? 401
      : error.code === OAuthErrorCode.ServerError
        ? 500
        : 400;
  return jsonResponse(error.toResponseObject(), status);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A plain error page for authorization requests that can't be bounced back to
 * the client (unknown client or unregistered redirect URI — redirecting there
 * would turn this endpoint into an open redirect, RFC 6749 §4.1.2.1).
 */
export function htmlErrorResponse(message: string, status = 400): Response {
  const body = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Board</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem;">
<h1 style="font-size: 1.25rem;">Can't connect to Board</h1>
<p>${escapeHtml(message)}</p>
</body>
</html>`;
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...NO_STORE },
  });
}

/**
 * Read OAuth request parameters from a POST body. The token, revocation and
 * authorization endpoints take `application/x-www-form-urlencoded` (RFC 6749);
 * JSON is accepted too because some clients send it.
 */
export async function readParams(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get("content-type") ?? "";
  const text = await request.text();
  if (!type.includes("application/json")) return new URLSearchParams(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new OAuthError(OAuthErrorCode.InvalidRequest, "Malformed JSON body.");
  }
  const params = new URLSearchParams();
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") params.set(key, value);
    }
  }
  return params;
}
