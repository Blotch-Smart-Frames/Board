import type { Firestore } from "firebase-admin/firestore";
import {
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import { OAUTH_COLLECTIONS, hashSecret, type TokenDoc } from "./store";

/** What the MCP tools read from a verified token's `AuthInfo.extra`. */
export type BoardAuthExtra = { uid: string; grantId: string };

/**
 * Verifies opaque access tokens by looking up their hash. Access tokens are
 * short-lived (an hour) and deleted on revocation, so a missing document means
 * revoked or never issued.
 */
export function createTokenVerifier(
  db: Firestore,
  now: () => number = Date.now,
): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const snap = await db
        .collection(OAUTH_COLLECTIONS.tokens)
        .doc(hashSecret(token))
        .get();
      const stored = snap.data() as TokenDoc | undefined;
      if (!stored || stored.kind !== "access") {
        throw new OAuthError(OAuthErrorCode.InvalidToken, "Unknown or revoked access token.");
      }
      const expiresAtMs = stored.expiresAt.toMillis();
      if (expiresAtMs <= now()) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, "Access token expired.");
      }
      const extra: BoardAuthExtra = { uid: stored.uid, grantId: stored.grantId };
      return {
        token,
        clientId: stored.clientId,
        scopes: stored.scopes,
        expiresAt: Math.floor(expiresAtMs / 1000),
        resource: new URL(stored.resource),
        extra,
      };
    },
  };
}
