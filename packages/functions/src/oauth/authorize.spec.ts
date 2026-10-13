import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));

import { createFakeFirestore } from "../testing/fake-firestore";
import { NOW, config } from "../testing/mcp-fixtures";
import { handleAuthorize, sameResource } from "./authorize";
import type { OAuthClient } from "./clients";
import {
  CONNECT_REQUEST_TTL_SECONDS,
  OAUTH_COLLECTIONS,
  hashSecret,
  pkceS256,
} from "./store";

const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const CLIENT: OAuthClient = {
  clientId: "client_a",
  clientName: "Claude",
  clientUri: null,
  redirectUris: [REDIRECT],
  tokenEndpointAuthMethod: "none",
  clientSecretHash: null,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("sameResource", () => {
  it("normalizes a trailing slash and fragment", () => {
    expect(sameResource(`${config.resourceUrl}/#top`, config.resourceUrl)).toBe(
      true,
    );
  });

  it("compares values that aren't URLs verbatim", () => {
    expect(sameResource("not a url", "not a url")).toBe(true);
    expect(sameResource("not a url", config.resourceUrl)).toBe(false);
  });
});

describe("handleAuthorize", () => {
  it("falls back to the system clock when no clock is injected", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    const params = new URLSearchParams({
      client_id: CLIENT.clientId,
      response_type: "code",
      code_challenge: pkceS256("verifier-".padEnd(64, "x")),
      code_challenge_method: "S256",
    });

    const response = await handleAuthorize(
      new Request(`${config.issuer}/oauth/authorize?${params}`),
      { db: db.asFirestore(), config, resolveClient: async () => CLIENT },
    );

    expect(response.status).toBe(302);
    const requestId = new URL(
      response.headers.get("location")!,
    ).searchParams.get("request")!;
    const stored = db.read(
      `${OAUTH_COLLECTIONS.requests}/${hashSecret(requestId)}`,
    );
    expect(stored).toMatchObject({ redirectUri: REDIRECT, state: null });
    expect((stored!.expiresAt as { toMillis(): number }).toMillis()).toBe(
      NOW + CONNECT_REQUEST_TTL_SECONDS * 1000,
    );
  });
});
