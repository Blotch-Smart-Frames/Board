# Board by Blotch

A simple, visual way to organize your work. Create boards, add tasks, and drag them across columns to track progress — just like sticky notes on a whiteboard, but better.

## What You Can Do

- **Organize with boards and lists** — Set up columns like "To Do", "In Progress", and "Done", then drag tasks between them as work moves forward.
- **Collaborate with your team** — Share a board with others and see who's online in real time.
- **Label and categorize** — Tag tasks with color-coded labels and emoji so you can spot what matters at a glance.
- **Sync with Google Calendar** — Attach due dates to tasks and have them appear on your calendar automatically.
- **Sign in with Google** — No new account needed. Just sign in with your existing Google account.

## Getting Started

1. Open the app and sign in with your Google account.
2. Create a new board from the sidebar.
3. Add lists (columns) to represent stages of your workflow.
4. Add tasks, drag them around, label them, and share the board with your team.

## Repository Layout

This repo is an [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) monorepo orchestrated with [Turborepo](https://turborepo.dev):

- [packages/client](packages/client) — Angular 22 app (primary, deployed to Firebase Hosting)
- [packages/client-legacy](packages/client-legacy) — original React 19 + Vite app (kept for reference, no longer deployed)

Shared root files: [firebase.json](firebase.json), [firestore.rules](firestore.rules), [storage.rules](storage.rules), [turbo.json](turbo.json), and the CI workflows under [.github/workflows](.github/workflows).

## Common Commands

Install dependencies for every workspace:

```bash
npm install
```

Run the Angular client (primary):

```bash
npm run dev      # ng serve on http://localhost:5173
npm run build    # ng build → packages/client/dist/board/browser
npm test         # ng test
```

Run the React legacy client:

```bash
npm run dev:legacy    # vite dev server
npm run build:legacy  # vite build → packages/client-legacy/dist
npm run test:legacy   # vitest
```

Run a task across every workspace at once:

```bash
npm run build:all   # turbo run build   (both packages)
npm run test:all    # turbo run test    (both packages)
```

All of the scripts above delegate to `turbo run <task>` under the hood, so repeat runs with unchanged inputs are served from the local turbo cache in `.turbo/`.
