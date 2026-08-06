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
  index.ts                       Re-exports every deployable function
  scheduled/
    daily-cleanup.ts             Example scheduled (cron) function
    daily-cleanup.spec.ts        Vitest test for the handler
vite.config.ts                   Build + test config
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
