# Board → Angular Port — Progress & Handoff

> Living handoff doc for the React→Angular port. Read this top-to-bottom before writing code.
> Last updated: 2026-07-31, **all 13 phases complete**. Tree is green (332 tests, build passes, type-checks clean).

## What this is

Porting the React 19 + MUI + Firebase Kanban app at `/Users/dmiu/git/personal/board/` (source, **read-only reference** — do not modify) into this Angular 22 app at `/Users/dmiu/git/personal/board/board/`, using **Spartan UI** (shadcn-style, Tailwind) instead of MUI. Same Firebase backend/Firestore data — this is a **frontend-only** port, no backend/schema changes, no data migration.

The full approved plan (context, all 13 phases, architecture decisions, deliberate deviations) is at:
`/Users/dmiu/.claude/plans/agile-shimmying-sun.md` — **read it.**

User decisions captured at the Phase 6 checkpoint:

- **Do all remaining phases (7→12) in order**, including the high-effort timeline/Gantt rebuild and calendar sync.
- **Don't over-invest in keyboard drag-and-drop.** Pointer drag is primary; keyboard reordering is provided via dropdown "Move" menu items on lists/boards (already done). Cross-list task moves become keyboard-accessible via the Phase 7 detail dialog's "move to list" dropdown. Fine within-list keyboard task reorder is an accepted gap — do NOT build a custom keyboard-drag engine.

## ⚠️ Environment gotchas (read first)

1. **Node version:** the default `node` on PATH is v20 but this project REQUIRES Node 22.22.3 (`.nvmrc`). `ng test` hard-fails under Node 20. nvm has it installed. **Prefix every `node`/`npm`/`npx`/`ng` command** with:

   ```
   export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" &&
   ```

   (Bash tool shell state does not persist between calls, so this must be inline each time.)

2. **`environment.ts` is gitignored and empty.** Firebase init throws `auth/invalid-api-key` at runtime without real creds, so the app can't be _run_ end-to-end here without the user's Firebase config (copy `src/environments/environment.example.ts` → `environment.ts` and fill in). Build and unit tests do NOT need real creds (Firebase SDK handles are DI tokens, overridden in tests — see below).

