import { logger } from "firebase-functions/v2";
import {
  onCall,
  HttpsError,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type {
  DecideMcpConnectRequestResult,
  McpConnectRequestInfo,
} from "@blotch/model";
import { getDb } from "../firebase";
import { APP_URL, createMcpConfig } from "../mcp/config";
import { buildRedirectUrl } from "../oauth/authorize";
import { isLoopbackHost } from "../oauth/clients";
import {
  AUTHORIZATION_CODE_TTL_SECONDS,
  OAUTH_COLLECTIONS,
  generateSecret,
  hashSecret,
  type AuthorizationCodeDoc,
  type ConnectRequestDoc,
} from "../oauth/store";

export type McpConnectDeps = {
  db: Firestore;
  issuer: string;
  now: () => number;
};

function resolveDeps(deps?: Partial<McpConnectDeps>): McpConnectDeps {
  return {
    db: deps?.db ?? getDb(),
    issuer: deps?.issuer ?? createMcpConfig(APP_URL.value()).issuer,
    now: deps?.now ?? Date.now,
  };
}

function requireUid(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  return uid;
}

function requireRequestId(request: CallableRequest<unknown>): string {
  const data = (request.data ?? {}) as Record<string, unknown>;
  if (typeof data.requestId !== "string" || data.requestId.length === 0) {
    throw new HttpsError("invalid-argument", '"requestId" is required.');
  }
  return data.requestId;
}

const expired = () =>
  new HttpsError(
    "not-found",
    "This connection request has expired or was already used. Go back to your AI app and connect again.",
  );

/**
 * Details of a pending connection for the consent screen. The request is
 * keyed by its id's hash, so only someone holding the link can see it.
 */
export async function runGetMcpConnectRequest(
  request: CallableRequest<unknown>,
  deps?: Partial<McpConnectDeps>,
): Promise<McpConnectRequestInfo> {
  requireUid(request);
  const requestId = requireRequestId(request);
  const { db, now } = resolveDeps(deps);

  const snap = await db
    .collection(OAUTH_COLLECTIONS.requests)
    .doc(hashSecret(requestId))
    .get();
  const stored = snap.data() as ConnectRequestDoc | undefined;
  if (!stored || stored.expiresAt.toMillis() <= now()) throw expired();

  const redirect = new URL(stored.redirectUri);
  return {
    clientName: stored.clientName,
    clientUri: stored.clientUri,
    // Custom-scheme redirects (native apps) may have no host; show the scheme.
    redirectHost: redirect.hostname || redirect.protocol.replace(/:$/, ""),
    isLoopbackRedirect: isLoopbackHost(redirect.hostname),
    expiresAt: stored.expiresAt.toMillis(),
  };
}

/**
 * Records the signed-in user's decision on a pending connection. The request
 * is consumed either way; approving mints a single-use authorization code
 * bound to the user, the client, the redirect URI and the PKCE challenge.
 * Returns where the browser should go next (the client's redirect URI).
 */
export async function runDecideMcpConnectRequest(
  request: CallableRequest<unknown>,
  deps?: Partial<McpConnectDeps>,
): Promise<DecideMcpConnectRequestResult> {
  const uid = requireUid(request);
  const requestId = requireRequestId(request);
  const approve = (request.data as Record<string, unknown>).approve === true;
  const { db, issuer, now } = resolveDeps(deps);
  const requestRef = db
    .collection(OAUTH_COLLECTIONS.requests)
    .doc(hashSecret(requestId));

  const redirectUrl = await db.runTransaction(async (tx) => {
    const snap = await tx.get(requestRef);
    const stored = snap.data() as ConnectRequestDoc | undefined;
    if (!stored) return null;
    tx.delete(requestRef);
    if (stored.expiresAt.toMillis() <= now()) return null;

    if (!approve) {
      return buildRedirectUrl(
        stored.redirectUri,
        {
          error: "access_denied",
          error_description: "The user declined to connect Board.",
          state: stored.state,
        },
        issuer,
      );
    }

    const code = generateSecret("code_");
    const issuedAt = now();
    tx.set(db.collection(OAUTH_COLLECTIONS.codes).doc(hashSecret(code)), {
      clientId: stored.clientId,
      clientName: stored.clientName,
      uid,
      redirectUri: stored.redirectUri,
      codeChallenge: stored.codeChallenge,
      scopes: stored.scopes,
      resource: stored.resource,
      createdAt: Timestamp.fromMillis(issuedAt),
      expiresAt: Timestamp.fromMillis(
        issuedAt + AUTHORIZATION_CODE_TTL_SECONDS * 1000,
      ),
    } satisfies AuthorizationCodeDoc);
    return buildRedirectUrl(
      stored.redirectUri,
      { code, state: stored.state },
      issuer,
    );
  });

  if (!redirectUrl) throw expired();
  logger.info("MCP connection decided", { uid, approve });
  return { redirectUrl };
}

export const getMcpConnectRequest = onCall({ region: "us-central1" }, (request) =>
  runGetMcpConnectRequest(request),
);

export const decideMcpConnectRequest = onCall(
  { region: "us-central1" },
  (request) => runDecideMcpConnectRequest(request),
);
