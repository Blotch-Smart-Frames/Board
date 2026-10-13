import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FirestoreTimestamp } from "@blotch/model";

/**
 * Top-level Firestore collections backing the OAuth authorization server.
 * firestore.rules has no `match` for them, so client SDKs can never read or
 * write them; only the Admin SDK (these functions) can. Secrets — client
 * secrets, authorization codes, access and refresh tokens — are stored only as
 * SHA-256 hashes, keyed by that hash.
 */
export const OAUTH_COLLECTIONS = {
  clients: "oauthClients",
  requests: "oauthConnectRequests",
  codes: "oauthCodes",
  tokens: "oauthTokens",
  grants: "oauthGrants",
} as const;

/** The single scope: read and change the boards the user can access. */
export const BOARDS_SCOPE = "boards";
/** Accepted for clients (e.g. Claude) that ask for it to get a refresh token. */
export const OFFLINE_ACCESS_SCOPE = "offline_access";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;
export const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;
export const CONNECT_REQUEST_TTL_SECONDS = 10 * 60;

export type TokenEndpointAuthMethod =
  | "none"
  | "client_secret_post"
  | "client_secret_basic";

/** A dynamically registered client (RFC 7591). */
export type ClientDoc = {
  clientName: string;
  clientUri: string | null;
  redirectUris: string[];
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  clientSecretHash: string | null;
  createdAt: FirestoreTimestamp;
};

/** An authorization request waiting for the user on the consent screen. */
export type ConnectRequestDoc = {
  clientId: string;
  clientName: string;
  clientUri: string | null;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scopes: string[];
  resource: string;
  createdAt: FirestoreTimestamp;
  expiresAt: FirestoreTimestamp;
};

export type AuthorizationCodeDoc = {
  clientId: string;
  clientName: string;
  uid: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
  createdAt: FirestoreTimestamp;
  expiresAt: FirestoreTimestamp;
};

/**
 * One user's consent for one client. Every token issued under it carries its
 * id, so revoking a refresh token can sweep the whole token family.
 */
export type GrantDoc = {
  uid: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  resource: string;
  createdAt: FirestoreTimestamp;
  lastUsedAt: FirestoreTimestamp;
};

export type TokenDoc = {
  kind: "access" | "refresh";
  uid: string;
  clientId: string;
  grantId: string;
  scopes: string[];
  resource: string;
  createdAt: FirestoreTimestamp;
  expiresAt: FirestoreTimestamp;
};

/** A fresh 256-bit random secret, base64url-encoded, with an optional prefix. */
export function generateSecret(prefix = ""): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time check of a presented secret against its stored hash. */
export function secretMatches(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** The PKCE S256 transform: BASE64URL(SHA256(code_verifier)). */
export function pkceS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