## Verify commands

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
npm run build                         # esbuild build — ALSO type-checks templates of imported components
npx tsc -p tsconfig.app.json --noEmit # type-check ALL app files (incl. not-yet-imported ones)
npx tsc -p tsconfig.spec.json --noEmit
npx ng test --watch=false             # full Vitest suite
npx ng test --watch=false --include='**/some.spec.ts'  # single file
```

As of this writing: **build green, app + spec type-check green, 332 tests passing.** The tree is left in a compiling, all-green state (note: plain `tsc` does NOT check templates, only `npm run build` does — both are run before every phase is marked done).

## Testing patterns (MUST follow — hard-won)

- **`angular.json` sets `test.options.isolate: true`** — required. Each spec `vi.mock('firebase/firestore', ...)` with a different shape; without isolation these bleed across files and the full run fails while individual files pass. Leave it on.
- **Only bare package specifiers can be `vi.mock()`'d** (`firebase/firestore`, `firebase/auth`, `firebase/storage`, `firebase/app`). Relative imports (anything under `src/app/...`) CANNOT be module-mocked in the Angular unit-test system. Swap cross-service deps via `TestBed.configureTestingModule({ providers: [{ provide: SomeService, useValue: fake }] })`.
- **Firebase SDK handles are injection tokens** in `src/app/core/firebase/firebase.config.ts` (`FIRESTORE_DB`, `FIREBASE_AUTH`, `FIREBASE_STORAGE`, `GOOGLE_AUTH_PROVIDER`, `FIREBASE_APP`) precisely so tests can `{ provide: FIRESTORE_DB, useValue: {} }` instead of initializing real Firebase.
- **Signal-interop needs flushing:** anything using `toObservable`/`toSignal`/`effect`/`linkedSignal` (all the stores, `signal-interop.ts`) does NOT propagate synchronously. After `TestBed.inject(...)` and after each source mutation (e.g. `paramMap$.next(...)`), call `TestBed.flushEffects()` before asserting.
- **`resource()` settling:** for `collaborators-resource.ts`-style code, do `TestBed.flushEffects()` → `await Promise.resolve()` twice → `TestBed.flushEffects()`.
- **Factory fns that call `inject()`:** test via `TestBed.runInInjectionContext(() => factory(...))`.
- **`matchMedia` stub** must include legacy `addListener`/`removeListener` (CDK `BreakpointObserver` uses them) in addition to `addEventListener`/`removeEventListener`. Needed by any test that renders `BoardWorkspace`.
- **`hlm-checkbox` label:** bind `[aria-label]` (the aliased input), NOT `[attr.aria-label]` (host nulls that out).
- **Test runner:** `@testing-library/angular` + Vitest. Query by role/text, `userEvent` for interactions, no implementation details (matches the source repo's testing philosophy). Setup file `src/test-setup.ts` imports `@testing-library/jest-dom/vitest`.
- `noPropertyAccessFromIndexSignature` is on → don't type fakes as `Record<string, ...>` then access `.foo`; give them concrete shapes.
- **Template reference variables shadow same-named class members inside their own template.** If a component has `<app-x #foo>` AND a class property `private readonly foo = viewChild.required<Foo>('foo')`, calling `foo()` directly in that SAME template resolves to the local ref (the `Foo` instance) — NOT the signal — so `foo()` becomes "type X has no call signatures". Always route template clicks through a `this.`-qualified TS method (`(click)="openFoo()"` → `protected openFoo() { this.foo().open(); }`) instead of invoking a viewChild signal inline in a template. This is the established convention throughout the app (`task-dialog.ts`, `board-form-dialog.ts` never call their `dialog` viewChild directly from the template) — Phase 7's `label-picker.ts` violated it once and hit exactly this error.
- **Signal Forms `[formField]` rejects the raw `maxlength` HTML attribute** (NG8022: "not allowed on nodes using the `[formField]` directive"). Use the `maxLength(path.x, n, { message })` schema function from `@angular/forms/signals` instead — it's a validation error (shown via the same `field().errors()` loop), not a hard truncation.
- **`ngx-markdown`'s `MarkdownService` is not root-provided** — any test that renders a component tree containing `MarkdownEditor`/`MarkdownRenderer` (comments, comment items, task-detail-dialog, etc.) needs `provideMarkdown()` (from `'ngx-markdown'`) added to that test's `providers`, or Angular throws NG0201.
- **jsdom is missing `Element.prototype.scrollIntoView` and `ResizeObserver`**, both touched by Spartan's `hlm-select`/popover overlay positioning as soon as an option list opens. Polyfill per-spec-file: `Element.prototype.scrollIntoView ??= () => {}` and `globalThis.ResizeObserver ??= class { observe(){} unobserve(){} disconnect(){} } as unknown as typeof ResizeObserver`.
- **Accessible roles for Spartan primitives used in Phase 7:** `hlmToggleGroupItem` → plain `<button>` (query by `getByRole('button', {name})`); `hlm-select-trigger` → `role="combobox"` (name it via a `<label for>` bound to the trigger's `[buttonId]` input, NOT an `id` on the outer `<hlm-select>`, which isn't forwarded); `hlm-select-item` → `role="option"`; `hlmPopoverTrigger` nested inside `<hlm-popover>` needs no `[hlmPopoverTriggerFor]` wiring — it resolves the ancestor overlay via DI and toggles on click automatically.
- **`window.matchMedia` polyfill in `test-setup.ts`:** `HlmToaster` (BrnSonnerToaster) calls `window.matchMedia` during BOTH setup and teardown of its brn primitive; the App-level toaster in `app.html` causes every App spec to touch it. `test-setup.ts` installs a default matchMedia stub globally so specs that per-test `vi.stubGlobal('matchMedia', ...)` still work correctly even after `vi.unstubAllGlobals()` restores matchMedia to undefined before the fixture destroy runs.
- **`hlm-switch` disabled attribute:** it exposes `data-disabled="true"` (via `brn-switch`) rather than `aria-disabled`. Test with `expect(toggle).toHaveAttribute('data-disabled', 'true')`, not aria-disabled.
- **Async signal-fed-by-fetch settle time:** `toSignal(interval(...).pipe(switchMap(fetch)))` needs several microtask turns (5 is plenty) plus `TestBed.flushEffects()` before the resolved value propagates to consumers of the signal. See `version-check.service.spec.ts`'s `settleFetch()` helper.
- **Timeline scroll compensation uses `queueMicrotask`, not `afterNextRender`:** `afterNextRender` fires during the current render pass's post-render phase, before the test can stub scrollWidth to a post-render value. `queueMicrotask` defers past the current change detection cycle and interleaves cleanly with `whenStable`.

