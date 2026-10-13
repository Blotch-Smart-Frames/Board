import { logger } from "firebase-functions/v2";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import {
  OAUTH_COLLECTIONS,
  generateSecret,
  hashSecret,
  secretMatches,
  type ClientDoc,
  type TokenEndpointAuthMethod,
} from "./store";
import { jsonResponse, oauthErrorResponse } from "./http";

/** An OAuth client, whether registered with us (DCR) or self-described (CIMD). */
export type OAuthClient = {
  clientId: string;
  clientName: string;
  clientUri: string | null;
  redirectUris: string[];
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  clientSecretHash: string | null;
};

export type ClientResolver = (clientId: string) => Promise<OAuthClient | null>;

const AUTH_METHODS: readonly TokenEndpointAuthMethod[] = [
  "none",
  "client_secret_post",
  "client_secret_basic",
];
const MAX_REDIRECT_URIS = 10;
const MAX_URI_LENGTH = 2000;
const MAX_CLIENT_NAME_LENGTH = 200;
const METADATA_DOCUMENT_MAX_BYTES = 64 * 1024;
const METADATA_DOCUMENT_TIMEOUT_MS = 5000;
const METADATA_CACHE_TTL_MS = 10 * 60 * 1000;

// Schemes a native app may not claim for its private-use redirect URI.
const FORBIDDEN_SCHEMES = new Set([
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
  "about:",
  "blob:",
  "ftp:",
  "ws:",
  "wss:",
]);

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

/**
 * Why a redirect URI can't be registered, or null when it's acceptable:
 * HTTPS anywhere, plain HTTP only on loopback (native apps, RFC 8252 §7.3), or
 * a private-use scheme (RFC 8252 §7.1). Fragments are never allowed.
 */
export function redirectUriProblem(uri: string): string | null {
  if (uri.length > MAX_URI_LENGTH) return "is too long";
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return "is not an absolute URL";
  }
  if (url.hash) return "must not contain a fragment";
  if (url.protocol === "https:") return null;
  if (url.protocol === "http:") {
    return isLoopbackHost(url.hostname)
      ? null
      : "must use https unless it points at localhost";
  }
  if (FORBIDDEN_SCHEMES.has(url.protocol)) return "uses a forbidden scheme";
  return null;
}

/**
 * Whether `requested` is one of the client's registered redirect URIs. Exact
 * string match, except loopback HTTP URIs match on any port: native clients
 * such as Claude Code bind an ephemeral port per session (RFC 8252 §7.3).
 */
export function redirectUriAllowed(
  client: OAuthClient,
  requested: string,
): boolean {
  if (client.redirectUris.includes(requested)) return true;
  let target: URL;
  try {
    target = new URL(requested);
  } catch {
    return false;
  }
  if (target.protocol !== "http:" || !isLoopbackHost(target.hostname)) {
    return false;
  }
  return client.redirectUris.some((uri) => {
    const registered = new URL(uri);
    return (
      registered.protocol === "http:" &&
      registered.hostname === target.hostname &&
      registered.pathname === target.pathname &&
      registered.search === target.search
    );
  });
}

function invalidMetadata(message: string): never {
  throw new OAuthError(OAuthErrorCode.InvalidClientMetadata, message);
}

function optionalHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_URI_LENGTH) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function readRedirectUris(value: unknown, error: (message: string) => never) {
  if (!Array.isArray(value) || value.length === 0) {
    error("redirect_uris must be a non-empty array.");
  }
  if (value.length > MAX_REDIRECT_URIS) {
    error(`At most ${MAX_REDIRECT_URIS} redirect_uris are allowed.`);
  }
  return value.map((uri) => {
    if (typeof uri !== "string") error("redirect_uris must be strings.");
    const problem = redirectUriProblem(uri);
    if (problem) {
      throw new OAuthError(
        OAuthErrorCode.InvalidRedirectUri,
        `Redirect URI ${uri} ${problem}.`,
      );
    }
    return uri;
  });
}

