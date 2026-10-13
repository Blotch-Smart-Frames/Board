import { logger } from "firebase-functions/v2";
import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore } from "firebase-admin/firestore";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ToolError } from "../board-data";

/** Per-request dependencies every tool closes over. */
export type ToolContext = {
  db: Firestore;
  /** The signed-in user the access token was issued to. */
  uid: string;
  appUrl: string;
  now: () => number;
  /** Delete Storage objects (task attachments) by path. Best effort. */
  deleteStoragePaths: (paths: string[]) => Promise<void>;
};

export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
};

export const WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

/**
 * Run a tool body and shape its result. The returned object goes out both as
 * `structuredContent` and as JSON text (for clients that only read text).
 * Expected failures (`ToolError`, or the `HttpsError`s shared callable code
 * throws) come back as `isError` results the model can read and act on;
 * anything else is logged and reported without internals.
 */
export async function runTool(
  name: string,
  body: () => Promise<Record<string, unknown>>,
): Promise<CallToolResult> {
  try {
    const result = await body();
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  } catch (error) {
    if (error instanceof ToolError || error instanceof HttpsError) {
      return { isError: true, content: [{ type: "text", text: error.message }] };
    }
    logger.error("MCP tool failed", { tool: name, error: String(error) });
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "Board hit an unexpected error running this tool. Try again shortly.",
        },
      ],
    };
  }
}

// --- Shared input fields ----------------------------------------------------

export const boardIdField = z
  .string()
  .min(1)
  .describe("Board id, from list_boards or a task result.");

export const taskIdField = z
  .string()
  .min(1)
  .describe("Task id, from get_board, list_my_tasks or search_tasks.");

export const dateField = z
  .string()
  .describe(
    "A date as YYYY-MM-DD, or an ISO 8601 date-time with a timezone offset.",
  );

export const colorField = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #3B82F6.")
  .describe("Hex color like #3B82F6.");

export const memberRefsField = z
  .array(z.string().min(1))
  .max(20)
  .describe(
    'Board members by name, email or id. "me" means the signed-in user.',
  );

export const labelRefsField = z
  .array(z.string().min(1))
  .max(20)
  .describe("Labels by name or id (see get_board).");

/** The 16-color palette the web app offers for labels and cards. */
export const PALETTE = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#FBBF24",
  "#84CC16",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
];
