import { describe, expect, it } from "vitest";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { oauthErrorResponse, readParams } from "./http";

const URL_BASE = "https://board.test/oauth/token";

describe("oauthErrorResponse", () => {
  it.each([
    [OAuthErrorCode.InvalidClient, 401],
    [OAuthErrorCode.ServerError, 500],
    [OAuthErrorCode.InvalidGrant, 400],
  ])("maps %s to HTTP %i", async (code, status) => {
    const response = oauthErrorResponse(new OAuthError(code, "nope"));
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({
      error: code,
      error_description: "nope",
    });
  });
});

describe("readParams", () => {
  const post = (
    body: NonNullable<RequestInit["body"]>,
    headers: Record<string, string> = {},
  ) => readParams(new Request(URL_BASE, { method: "POST", headers, body }));

  it("parses a body sent without a content type as form data", async () => {
    const params = await post(
      new TextEncoder().encode("grant_type=refresh_token"),
    );
    expect(params.get("grant_type")).toBe("refresh_token");
  });

  it("keeps only string values from a JSON object", async () => {
    const params = await post(
      JSON.stringify({ client_id: "abc", expires_in: 60 }),
      {
        "content-type": "application/json",
      },
    );
    expect([...params.entries()]).toEqual([["client_id", "abc"]]);
  });

  it.each(['["a"]', "null", '"text"'])(
    "ignores a JSON body that isn't an object (%s)",
    async (body) => {
      const params = await post(body, { "content-type": "application/json" });
      expect([...params.entries()]).toEqual([]);
    },
  );
});