/**
 * Dynamic Client Registration (RFC 7591). Any app may register; what protects
 * users is the consent screen, which names the app and where it redirects.
 * Clients asking for a secret-based auth method (or not saying, which per RFC
 * 7591 means `client_secret_basic`) get a secret; public clients use `none`.
 */
export async function handleRegister(
  request: Request,
  db: Firestore,
): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      invalidMetadata("Body must be a JSON object.");
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      invalidMetadata("Body must be a JSON object.");
    }
    const metadata = body as Record<string, unknown>;

    const redirectUris = readRedirectUris(metadata.redirect_uris, invalidMetadata);

    const method = metadata.token_endpoint_auth_method ?? "client_secret_basic";
    if (!AUTH_METHODS.includes(method as TokenEndpointAuthMethod)) {
      invalidMetadata(
        `token_endpoint_auth_method must be one of ${AUTH_METHODS.join(", ")}.`,
      );
    }
    const tokenEndpointAuthMethod = method as TokenEndpointAuthMethod;

    const grantTypes = metadata.grant_types ?? ["authorization_code"];
    if (
      !Array.isArray(grantTypes) ||
      !grantTypes.every(
        (grant) => grant === "authorization_code" || grant === "refresh_token",
      )
    ) {
      invalidMetadata(
        "Only the authorization_code and refresh_token grants are supported.",
      );
    }
    const responseTypes = metadata.response_types ?? ["code"];
    if (
      !Array.isArray(responseTypes) ||
      !responseTypes.every((type) => type === "code")
    ) {
      invalidMetadata("Only the code response type is supported.");
    }

    const rawName = metadata.client_name;
    if (rawName !== undefined && typeof rawName !== "string") {
      invalidMetadata("client_name must be a string.");
    }
    const clientName = (rawName ?? "").trim() || "Unnamed app";
    if (clientName.length > MAX_CLIENT_NAME_LENGTH) {
      invalidMetadata("client_name is too long.");
    }
    const clientUri = optionalHttpsUrl(metadata.client_uri);

    const clientId = generateSecret("client_");
    const clientSecret =
      tokenEndpointAuthMethod === "none" ? null : generateSecret("secret_");
    const createdAt = Timestamp.now();
    const doc: ClientDoc = {
      clientName,
      clientUri,
      redirectUris,
      tokenEndpointAuthMethod,
      clientSecretHash: clientSecret ? hashSecret(clientSecret) : null,
      createdAt,
    };
    await db.collection(OAUTH_COLLECTIONS.clients).doc(clientId).set(doc);

    return jsonResponse(
      {
        client_id: clientId,
        client_id_issued_at: createdAt.seconds,
        ...(clientSecret
          ? { client_secret: clientSecret, client_secret_expires_at: 0 }
          : {}),
        client_name: clientName,
        ...(clientUri ? { client_uri: clientUri } : {}),
        redirect_uris: redirectUris,
        token_endpoint_auth_method: tokenEndpointAuthMethod,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
      201,
    );
  } catch (error) {
    if (error instanceof OAuthError) return oauthErrorResponse(error);
    throw error;
  }
}

/**
 * Whether a client_id is a Client ID Metadata Document URL (the MCP spec's
 * CIMD): an HTTPS URL with a path, on a named host. IP literals and localhost
 * are refused so the fetch below can't be pointed at internal addresses.
 */
export function isMetadataDocumentClientId(clientId: string): boolean {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return false;
  }
  const host = url.hostname;
  return (
    url.protocol === "https:" &&
    url.pathname !== "/" &&
    !url.username &&
    !url.password &&
    !url.hash &&
    host !== "localhost" &&
    !host.endsWith(".localhost") &&
    !/^[\d.]+$/.test(host) &&
    !host.startsWith("[")
  );
}

