import { describe, expect, it, vi } from "vitest";
import type { Request as FunctionsRequest } from "firebase-functions/v2/https";

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../firebase", () => ({ getDb: vi.fn(), getBucket: vi.fn() }));

import { sendWebResponse, toWebRequest } from "./mcp";

describe("toWebRequest", () => {
  it("rebuilds the request with its full path, headers and raw body", async () => {
    const request = toWebRequest(
      {
        method: "POST",
        originalUrl: "/oauth/token?x=1",
        url: "/token",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-forwarded-for": ["1.1.1.1", "2.2.2.2"],
          "x-missing": undefined,
        },
        rawBody: Buffer.from("grant_type=refresh_token"),
      } as unknown as FunctionsRequest,
      "https://board.test",
    );
    expect(request.url).toBe("https://board.test/oauth/token?x=1");
    expect(request.headers.get("x-forwarded-for")).toBe("1.1.1.1, 2.2.2.2");
    expect(await request.text()).toBe("grant_type=refresh_token");
  });

  it("sends no body for GET", () => {
    const request = toWebRequest(
      { method: "GET", originalUrl: "", url: "/mcp", headers: {}, rawBody: Buffer.from("x") } as unknown as FunctionsRequest,
      "https://board.test",
    );
    expect(request.url).toBe("https://board.test/mcp");
    expect(request.body).toBeNull();
  });
});

describe("sendWebResponse", () => {
  it("copies status and headers and streams the body", async () => {
    const res = { status: vi.fn(), setHeader: vi.fn(), write: vi.fn(), end: vi.fn() };
    await sendWebResponse(
      res,
      new Response("hello", { status: 201, headers: { "x-test": "1" } }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.setHeader).toHaveBeenCalledWith("x-test", "1");
    expect(Buffer.concat(res.write.mock.calls.map(([chunk]) => chunk)).toString()).toBe("hello");
    expect(res.end).toHaveBeenCalled();
  });

  it("ends empty responses", async () => {
    const res = { status: vi.fn(), setHeader: vi.fn(), write: vi.fn(), end: vi.fn() };
    await sendWebResponse(res, new Response(null, { status: 204 }));
    expect(res.write).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });
});
