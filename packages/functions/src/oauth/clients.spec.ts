import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));
vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  createFakeFirestore,
  type FakeFirestore,
} from "../testing/fake-firestore";
import {
  createClientResolver,
  handleRegister,
  redirectUriAllowed,
  redirectUriProblem,
  type OAuthClient,
} from "./clients";
import { OAUTH_COLLECTIONS } from "./store";

const CIMD = "https://app.example.com/oauth/client.json";
const CALLBACK = "https://app.example.com/callback";

let db: FakeFirestore & { asFirestore(): any };

beforeEach(() => {
  db = createFakeFirestore();
});

function register(body: unknown) {
  return handleRegister(
    new Request("https://board.test/oauth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    db.asFirestore(),
  );
}

async function registerError(body: unknown) {
  const response = await register(body);
  return {
    status: response.status,
    ...((await response.json()) as Record<string, string>),
  };
}

describe("redirectUriProblem", () => {
  it("rejects URIs that are too long", () => {
    expect(
      redirectUriProblem(`https://app.example.com/${"a".repeat(2000)}`),
    ).toBe("is too long");
  });

  it("rejects relative URIs", () => {
    expect(redirectUriProblem("/callback")).toBe("is not an absolute URL");
  });
});

describe("redirectUriAllowed", () => {
  const client: OAuthClient = {
    clientId: "client_x",
    clientName: "App",
    clientUri: null,
    redirectUris: ["http://127.0.0.1/callback"],
    tokenEndpointAuthMethod: "none",
    clientSecretHash: null,
  };

  it("refuses a requested URI that isn't a URL", () => {
    expect(redirectUriAllowed(client, "not a url")).toBe(false);
  });
});

describe("handleRegister", () => {
  it("rejects a body that isn't a JSON object", async () => {
    expect(
      await registerError(["https://app.example.com/callback"]),
    ).toMatchObject({
      status: 400,
      error: "invalid_client_metadata",
    });
    expect(await registerError(null)).toMatchObject({ status: 400 });
  });

  it("caps the number of redirect URIs", async () => {
    const redirect_uris = Array.from(
      { length: 11 },
      (_, i) => `${CALLBACK}/${i}`,
    );
    expect(await registerError({ redirect_uris })).toMatchObject({
      status: 400,
      error: "invalid_client_metadata",
      error_description: "At most 10 redirect_uris are allowed.",
    });
  });

  it("requires redirect URIs to be strings", async () => {
    expect(await registerError({ redirect_uris: [42] })).toMatchObject({
      status: 400,
      error_description: "redirect_uris must be strings.",
    });
  });

  it("names unnamed apps and keeps a valid client_uri", async () => {
    const response = await register({
      redirect_uris: [CALLBACK],
      token_endpoint_auth_method: "none",
      client_uri: "https://app.example.com",
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      client_name: "Unnamed app",
      client_uri: "https://app.example.com",
    });
    const stored = await db
      .collection(OAUTH_COLLECTIONS.clients)
      .doc(body.client_id as string)
      .get();
    expect(stored.data()).toMatchObject({
      clientUri: "https://app.example.com",
    });
  });

  it("treats a blank client_name as unnamed", async () => {
    const body = await (
      await register({ redirect_uris: [CALLBACK], client_name: "  " })
    ).json();
    expect(body).toMatchObject({ client_name: "Unnamed app" });
  });

  it("rejects an overly long client_name", async () => {
    expect(
      await registerError({
        redirect_uris: [CALLBACK],
        client_name: "x".repeat(201),
      }),
    ).toMatchObject({
      status: 400,
      error_description: "client_name is too long.",
    });
  });

  it.each([
    ["an http URL", "http://app.example.com"],
    ["a malformed URL", "not a url"],
    ["an overly long URL", `https://app.example.com/${"a".repeat(2000)}`],
  ])("drops a client_uri that is %s", async (_, client_uri) => {
    const body = await (
      await register({ redirect_uris: [CALLBACK], client_uri })
    ).json();
    expect(body).not.toHaveProperty("client_uri");
  });

  it("rethrows unexpected storage failures", async () => {
    const failing = {
      collection: () => ({
        doc: () => ({ set: () => Promise.reject(new Error("firestore down")) }),
      }),
    };
    await expect(
      handleRegister(
        new Request("https://board.test/oauth/register", {
          method: "POST",
          body: JSON.stringify({ redirect_uris: [CALLBACK] }),
        }),
        failing as never,
      ),
    ).rejects.toThrow("firestore down");
  });
});

describe("createClientResolver metadata documents", () => {
  function resolveWith(body: string) {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(body, { status: 200 }));
    return createClientResolver({ db: db.asFirestore(), fetch })(CIMD);
  }

  it("rejects documents over the size limit", async () => {
    const padding = "x".repeat(64 * 1024);
    expect(
      await resolveWith(
        JSON.stringify({ client_id: CIMD, redirect_uris: [CALLBACK], padding }),
      ),
    ).toBeNull();
  });

  it("rejects documents without redirect URIs", async () => {
    expect(await resolveWith(JSON.stringify({ client_id: CIMD }))).toBeNull();
  });

  it("falls back to the host name when the document has no usable name", async () => {
    const client = await resolveWith(
      JSON.stringify({
        client_id: CIMD,
        redirect_uris: [CALLBACK],
        client_name: 7,
      }),
    );
    expect(client).toMatchObject({
      clientName: "app.example.com",
      clientUri: null,
    });
  });
});