async function fetchMetadataDocument(
  clientId: string,
  fetchImpl: typeof fetch,
): Promise<OAuthClient | null> {
  try {
    const response = await fetchImpl(clientId, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(METADATA_DOCUMENT_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > METADATA_DOCUMENT_MAX_BYTES) return null;
    const doc = JSON.parse(text) as Record<string, unknown>;
    // The document must name itself, or anyone could host a copy of another
    // client's metadata (with their own redirect URIs) under its client_id.
    if (doc?.client_id !== clientId) return null;
    const fail = (): never => {
      throw new Error("invalid metadata document");
    };
    const redirectUris = readRedirectUris(doc.redirect_uris, fail);
    const name = typeof doc.client_name === "string" ? doc.client_name.trim() : "";
    return {
      clientId,
      clientName:
        name.slice(0, MAX_CLIENT_NAME_LENGTH) || new URL(clientId).hostname,
      clientUri: optionalHttpsUrl(doc.client_uri),
      redirectUris,
      // Metadata-document clients are public clients: we only offer `none`
      // to them (Claude and ChatGPT both pick it from our advertised list).
      tokenEndpointAuthMethod: "none",
      clientSecretHash: null,
    };
  } catch (error) {
    logger.warn("Rejected client metadata document", {
      clientId,
      error: String(error),
    });
    return null;
  }
}

/**
 * Looks up clients by id: registered clients from Firestore, metadata-document
 * clients by fetching (and briefly caching) their document. Create one per
 * function instance so the cache is shared across requests.
 */
export function createClientResolver(deps: {
  db: Firestore;
  fetch?: typeof fetch;
  now?: () => number;
}): ClientResolver {
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const cache = new Map<string, { client: OAuthClient; expiresAt: number }>();

  return async (clientId) => {
    if (isMetadataDocumentClientId(clientId)) {
      const cached = cache.get(clientId);
      if (cached && cached.expiresAt > now()) return cached.client;
      const client = await fetchMetadataDocument(clientId, fetchImpl);
      if (client) {
        cache.set(clientId, { client, expiresAt: now() + METADATA_CACHE_TTL_MS });
      }
      return client;
    }
    if (!clientId.startsWith("client_")) return null;
    const snap = await deps.db
      .collection(OAUTH_COLLECTIONS.clients)
      .doc(clientId)
      .get();
    if (!snap.exists) return null;
    const doc = snap.data() as ClientDoc;
    return {
      clientId,
      clientName: doc.clientName,
      clientUri: doc.clientUri,
      redirectUris: doc.redirectUris,
      tokenEndpointAuthMethod: doc.tokenEndpointAuthMethod,
      clientSecretHash: doc.clientSecretHash,
    };
  };
}

/**
 * Client authentication at the token and revocation endpoints (RFC 6749
 * §2.3): HTTP Basic, or `client_id` (+ `client_secret`) in the body. Public
 * clients only identify themselves; confidential ones must present their
 * secret.
 */
export async function authenticateClient(
  request: Request,
  params: URLSearchParams,
  resolveClient: ClientResolver,
): Promise<OAuthClient> {
  let clientId = params.get("client_id");
  let secret = params.get("client_secret");

  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(authorization.slice(6).trim(), "base64").toString(
      "utf8",
    );
    const separator = decoded.indexOf(":");
    if (separator < 0) {
      throw new OAuthError(OAuthErrorCode.InvalidClient, "Malformed Basic credentials.");
    }
    clientId = decodeURIComponent(decoded.slice(0, separator));
    secret = decodeURIComponent(decoded.slice(separator + 1));
  }

  if (!clientId) {
    throw new OAuthError(OAuthErrorCode.InvalidClient, "Missing client_id.");
  }
  const client = await resolveClient(clientId);
  if (!client) {
    throw new OAuthError(OAuthErrorCode.InvalidClient, "Unknown client.");
  }
  if (client.tokenEndpointAuthMethod !== "none") {
    if (
      !secret ||
      !client.clientSecretHash ||
      !secretMatches(secret, client.clientSecretHash)
    ) {
      throw new OAuthError(
        OAuthErrorCode.InvalidClient,
        "Client authentication failed.",
      );
    }
  }
  return client;
}
