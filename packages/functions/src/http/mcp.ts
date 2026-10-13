import { logger } from "firebase-functions/v2";
import { onRequest, type Request as FunctionsRequest } from "firebase-functions/v2/https";
import { getBucket, getDb } from "../firebase";
import { createMcpApp, type McpApp } from "../mcp/app";
import { APP_URL, createMcpConfig } from "../mcp/config";
import { createClientResolver } from "../oauth/clients";
import { createTokenVerifier } from "../oauth/verifier";

/** The bits of Express's response object the adapter writes to. */
export type NodeLikeResponse = {
  status(code: number): unknown;
  setHeader(name: string, value: string): unknown;
  write(chunk: Uint8Array): unknown;
  end(): unknown;
};

/**
 * Rebuild the incoming request as a web-standard `Request`. Firebase has
 * already consumed the body stream, so the raw bytes come from `rawBody`.
 * `originalUrl` keeps the full path Hosting forwarded (e.g. `/mcp`).
 */
export function toWebRequest(req: FunctionsRequest, origin: string): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(new URL(req.originalUrl || req.url, origin), {
    method: req.method,
    headers,
    body: hasBody && req.rawBody?.length ? new Uint8Array(req.rawBody) : undefined,
  });
}

/** Stream a web-standard `Response` back through Express. */
export async function sendWebResponse(
  res: NodeLikeResponse,
  response: Response,
): Promise<void> {
  res.status(response.status);
  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });
  if (response.body) {
    for await (const chunk of response.body) res.write(chunk);
  }
  res.end();
}

async function deleteStoragePaths(paths: string[]): Promise<void> {
  const bucket = getBucket();
  await Promise.all(
    paths.map((path) => bucket.file(path).delete({ ignoreNotFound: true })),
  );
}

// Built on first request (params like APP_URL can't be read at deploy-time
// module load) and reused while the instance stays warm, so the client
// metadata cache survives across requests.
let app: McpApp | undefined;
let origin = "";

/**
 * The remote MCP server, reached through Firebase Hosting rewrites on the app's
 * own domain (see firebase.json): `https://<app>/mcp` is the URL to add in
 * ChatGPT or Claude. Requests are stateless, so any instance can serve any
 * request.
 */
export const mcp = onRequest(
  { region: "us-central1", memory: "512MiB", timeoutSeconds: 60 },
  async (req, res) => {
    if (!app) {
      const config = createMcpConfig(APP_URL.value());
      const db = getDb();
      origin = config.appUrl;
      app = createMcpApp({
        db,
        config,
        resolveClient: createClientResolver({ db }),
        verifier: createTokenVerifier(db),
        deleteStoragePaths,
      });
      logger.info("MCP app initialized", { resource: config.resourceUrl });
    }
    await sendWebResponse(res, await app(toWebRequest(req, origin)));
  },
);
