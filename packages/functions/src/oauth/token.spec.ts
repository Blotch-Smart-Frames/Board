import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));

import {
  Timestamp,
  createFakeFirestore,
  type FakeFirestore,
} from "../testing/fake-firestore";
import { NOW, config } from "../testing/mcp-fixtures";
import type { OAuthClient } from "./clients";
import { OAUTH_COLLECTIONS, hashSecret } from "./store";
import { handleToken } from "./token";

const CLIENT: OAuthClient = {
  clientId: "client_a",
  clientName: "Claude",
  clientUri: null,
  redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
  tokenEndpointAuthMethod: "none",
  clientSecretHash: null,
};
const REFRESH_TOKEN = "board_rt_test";
const tokenPath = `${OAUTH_COLLECTIONS.tokens}/${hashSecret(REFRESH_TOKEN)}`;

let db: ReturnType<typeof createFakeFirestore>;

const resolveClient = async (clientId: string) =>
  clientId === CLIENT.clientId ? CLIENT : null;

function seedRefreshToken(
  target: FakeFirestore,
  overrides: Record<string, unknown> = {},
) {
  target.seed(`${OAUTH_COLLECTIONS.grants}/grant-1`, {
    uid: "u-alice",
    clientId: CLIENT.clientId,
    clientName: CLIENT.clientName,
    scopes: ["boards", "offline_access"],
    resource: config.resourceUrl,
    createdAt: Timestamp.fromMillis(NOW),
    lastUsedAt: Timestamp.fromMillis(NOW),
  });
  target.seed(tokenPath, {
    kind: "refresh",
    uid: "u-alice",
    clientId: CLIENT.clientId,
    grantId: "grant-1",
    scopes: ["boards", "offline_access"],
    resource: config.resourceUrl,
    createdAt: Timestamp.fromMillis(NOW),
    expiresAt: Timestamp.fromMillis(NOW + 60_000),
    ...overrides,
  });
}

function refresh(
  params: Record<string, string> = {},
  clock: { now?: () => number } = { now: () => NOW },
) {
  return handleToken(
    new Request(`${config.issuer}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: CLIENT.clientId,
        refresh_token: REFRESH_TOKEN,
        ...params,
      }).toString(),
    }),
    { db: db.asFirestore(), config, resolveClient, ...clock },
  );
}

beforeEach(() => {
  db = createFakeFirestore();
});

describe("handleToken refresh_token grant", () => {
  it("rejects a refresh token issued to another client without spending it", async () => {
    seedRefreshToken(db, { clientId: "client_other" });
    const response = await refresh();
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "invalid_grant",
      error_description: "Refresh token was issued to another client.",
    });
    expect(db.read(tokenPath)).toBeDefined();
  });

  it("rejects and deletes an expired refresh token", async () => {
    seedRefreshToken(db, { expiresAt: Timestamp.fromMillis(NOW) });
    const response = await refresh();
    expect(await response.json()).toMatchObject({
      error: "invalid_grant",
      error_description: "Refresh token expired.",
    });
    expect(db.read(tokenPath)).toBeUndefined();
  });

  it("rejects a refresh token whose grant was revoked", async () => {
    seedRefreshToken(db);
    await db.doc(`${OAUTH_COLLECTIONS.grants}/grant-1`).delete();
    const response = await refresh();
    expect(await response.json()).toMatchObject({
      error: "invalid_grant",
      error_description: "This connection was revoked.",
    });
    expect(db.read(tokenPath)).toBeUndefined();
  });

  it("narrows the scope when asked for a subset of the grant", async () => {
    seedRefreshToken(db);
    const response = await refresh({ scope: "boards" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      scope: string;
      access_token: string;
    };
    expect(body.scope).toBe("boards");
    expect(
      db.read(`${OAUTH_COLLECTIONS.tokens}/${hashSecret(body.access_token)}`),
    ).toMatchObject({
      kind: "access",
      scopes: ["boards"],
      grantId: "grant-1",
    });
  });

  it("falls back to the system clock when no clock is injected", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW + 120_000);
    try {
      seedRefreshToken(db);
      const response = await refresh({}, {});
      expect(await response.json()).toMatchObject({
        error_description: "Refresh token expired.",
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("handleToken errors", () => {
  it("rethrows failures that aren't OAuth errors", async () => {
    const failure = new Error("Firestore unavailable");
    const response = handleToken(
      new Request(`${config.issuer}/oauth/token`, {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: "client_a",
        }),
      }),
      {
        db: db.asFirestore(),
        config,
        resolveClient: async () => {
          throw failure;
        },
      },
    );
    await expect(response).rejects.toBe(failure);
  });
});
