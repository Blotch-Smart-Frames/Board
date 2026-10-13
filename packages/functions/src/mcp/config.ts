import { defineString } from "firebase-functions/params";

/**
 * Public origin of the web app. Firebase Hosting rewrites `/mcp`, `/oauth/**`
 * and the `/.well-known/oauth-*` documents on this origin to the `mcp`
 * function (see firebase.json), so it doubles as the OAuth issuer and the base
 * of the MCP server URL people paste into ChatGPT or Claude. Change the
 * default if the app moves to a custom domain: OAuth clients compare the
 * issuer and resource URLs exactly.
 */
export const APP_URL = defineString("APP_URL", {
  default: "https://board-by-blotch.web.app",
  description:
    "Public origin of the Board web app; the MCP server and OAuth endpoints are served from it.",
});

export type McpConfig = {
  /** Origin of the web app, e.g. `https://board.example.com` (no trailing slash). */
  appUrl: string;
  /** OAuth issuer identifier. Must match the AS metadata and `iss` exactly. */
  issuer: string;
  /** The MCP endpoint, which is also the OAuth protected-resource identifier. */
  resourceUrl: string;
};

export function createMcpConfig(appUrl: string): McpConfig {
  const origin = new URL(appUrl).origin;
  return { appUrl: origin, issuer: origin, resourceUrl: `${origin}/mcp` };
}
