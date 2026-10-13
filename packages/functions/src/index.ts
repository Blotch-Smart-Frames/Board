// Firebase Functions entry point. Every export at the top level becomes a
// deployable function. Re-export new functions from their module here.

export { migrateTask } from "./callable/migrate-task";
export {
  getMcpConnectRequest,
  decideMcpConnectRequest,
} from "./callable/mcp-connect";
export { mcp } from "./http/mcp";
export { escalatePastDue } from "./scheduled/escalate-past-due";
export { cleanupDeletedBoard } from "./triggers/cleanup-deleted-board";
