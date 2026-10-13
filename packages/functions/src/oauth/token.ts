import {
  Timestamp,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import type { McpConfig } from "../mcp/config";
import { sameResource } from "./authorize";
import {
  authenticateClient,
  type ClientResolver,
  type OAuthClient,
} from "./clients";
import { jsonResponse, oauthErrorResponse, readParams } from "./http";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  OAUTH_COLLECTIONS,
  REFRESH_TOKEN_TTL_SECONDS,
  generateSecret,
  hashSecret,
  pkceS256,
  type AuthorizationCodeDoc,
  type GrantDoc,
  type TokenDoc,
} from "./store";

export type TokenDeps = {
  db: Firestore;
  config: McpConfig;
  resolveClient: ClientResolver;
  now?: () => number;
};

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

type GrantRef = Pick<GrantDoc, "uid" | "clientId" | "scopes" | "resource"> & {
  grantId: string;
};

function required(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  if (!value) {
    throw new OAuthError(OAuthErrorCode.InvalidRequest, `Missing ${name}.`);
  }
  return value;
}

/** Queue a fresh access + refresh token pair for a grant inside `tx`. */
function writeTokens(
  db: Firestore,
  tx: Transaction,
  grant: GrantRef,
  now: number,
): TokenResponse {
  const accessToken = generateSecret("board_at_");
  const refreshToken = generateSecret("board_rt_");
  const tokens = db.collection(OAUTH_COLLECTIONS.tokens);
  const base = {
    uid: grant.uid,
    clientId: grant.clientId,
    grantId: grant.grantId,
    scopes: grant.scopes,
    resource: grant.resource,
    createdAt: Timestamp.fromMillis(now),
  };
  tx.set(tokens.doc(hashSecret(accessToken)), {
    ...base,
    kind: "access",
    expiresAt: Timestamp.fromMillis(now + ACCESS_TOKEN_TTL_SECONDS * 1000),
  } satisfies TokenDoc);
  tx.set(tokens.doc(hashSecret(refreshToken)), {
    ...base,
    kind: "refresh",
    expiresAt: Timestamp.fromMillis(now + REFRESH_TOKEN_TTL_SECONDS * 1000),
  } satisfies TokenDoc);
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: grant.scopes.join(" "),
  };
}

const invalidGrant = (message: string) =>
  new OAuthError(OAuthErrorCode.InvalidGrant, message);

/**
 * Exchange an authorization code. The code is deleted in the same transaction
 * that reads it, so it works exactly once — even a failed PKCE check burns it,
 * which stops anyone guessing verifiers against a stolen code.
 */
async function exchangeCode(
  params: URLSearchParams,
  client: OAuthClient,
  deps: TokenDeps,
  now: number,
): Promise<TokenResponse> {
  const code = required(params, "code");
  const verifier = required(params, "code_verifier");
  const redirectUri = params.get("redirect_uri");
  const resource = params.get("resource");
  const { db } = deps;
  const codeRef = db.collection(OAUTH_COLLECTIONS.codes).doc(hashSecret(code));

  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(codeRef);
    if (!snap.exists) return { error: invalidGrant("Unknown or used authorization code.") };
    tx.delete(codeRef);

    const stored = snap.data() as AuthorizationCodeDoc;
    if (stored.expiresAt.toMillis() <= now) {
      return { error: invalidGrant("Authorization code expired.") };
    }
    if (stored.clientId !== client.clientId) {
      return { error: invalidGrant("Authorization code was issued to another client.") };
    }
    if (redirectUri && redirectUri !== stored.redirectUri) {
      return { error: invalidGrant("redirect_uri does not match the authorization request.") };
    }
    if (pkceS256(verifier) !== stored.codeChallenge) {
      return { error: invalidGrant("PKCE verification failed.") };
    }
    if (resource && !sameResource(resource, stored.resource)) {
      return {
        error: new OAuthError(OAuthErrorCode.InvalidTarget, "Resource does not match the grant."),
      };
    }

    const grantRef = db.collection(OAUTH_COLLECTIONS.grants).doc();
    tx.set(grantRef, {
      uid: stored.uid,
      clientId: stored.clientId,
      clientName: stored.clientName,
      scopes: stored.scopes,
      resource: stored.resource,
      createdAt: Timestamp.fromMillis(now),
      lastUsedAt: Timestamp.fromMillis(now),
    } satisfies GrantDoc);
    return {
      tokens: writeTokens(db, tx, { ...stored, grantId: grantRef.id }, now),
    };
  });

  if ("error" in outcome) throw outcome.error;
  return outcome.tokens;
}

/**
 * Refresh-token grant with rotation (OAuth 2.1 §4.3.1, required for public
 * clients): the presented token is consumed and a new pair issued. A refresh
 * token survives only while its grant does, so revoking the grant (or the
 * user disconnecting) ends the session.
 */
async function refresh(
  params: URLSearchParams,
  client: OAuthClient,
  deps: TokenDeps,
  now: number,
): Promise<TokenResponse> {
  const token = required(params, "refresh_token");
  const requestedScope = params.get("scope");
  const { db } = deps;
  const tokenRef = db.collection(OAUTH_COLLECTIONS.tokens).doc(hashSecret(token));

  const outcome = await db.runTransaction(async (tx) => {
    // Firestore transactions need every read before the first write.
    const snap = await tx.get(tokenRef);
    const stored = snap.data() as TokenDoc | undefined;
    if (!stored || stored.kind !== "refresh") {
      return { error: invalidGrant("Unknown or revoked refresh token.") };
    }
    const grantRef = db.collection(OAUTH_COLLECTIONS.grants).doc(stored.grantId);
    const grantSnap = await tx.get(grantRef);

    if (stored.clientId !== client.clientId) {
      return { error: invalidGrant("Refresh token was issued to another client.") };
    }
    tx.delete(tokenRef);
    if (stored.expiresAt.toMillis() <= now) {
      return { error: invalidGrant("Refresh token expired.") };
    }
    if (!grantSnap.exists) {
      return { error: invalidGrant("This connection was revoked.") };
    }

    let scopes = stored.scopes;
    if (requestedScope) {
      const asked = requestedScope.split(/\s+/).filter(Boolean);
      if (!asked.every((scope) => stored.scopes.includes(scope))) {
        return {
          error: new OAuthError(
            OAuthErrorCode.InvalidScope,
            "Requested scope exceeds the original grant.",
          ),
        };
      }
      scopes = asked;
    }

    tx.update(grantRef, { lastUsedAt: Timestamp.fromMillis(now) });
    return {
      tokens: writeTokens(db, tx, { ...stored, scopes, grantId: stored.grantId }, now),
    };
  });

  if ("error" in outcome) throw outcome.error;
  return outcome.tokens;
}

/** The token endpoint (POST /oauth/token). */
export async function handleToken(
  request: Request,
  deps: TokenDeps,
): Promise<Response> {
  try {
    const params = await readParams(request);
    const client = await authenticateClient(request, params, deps.resolveClient);
    const now = deps.now?.() ?? Date.now();
    const grantType = params.get("grant_type");
    if (grantType === "authorization_code") {
      return jsonResponse(await exchangeCode(params, client, deps, now));
    }
    if (grantType === "refresh_token") {
      return jsonResponse(await refresh(params, client, deps, now));
    }
    throw new OAuthError(
      OAuthErrorCode.UnsupportedGrantType,
      "Supported grant types: authorization_code, refresh_token.",
    );
  } catch (error) {
    if (error instanceof OAuthError) return oauthErrorResponse(error);
    throw error;
  }
}
