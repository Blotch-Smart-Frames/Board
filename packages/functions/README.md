# @blotch/board-functions

Firebase Cloud Functions for the board app.

## Stack

- TypeScript
- Vite (library mode, CJS output) for building
- Vitest for tests
- `firebase-functions` v2 API
- `firebase-admin`

## Layout

```
src/
  index.ts                 Re-exports every deployable function
  callable/                onCall functions (migrateTask, MCP consent screen)
  http/mcp.ts              The `mcp` HTTP function (MCP server + OAuth)
  mcp/                     MCP server: tools, Firestore access, formatting
  oauth/                   OAuth 2.1 authorization server for MCP clients
  scheduled/               Cron functions (escalatePastDue)
  triggers/                Firestore triggers (cleanupDeletedBoard)
  testing/                 In-memory Firestore fake + MCP test fixtures
vite.config.ts             Build + test config
```

## Build

```
npm run build --workspace=@blotch/board-functions
```

The build:

1. Vite bundles `src/index.ts` to `dist/index.js` (CJS, Node 22 target).
2. `firebase-functions` and `firebase-admin` are kept external — they resolve
   at deploy time.
3. The `generateDistPackageJson` plugin from `@blotch/vite-plugins` writes
   `dist/package.json` with `main`, `engines`, and `dependencies` copied from
   the workspace `package.json`.

Result: `dist/` is a self-contained folder that Firebase deploys.

## Test

```
npm test --workspace=@blotch/board-functions
```

## Deploy

Firebase points `functions.source` at `packages/functions/dist` in
`firebase.json`. From the repo root:

```
firebase deploy --only functions
```

CI deploys via [.github/workflows/deploy-functions.yml](../../.github/workflows/deploy-functions.yml)
on pushes to `master` that touch `packages/functions/**`.

## Adding a new scheduled function

1. Create `src/scheduled/<name>.ts` exporting an `onSchedule(...)` value.
2. Re-export it from `src/index.ts`.
3. Add a matching `<name>.spec.ts`.

Firebase cron syntax reference:
<https://firebase.google.com/docs/functions/schedule-functions>

## MCP server (ChatGPT, Claude)

The `mcp` function is a remote [MCP](https://modelcontextprotocol.io) server
that lets AI assistants read and change a user's boards as that user. Firebase
Hosting rewrites these paths on the app's domain to it (see `firebase.json`):

| Path | Purpose |
| --- | --- |
| `/mcp` | MCP endpoint (Streamable HTTP, stateless) |
| `/.well-known/oauth-protected-resource[/mcp]` | Protected resource metadata (RFC 9728) |
| `/.well-known/oauth-authorization-server` | Authorization server metadata (RFC 8414) |
| `/oauth/register`, `/oauth/authorize`, `/oauth/token`, `/oauth/revoke` | OAuth 2.1 endpoints |

**Connecting.** Add `https://<app domain>/mcp` as a custom connector in ChatGPT
(developer mode / Apps) or Claude (Settings → Connectors), or in Claude Code:

```
claude mcp add --transport http board https://<app domain>/mcp
```

The assistant opens a browser to `/connect` in the web app, where the signed-in
user approves or denies access. Approving issues tokens scoped to that user.
Every tool checks board membership, exactly like the Firestore rules do.

**Tools.** `get_current_user`, `list_boards`, `get_board`, `list_my_tasks`,
`search_tasks`, `get_task`, `create_task`, `update_task` (title, description,
dates/deadline, color), `assign_task`, `label_task`, `move_task` (lists,
reordering, archiving), `move_task_to_board`, `delete_task`, `add_comment`,
`update_comment`, `delete_comment`, `create_list`, `update_list`,
`create_label`. Writes follow the web app's rules: the 20-task list limit,
archival lists, fractional ordering, and task history entries. Board sharing
is deliberately not exposed, so a prompt-injected assistant can't add someone
to a board.

**Authorization server.** Firebase Auth can't act as an OAuth server for third
parties, so `src/oauth` implements a small one: PKCE (S256) required, Dynamic
Client Registration and Client ID Metadata Documents (what ChatGPT and Claude
use), `iss` in authorization responses (RFC 9207), 1-hour access tokens and
rotating 90-day refresh tokens, and revocation. State lives in top-level
Firestore collections (`oauthClients`, `oauthConnectRequests`, `oauthCodes`,
`oauthTokens`, `oauthGrants`). The Firestore rules don't match them, so client
SDKs can't touch them. Codes and tokens are stored only as SHA-256 hashes.
Expired requests, codes and tokens are removed by the TTL policies in
`firestore.indexes.json`.

**Configuration.** The `APP_URL` param (`src/mcp/config.ts`) is the public
origin clients see, and defaults to `https://board-by-blotch.web.app`. If the
app is served from a custom domain, change that default so the OAuth issuer
and resource URLs match the URL people paste into their assistant.

**Limitations.** Due-date changes made through MCP don't update a linked Google
Calendar event (the calendar token only exists in the browser); the event
catches up the next time the task is edited in the app.

**Testing locally.** `src/mcp/interop.spec.ts` connects the official MCP client
SDK through the full OAuth flow over real HTTP. To poke at a deployed server,
use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):
`npx @modelcontextprotocol/inspector` and point it at `/mcp`.
