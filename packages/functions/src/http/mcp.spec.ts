import { describe, expect, it, vi } from "vitest";
import type { Request as FunctionsRequest } from "firebase-functions/v2/https";

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("firebase-functions/params", () => ({
  defineString: () => ({ value: () => "https://board.test" }),
}));
// Shim onRequest to return the raw handler so tests can invoke it directly.
vi.mock("firebase-functions/v2/https", () => ({
  onRequest: (_opts: unknown, handler: unknown) => handler,
}));
vi.mock("../firebase", () => ({ getDb: vi.fn(), getBucket: vi.fn() }));
vi.mock("../mcp/app", () => ({ createMcpApp: vi.fn() }));

import { getBucket, getDb } from "../firebase";
import { createMcpApp } from "../mcp/app";
import { mcp, sendWebResponse, toWebRequest } from "./mcp";

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

describe("mcp", () => {
  const handler = mcp as unknown as (
    req: FunctionsRequest,
    res: ReturnType<typeof fakeResponse>,
  ) => Promise<void>;
  const fakeResponse = () => ({ status: vi.fn(), setHeader: vi.fn(), write: vi.fn(), end: vi.fn() });
  const get = (path: string) =>
    ({ method: "GET", originalUrl: path, url: path, headers: {} }) as unknown as FunctionsRequest;

  it("builds the app on first request, reuses it, and answers through Express", async () => {
    vi.mocked(getDb).mockReturnValue({} as never);
    const app = vi.fn(async (request: Request) => new Response(new URL(request.url).pathname, { status: 202 }));
    vi.mocked(createMcpApp).mockReturnValue(app);

    const first = fakeResponse();
    await handler(get("/mcp"), first);
    await handler(get("/oauth/authorize"), fakeResponse());

    expect(createMcpApp).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createMcpApp).mock.calls[0]![0].config).toEqual({
      appUrl: "https://board.test",
      issuer: "https://board.test",
      resourceUrl: "https://board.test/mcp",
    });
    expect(app.mock.calls.map(([request]) => request.url)).toEqual([
      "https://board.test/mcp",
      "https://board.test/oauth/authorize",
    ]);
    expect(first.status).toHaveBeenCalledWith(202);
    expect(Buffer.concat(first.write.mock.calls.map(([chunk]) => chunk)).toString()).toBe("/mcp");
  });

  it("deletes attachment files from the default bucket, ignoring missing ones", async () => {
    const file = { delete: vi.fn().mockResolvedValue(undefined) };
    const bucket = { file: vi.fn(() => file) };
    vi.mocked(getBucket).mockReturnValue(bucket as never);
    vi.mocked(getDb).mockReturnValue({} as never);
    vi.mocked(createMcpApp).mockReturnValue(vi.fn(async () => new Response(null)));
    // The app is built once per instance; any request makes sure it exists.
    await handler(get("/mcp"), fakeResponse());
    const { deleteStoragePaths } = vi.mocked(createMcpApp).mock.calls[0]![0];

    await deleteStoragePaths(["boards/b1/a.png", "boards/b1/b.pdf"]);

    expect(bucket.file.mock.calls).toEqual([["boards/b1/a.png"], ["boards/b1/b.pdf"]]);
    expect(file.delete).toHaveBeenCalledTimes(2);
    expect(file.delete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });
});
