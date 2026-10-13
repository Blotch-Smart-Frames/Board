import type { Firestore } from "firebase-admin/firestore";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { authenticateClient, type ClientResolver } from "./clients";
import { CORS_HEADERS, oauthErrorResponse, readParams } from "./http";
import { OAUTH_COLLECTIONS, hashSecret, type TokenDoc } from "./store";

// Same 500-writes-per-batch limit Firestore enforces everywhere.
const BATCH_LIMIT = 500;

/** Delete a grant and every token issued under it. */
export async function revokeGrant(db: Firestore, grantId: string): Promise<void> {
  const tokens = await db
    .collection(OAUTH_COLLECTIONS.tokens)
    .where("grantId", "==", grantId)
    .get();
  const refs = [
    db.collection(OAUTH_COLLECTIONS.grants).doc(grantId),
    ...tokens.docs.map((doc) => doc.ref),
  ];
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
    await batch.commit();
  }
}

/**
 * Token revocation (RFC 7009, POST /oauth/revoke). Revoking a refresh token
 * ends the whole connection (its grant and all tokens); revoking an access
 * token drops just that token. Per the RFC, unknown tokens still get a 200.
 */
export async function handleRevoke(
  request: Request,
  deps: { db: Firestore; resolveClient: ClientResolver },
): Promise<Response> {
  try {
    const params = await readParams(request);
    const client = await authenticateClient(request, params, deps.resolveClient);
    const token = params.get("token");
    if (!token) {
      throw new OAuthError(OAuthErrorCode.InvalidRequest, "Missing token.");
    }

    const ref = deps.db.collection(OAUTH_COLLECTIONS.tokens).doc(hashSecret(token));
    const stored = (await ref.get()).data() as TokenDoc | undefined;
    if (stored && stored.clientId === client.clientId) {
      if (stored.kind === "refresh") await revokeGrant(deps.db, stored.grantId);
      else await ref.delete();
    }
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    if (error instanceof OAuthError) return oauthErrorResponse(error);
    throw error;
  }
}
