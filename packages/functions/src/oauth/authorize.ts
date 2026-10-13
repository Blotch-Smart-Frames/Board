import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { McpConfig } from "../mcp/config";
import { redirectUriAllowed, type ClientResolver } from "./clients";
import { htmlErrorResponse } from "./http";
import {
  BOARDS_SCOPE,
  CONNECT_REQUEST_TTL_SECONDS,
  OAUTH_COLLECTIONS,
  OFFLINE_ACCESS_SCOPE,
  generateSecret,
  hashSecret,
  type ConnectRequestDoc,
} from "./store";

export type AuthorizeDeps = {
  db: Firestore;
  config: McpConfig;
  resolveClient: ClientResolver;
  now?: () => number;
};

// RFC 7636 §4.2: BASE64URL(SHA256(verifier)) is always 43 characters, but the
// challenge grammar allows 43–128 unreserved characters.
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

/**
 * The client's redirect URI with the given parameters plus `iss` (RFC 9207),
 * which lets the client confirm the response came from the issuer it started
 * with. We advertise `authorization_response_iss_parameter_supported`, so it
 * goes on every response, errors included.
 */
export function buildRedirectUrl(
  redirectUri: string,
  params: Record<string, string | null | undefined>,
  issuer: string,
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set("iss", issuer);
  return url.toString();
}

/** Compare RFC 8707 resource identifiers, ignoring a trailing slash and fragment. */
export function sameResource(a: string, b: string): boolean {
  const normalize = (value: string) => {
    try {
      const url = new URL(value);
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    } catch {
      return value;
    }
  };
  return normalize(a) === normalize(b);
}

/**
 * Scopes to grant for a requested `scope` string. There's one real scope, so
 * every grant gets it; `offline_access` is echoed back when asked for.
 * Unknown scopes are ignored rather than refused (RFC 6749 §3.3 lets the
 * server grant a different scope than requested).
 */
export function grantedScopes(requested: string | null): string[] {
  const asked = (requested ?? "").split(/\s+/);
  return asked.includes(OFFLINE_ACCESS_SCOPE)
    ? [BOARDS_SCOPE, OFFLINE_ACCESS_SCOPE]
    : [BOARDS_SCOPE];
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location, "cache-control": "no-store" },
  });
}

/**
 * The authorization endpoint (GET /oauth/authorize). Validates the request,
 * parks it in Firestore, and sends the browser to the web app's consent screen
 * (`/connect?request=…`), where the signed-in user approves or denies it via
 * the `decideMcpConnectRequest` callable. That callable issues the
 * authorization code, so this endpoint never needs the user's identity.
 */
export async function handleAuthorize(
  request: Request,
  deps: AuthorizeDeps,
): Promise<Response> {
  const { config } = deps;
  const params = new URL(request.url).searchParams;

  const clientId = params.get("client_id");
  if (!clientId) {
    return htmlErrorResponse("The connection request is missing a client_id.");
  }
  const client = await deps.resolveClient(clientId);
  if (!client) {
    return htmlErrorResponse(
      "This app isn't registered with Board. Go back to the app and try connecting again.",
    );
  }

  let redirectUri = params.get("redirect_uri");
  if (!redirectUri) {
    // Allowed only when there's exactly one registered URI (RFC 6749 §3.1.2.3).
    if (client.redirectUris.length !== 1) {
      return htmlErrorResponse("The connection request is missing a redirect_uri.");
    }
    redirectUri = client.redirectUris[0] as string;
  }
  if (!redirectUriAllowed(client, redirectUri)) {
    return htmlErrorResponse(
      "The address this app wants to return to isn't registered for it.",
    );
  }

  // From here on, problems are reported back to the (verified) redirect URI.
  const state = params.get("state");
  const fail = (error: string, description: string) =>
    redirect(
      buildRedirectUrl(
        redirectUri,
        { error, error_description: description, state },
        config.issuer,
      ),
    );

  if (params.get("response_type") !== "code") {
    return fail("unsupported_response_type", "Only response_type=code is supported.");
  }
  const codeChallenge = params.get("code_challenge");
  if (!codeChallenge || params.get("code_challenge_method") !== "S256") {
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }
  if (!CODE_CHALLENGE_PATTERN.test(codeChallenge)) {
    return fail("invalid_request", "Malformed code_challenge.");
  }
  const resource = params.get("resource");
  if (resource && !sameResource(resource, config.resourceUrl)) {
    return fail("invalid_target", `Unknown resource; use ${config.resourceUrl}.`);
  }

  const now = deps.now?.() ?? Date.now();
  const requestId = generateSecret();
  const doc: ConnectRequestDoc = {
    clientId: client.clientId,
    clientName: client.clientName,
    clientUri: client.clientUri,
    redirectUri,
    codeChallenge,
    state,
    scopes: grantedScopes(params.get("scope")),
    resource: config.resourceUrl,
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + CONNECT_REQUEST_TTL_SECONDS * 1000),
  };
  await deps.db
    .collection(OAUTH_COLLECTIONS.requests)
    .doc(hashSecret(requestId))
    .set(doc);

  const consentUrl = new URL("/connect", config.appUrl);
  consentUrl.searchParams.set("request", requestId);
  return redirect(consentUrl.toString());
}
