import { McpServer } from "@modelcontextprotocol/server";
import { registerBoardTools } from "./tools/board-tools";
import { registerReadTools } from "./tools/read-tools";
import { registerTaskTools } from "./tools/task-tools";
import type { ToolContext } from "./tools/shared";

const INSTRUCTIONS = `Board is a kanban app. Boards have lists (columns, e.g. "To Do", "In Progress", "Done"), and lists hold tasks (tickets).

- Start with list_boards, list_my_tasks or get_board. Use ids from earlier results; lists, labels and people can also be given by name.
- Tasks live on a board, so task tools need both boardId and taskId.
- A non-archival list holds at most 20 active tasks. Moving a task into a list marked "archival" archives it; moving it out restores it.
- Only board members can be assigned. Dates are ISO 8601; a plain YYYY-MM-DD date is fine.
- Every change is made as the signed-in user and shows in the task's history.
- Confirm with the user before deleting tasks or comments.`;

/**
 * A fresh MCP server exposing Board to one signed-in user. Built per request
 * (the HTTP handler is stateless), so every tool closes over that user's uid.
 */
export function createBoardMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer(
    { name: "board", title: "Board", version: "1.0.0", websiteUrl: ctx.appUrl },
    { instructions: INSTRUCTIONS },
  );
  registerReadTools(server, ctx);
  registerTaskTools(server, ctx);
  registerBoardTools(server, ctx);
  return server;
}