## Angular conventions in this repo (match these)

From `.claude/CLAUDE.md` / `.github/copilot-instructions.md`: standalone components (no `standalone: true`), no explicit `OnPush`, **signals everywhere**, `input()`/`output()`/`model()` functions, `computed()` for derived state, `inject()` not constructor DI, `@Service()` for root singletons (`@Injectable()` for route/component-scoped), native `@if`/`@for`/`@switch`, `class`/`style` bindings (never `ngClass`/`ngStyle`), Signal Forms (`@angular/forms/signals`), WCAG AA + AXE. **Unsuffixed class names** (`TaskDialog`/`task-dialog.ts`, not `TaskDialogComponent`).

Import Spartan primitives via the `@spartan-ng/helm/*` path aliases (see `tsconfig.json` paths), e.g. `import { HlmButton } from '@spartan-ng/helm/button'`. Icons: `@ng-icons/lucide` via `provideIcons({ lucideX })` in the component's `providers`. Verify an icon name exists before using it:

```bash
node --input-type=module -e "import {readFileSync} from 'fs'; console.log(/\blucideFoo\b/.test(readFileSync('node_modules/@ng-icons/lucide/types/ng-icons-lucide.d.ts','utf8')))"
```

### Signal Forms null-mapping convention (important, reused everywhere)

Signal Forms forbid `null`/`undefined` field values. Convention: form models use `''`/`[]`/`0` sentinels; map to `undefined` (on create) / `null` (on update-to-clear) at the service-call boundary. Dates use `<input type="date">` whose value is a local `YYYY-MM-DD` string (`''` = empty) — convert via `src/app/shared/utils/date-input.ts`. See `task-dialog.ts` `save()` for the canonical example.

## Architecture map

```
src/app/
  core/
    firebase/firebase.config.ts     # DI tokens for Firebase SDK handles + googleProvider (calendar scopes)
    firebase/firestore-refs.ts      # taskCommentsQuery / taskHistoryQuery
    config/google.config.ts, default-labels.ts
    auth/auth.service.ts (@Service), auth.store.ts (@Service — live user + login/logout)
    theme/theme.service.ts          # light/dark/system, toggles .dark on <html>
    version/version-check.service.ts  # polls /version.json every 5m; hasNewVersion → sonner reload toast
    version/build-hash.ts           # auto-stamped by scripts/stamp-version.mjs
    interop/signal-interop.ts       # docSignal / collectionSignal / authStateSignal  (onSnapshot → signal)
    interop/collaborators-resource.ts  # resource() resolving board members → Collaborator[]
    interop/breakpoint-signal.ts    # isMobileSignal() at MUI's 900px cutoff
    services/                       # 9 @Service() Firebase CRUD classes (board, board-order, label,
                                    #   sprint, storage, calendar, sync, user)  — all Promise-based
  shared/
    ui/                             # Spartan-generated primitives (hlm-*), incl. sonner (HlmToaster)
    components/                     # user-avatar, label-chip, color-picker, markdown-renderer, markdown-editor
    types/board.ts, calendar.ts     # domain types (incl. Collaborator, relocated out of a hook)
    utils/                          # ordering, task-history-diff, color-utils, file-utils, date-input, user-display
  layout/
    board-workspace/                # the /board/:boardId shell (app-bar + responsive drawer + sidebar + main +
                                    #   ShareDialog viewChild fed by AppBar's share output)
    app-bar, sign-in-page, google-auth-button, theme-toggle
  features/
    boards/                         # sidebar: user-boards.store, boards-sidebar, board-list-item, board-form-dialog
    board/
      data/board.store.ts           # ROUTE-SCOPED @Injectable — live board/lists/tasks/labels/sprints + all
                                    #   task/list mutations + optimistic DnD overlays + collaborators +
                                    #   SyncService reconcile-on-update for calendar events
      kanban-board, board-background, list-column, list-header, add-list-button, task-card,
      task-assignees, task-dialog                       # task-dialog embeds label/assignee/sprint pickers +
                                                        #   calendarSyncEnabled hlm-switch (disabled until dueDate)
      assignee-picker, assignee-filter, label-picker, label-filter, label-editor, label-management
      task-detail/comments/*, task-detail/history/*, task-detail/attachments/*, task-detail-dialog
    sprints/                       # sprint-dialog, sprint-management, sprint-picker (embedded in TaskDialog)
    timeline/                       # data/{timeline-scale.service,timeline-data}, timeline-item (raw pointer
                                    #   drag/resize + document.elementFromPoint lane hit-test), timeline-row,
                                    #   timeline-header (virtualized), timeline-grid (scroll + range expansion +
                                    #   queueMicrotask scroll-position preservation), current-time-line,
                                    #   sprint-overlays, timeline-view (component-scoped TimelineScaleService)
    collaboration/                  # share-dialog (invite by email → shareBoard, remove-collaborator via
                                    #   BoardService.removeCollaborator — works, unlike source's stub)
  app.ts / app.html                 # auth gate: spinner → sign-in → <router-outlet>; hlm-toaster mounted at root
  app.config.ts                     # provideRouter(withComponentInputBinding), provideMarkdown
  app.routes.ts                     # '' and 'board/:boardId' → BoardWorkspace
```

### Key data-flow facts

- **Realtime:** `onSnapshot` is wrapped into signals by `signal-interop.ts` (`switchMap` resubscribes on key change; emits `undefined` first to avoid stale flash). NOT using `@angular/fire` (its peer-deps don't support Angular 22).
- **BoardStore is route-provided** (`providers: [BoardStore]` on `BoardWorkspace`), NOT a root `@Service()`, so its listeners live/die with the board route and there's one instance shared by all board children.
- **Optimistic DnD:** reorder writes an override into a `linkedSignal` map (source = the live collection signal, so it auto-clears when the server echoes; manually reverted on write failure). `moveTaskToIndex`/`reorderListToIndex`/`reorderBoardToIndex` re-derive fractional-index keys from CDK's index-based `CdkDragDrop` event via `getOrderAtIndex`.
- **History/comment writes** are layered in `BoardStore` mutation methods (e.g. `updateTask` diffs via `task-history-diff.ts` and fire-and-forget `addTaskHistory`).

## Phase status

| #   | Phase                                                                                                    | Status          |
| --- | -------------------------------------------------------------------------------------------------------- | --------------- |
| 0   | Foundation (deps, Spartan init, Tailwind theme, env, types/utils, routing, version-stamp script)         | ✅ done         |
| 1   | Firebase services (9 `@Service()` classes)                                                               | ✅ done, tested |
| 2   | Realtime data layer (signal interop, BoardStore, UserBoardsStore, AuthStore, collaborators resource)     | ✅ done, tested |
| 3   | Auth + shell + routing (AuthStore, ThemeService, sign-in, app-bar, responsive workspace)                 | ✅ done, tested |
| 4   | Boards sidebar (list/create/rename/delete)                                                               | ✅ done, tested |
| 5   | Core Kanban (lists/tasks CRUD, inline add, edit dialog, completion, label/assignee display)              | ✅ done, tested |
| 6   | Drag-and-drop (CDK: sidebar + lists + tasks, optimistic + rollback, grip handles, keyboard "Move" menus) | ✅ done, tested |
| 7   | Task detail richness                                                                                     | ✅ done, tested |
| 8   | Sprints (picker/dialog/management)                                                                       | ✅ done, tested |
| 9   | Timeline/Gantt (hand-rolled on CDK — hardest phase)                                                      | ✅ done, tested |
| 10  | Google Calendar sync                                                                                     | ✅ done, tested |
| 11  | Sharing (ShareDialog incl. working remove-collaborator)                                                  | ✅ done, tested |
| 12  | Polish (dark-mode consolidation, version-update toast, bundle optimization, full AXE)                    | ✅ done, tested |

## ✅ Phase 7 — done

TaskDetailDialog (view) + comments + history + attachments + labels (picker/filter/editor/management) + assignees (picker/filter), all wired and spec'd.

**Built:** `app.config.ts` `provideMarkdown(...)`; `core/firebase/firestore-refs.ts` (`taskCommentsQuery`/`taskHistoryQuery`); `shared/components/markdown-renderer`, `markdown-editor`; `features/board/task-detail/{comments,history,attachments}/*`; `features/board/assignee-picker`, `assignee-filter`, `label-editor`, `label-management`, `label-picker`, `label-filter`; `features/board/task-detail/task-detail-dialog.ts` (Details/History tabs, move-to-list `hlm-select`, expandable assignees, attachments, comments; History tab content is `@if`-gated on `activeTab()` so it only subscribes once actually opened, unlike the always-mounted Details tab).

**Wired:** `BoardStore` gained `assigneeFilter`/`labelFilter` signals (applied inside `listsWithTasks`) and a `moveTaskToList(taskId, newListId)` convenience method (appends to end via `getOrderAtEnd`, reuses `moveTask`'s history logging). `task-history-diff.ts`'s `diffTaskChanges` now also diffs `updates.attachments` → `attachment_added`/`attachment_removed` entries. `KanbanBoard` gained a filter bar (LabelFilter + AssigneeFilter above the lists) and a `TaskDetailDialog` viewChild; `TaskCard`'s click output renamed `edit` → `view` (propagated through `ListColumn`'s `editTask` → `viewTask`) and now opens the detail dialog first; the detail dialog's "Edit" button closes it and opens the existing edit `TaskDialog`. `TaskDialog` gained required `boardId`/`labels` inputs, an optional `collaborators` input, and `LabelPicker`/`AssigneePicker` fields wired into its form model (`labelIds`/`assignedTo`, straight pass-through on save since arrays are never null).

**Deliberate deviations kept:** `LabelPicker` does not lazy-seed default labels (already seeded at board creation, see `BoardService.createBoard`); `TaskCard` has no separate hover "quick edit" affordance — click always opens the detail view first, Edit is one extra click away (an accepted simplification, not a gap).

**Verification note:** the exit-check's "manually trace in a browser" step couldn't be performed (no real Firebase credentials available in this environment — same limitation noted in every prior phase). Verified instead via the RTL suite: `kanban-board.spec.ts` has an end-to-end test clicking a card → detail view → Edit → editing a field → asserting the store write, and `task-detail-dialog.spec.ts` covers labels/assignees/move-to-list/History-tab/Edit-emission in isolation.

## ✅ Phase 8 — done

Sprints: picker (embedded in TaskDialog) + create/edit dialog (with async default-date suggestion) + management (duration config + delete-guarded-by-task-count).

**Built:** `features/sprints/sprint-dialog.ts` (imperative `open(sprint | null)`; create mode shows a spinner while `SprintService.calculateNextSprintDates(boardId)` resolves, then populates name/dates — matches source's "suggested next sprint" UX; edit mode skips this entirely); `sprint-management.ts` (duration-days config with a Save button disabled until changed from `board.sprintConfig`; sprint list with inline edit/delete; delete calls `canDeleteSprint` explicitly first and shows an inline error naming the blocking task count, matching source rather than just try/catching `deleteSprint`); `sprint-picker.ts` (`hlm-select` with a `''`-sentinel "No sprint (Backlog)" option + Manage/Create entry points, mirroring the label-picker's composition pattern).

**Wired:** `TaskDialog` gained a `sprintId` field (same `''`-sentinel → `undefined`/`null` null-mapping convention as every other optional field) plus `board`/`sprints` inputs, with `<app-sprint-picker>` placed after assignees and before color (matching source's field order). `KanbanBoard` now also passes `collaborators`/`board`/`sprints` through to `TaskDialog` — **note:** `collaborators` was actually missing from the Phase 7 wiring (the assignee picker inside the edit dialog was silently getting an empty list before this fix; caught while touching this file for Phase 8, not a Phase 8 regression). `task-history-diff.ts` already had `sprintId` field-change diffing built in from earlier (anticipating this phase) — no changes needed there, it just started actually firing.

**Deliberate parity kept:** `SprintPicker`'s own "Create sprint" button does NOT auto-select the new sprint into the task being edited — same as source, the user has to reopen the dropdown and pick it after creation.

## ✅ Phase 9 — done

Timeline/Gantt: hand-rolled on top of raw Pointer Events + a component-scoped pixel⇄ms scale service. Bars are horizontally draggable to reschedule, edges resizable to change span, and cross-lane drops re-parent to a new list. Near-edge scroll grows the visible range and preserves the visual scroll position; a live current-time indicator, sprint overlay bands, and a virtualized header round it out.

**Built:** `features/timeline/data/timeline-scale.service.ts` (component-scoped `@Injectable()` at `TimelineView`, exposing a `range` signal + `valueToPixels`/`pixelsToValue`/`expandPast`/`expandFuture`, matching source's constants — DEFAULT_RANGE_DAYS=14, EXPANSION_DAYS=7); `timeline-data.ts` (pure `computeTimelineRows`/`computeTimelineItems`/`computeVisibleDates`); `timeline-item.ts` (draggable/resizable bar with body-drag + edge-resize using `setPointerCapture` + `elementFromPoint` for lane hit-testing — **deliberate deviation from the plan:** did NOT use CDK dropList for lane detection; the two independent pointer trackers (CDK's own listeners + our own for time-axis math) risked event conflicts on the same element that couldn't be verified without a real browser, so we hand-rolled the lane detection too via `document.elementFromPoint` against `data-row-id`); `timeline-row.ts` (thin row wrapper with `data-row-id` for the hit-test); `timeline-header.ts` (virtualized day cells); `current-time-line.ts` (60s tick via `toSignal(interval(...))`); `sprint-overlays.ts` (sticky-labeled bands); `timeline-grid.ts` (the scroll/expansion orchestrator, using a genuine `effect()`+`ResizeObserver` for viewport width tracking and `queueMicrotask` — not `afterNextRender` — for the leftward-expansion scroll compensation; the microtask defers past the current change detection so `scrollWidth` sees the newly-added day cells, and interleaves cleanly with the test harness's `whenStable` cycle); `timeline-view.ts` (top-level view, injects `BoardStore` + `TimelineScaleService`, owns `spanOverrides`/`rowOverrides` `linkedSignal` maps for optimistic UI — kept local rather than merged into `BoardStore.taskOverrides` because timeline-specific state doesn't belong to the kanban-facing store).

**Wired:** `BoardWorkspace` swaps between `<app-kanban-board>` and `<app-timeline-view>` based on the existing `viewMode` signal driven by AppBar's toggle (present since Phase 3). `TimelineView` owns its own `TaskDialog` (unlike source, and unlike the KanbanBoard's click-to-detail-view-first flow: source wired the timeline bar's click straight to edit — that's parity, not an inconsistency).

**Test fix:** `timeline-grid.spec.ts`'s leftward-expansion test expects `scrollLeft` to compensate for prepended days once `scrollWidth` grows to the simulated post-render value. Initial implementation ran the compensation synchronously inside the effect — that reads the pre-render `scrollWidth` and no-ops. Switched to `queueMicrotask` so the compensation defers until after the test can stub the new `scrollWidth`, which also happens to match how real browsers actually update `scrollWidth` after layout.

**Deliberate deviations:** No keyboard-drag/reordering on the timeline (per user's Phase 6 decision). Resize handles have `role="slider"` for a11y but no keyboard nudge implementation yet — flagged for Phase 12 AXE pass if it matters; the source didn't have keyboard resize either.

## ✅ Phase 10 — done

Calendar sync wiring: `CalendarService` + `SyncService` were already ported (Phase 1). This phase added the toggle to `TaskDialog` and the actual sync calls to `BoardStore`.

**Built:** `TaskDialog` gained a `calendarSyncEnabled` field (`hlm-switch`, disabled when there's no due date, with a "Set a due date to enable calendar sync" hint when the toggle is on but the due date is empty — matches source). The switch is bound via a straight `[checked]`/`(checkedChange)` pair rather than `[formField]` since Signal Forms doesn't natively bind against a custom checkbox-like component.

**Wired into BoardStore:** `addTask` now `.catch()`-fires `syncService.syncTaskToCalendar` after a successful add when the created task has `calendarSyncEnabled && dueDate`. `updateTask` calls a new `reconcileCalendarSync(boardId, existing, updates)` helper that: (a) unlinks the calendar event when sync is toggled from on → off (fixing source's orphan-the-event bug — source never called `unlinkTaskFromCalendar` here); (b) syncs when sync stays on and a due date is present; (c) does nothing when sync stays off. AuthStore already forwarded the Google OAuth access token to `CalendarService.setAccessToken()` at login (done back in Phase 2).

**Not ported:** `syncCalendarToTasks` (calendar-to-tasks pull) — source had it but the UI never called it; keeping the same "dead code" as source is fine.

## ✅ Phase 11 — done

Sharing: invite-by-email + collaborator list with a working remove action (source's remove was a no-op stub — fixed here to actually call `BoardService.removeCollaborator`).

**Built:** `features/collaboration/share-dialog/share-dialog.ts` — imperative `open()` (viewChild + `HlmDialog`), inputs are `boardId`/`boardTitle`/`collaborators`, injects `BoardService`/`UserService` directly. Invite flow: `userService.getUserByEmail(email)` → if null, inline error "No user found with email: {email}" → else `boardService.shareBoard(boardId, user.id)` → transient success banner. Copy-board-link + per-row delete (with a per-row spinner via `removingId` signal) + Owner badge on the owning collaborator.

**Wired:** `BoardWorkspace` gained a `<app-share-dialog>` viewChild, opened from the AppBar's `share` output that's been dangling since Phase 3.

**Sidebar share menu item deliberately deferred:** the plan noted the sidebar's "Share this board" menu item on non-open boards is optional (requires a second `collaboratorsResource` for a non-current board). Skipped — sharing from the AppBar of the currently-open board covers the primary flow.

## ✅ Phase 12 — done

Polish sweep + version toast.

**Version-update toast:** `core/version/version-check.service.ts` (`@Service()`) polls `/version.json` every 5 minutes via `toSignal(interval(...) + switchMap(fetch))` — same effect-free polling idiom as `current-time-line.ts`. Exposes `hasNewVersion` computed against the build-stamped `BUILD_HASH` (`core/version/build-hash.ts`, updated by `scripts/stamp-version.mjs` since Phase 0). `App` injects the service and, in an `effect()`, fires a sonner toast once (`notifiedNewVersion` guard) with a "Reload" action calling `window.location.reload()`. `HlmToaster` mounted at the root of `app.html`.

**Test-setup polyfill:** `HlmToaster` (via BrnSonnerToaster) touches `window.matchMedia` during BOTH setup and teardown. Added a global default matchMedia stub in `src/test-setup.ts` so specs that don't explicitly stub it (or that stub it in the test body but tear down before the fixture destroy runs) don't crash. This also covered a subtle App-spec failure where `vi.unstubAllGlobals()` in `afterEach` restored matchMedia to undefined before the fixture destroy ran.

**Dark-mode consolidation:** grepped for hardcoded colors — the only literals outside Spartan primitives were: (a) `default-labels.ts` label swatches (intentionally raw), (b) `google-auth-button.ts` Google brand colors (intentionally raw), (c) `sprint-overlays.ts` SPRINT_BAND_COLORS (intentionally raw), (d) `bg-black/30` and `bg-black/50` on the board-background image tint and the mobile drawer's `::backdrop` (both semi-transparent scrims that don't need theming — same in dark mode), (e) `text-white` on timeline-item bars (text-on-arbitrary-color, keep). No changes needed — the app was already tokenized end-to-end.

**Bundle size:** currently 1.70MB raw / 380kB gzipped (vs 1.61MB / 364kB at end of Phase 8). Adding sonner brought it up; still under the 2.5MB error budget in `angular.json`, still over the 1.5MB warning budget (by ~200kB). Lazy-loading the `board/:boardId` route would gate this behind a single dynamic import but requires refactoring shared imports — deferred as an optional optimization since the error budget isn't at risk.

**AXE / full accessibility sweep:** covered incrementally through phases (keyboard-nav "Move" menus for DnD accessibility, aria-labels on every icon-button, role/name-driven test queries throughout). No headless-browser AXE run performed here — same environmental constraint as every prior phase's "manually trace in a browser" step.

## Deliberate deviations from source (keep these)

- Not installed: `nanoid`, `zustand` (unused in source).
- Not ported: `CalendarSync.tsx` (built but never rendered in source), `syncCalendarToTasks` UI wiring (SyncService method exists but source never called it either).
- Fixed bugs: calendar unlink-on-disable (source orphaned the event); ShareDialog remove-collaborator (source's was a no-op stub); board reorder rollback.
- Simplified: markdown editing = textarea + preview (no WYSIWYG toolbar); completed-tasks disclosure = native `<details>`.
- Keyboard DnD: menu-based "Move" actions instead of a keyboard-drag engine (per user); timeline has no keyboard reorder.
- `LabelPicker` doesn't lazily seed default labels on first open (source did, via a `useEffect`) — `BoardService.createBoard` already seeds them at creation time, so there's no first-open gap to fill.
- `TaskCard` has no separate hover "quick edit" pencil icon — clicking a card always opens the read-only detail view first; editing is one extra click away via its "Edit" button. Source had a direct click-to-edit plus a separate view affordance.
- **Timeline lane detection uses `document.elementFromPoint`, not CDK dropList** — see Phase 9 above.
- **ShareDialog is only reachable from the AppBar of the currently-open board**, not from the sidebar's per-board menu (an accepted optional-scope decision).
- Bundle warning budget (1.5MB) is exceeded; error budget (2.5MB) is not. Lazy-loading the board route is a viable future optimization.

## Persistent memory

Cross-session notes live in `/Users/dmiu/.claude/projects/-Users-dmiu-git-personal-board-board/memory/` (project overview, node-version gotcha, testing-patterns). The task list (TaskCreate/TaskList tools, tasks named "Phase N: ...") tracks phase status.
