# Implementation Plan — Phase 7 Onwards

> Companion to `PORT_PROGRESS.md` (read that first for status/environment/testing gotchas/architecture map). This document is the concrete, file-by-file implementation spec for the rest of the port, written after reading every remaining React source file so you don't have to re-derive the design. The original approved plan with full context is at `/Users/dmiu/.claude/plans/agile-shimmying-sun.md`.
>
> Source app (read-only reference, do not modify): `/Users/dmiu/git/personal/board/src/`. Target: this directory.
>
> **Ground rules, reiterated:** unsuffixed class names, signals everywhere, `input()`/`output()`/`model()`, `@Service()` for root singletons, Signal Forms null-mapping convention (`''`/`[]` sentinels in the form, mapped to `undefined`/`null` at the service boundary — see `task-dialog.ts`), `TestBed.flushEffects()` for anything signal-interop-based, `npm run build` is the real template-check (not `tsc`). User has approved doing all of Phases 7–12 in order, and explicitly said **don't build a custom keyboard-drag engine** — menu-based "Move" actions are enough (already done for lists/boards; the task-detail "move to list" `<select>` covers cross-list keyboard moves).

---

## Phase 7 — remainder

Already built (see `PORT_PROGRESS.md`): markdown renderer/editor, `comments/*`, `history-section`, `attachments/*`, `assignee-picker`. Build these next, in this order (each depends on the previous):

### 1. `features/board/assignee-filter/assignee-filter.ts`
Source: `src/components/kanban/AssigneeFilter.tsx`. Horizontal single-select chip row: "All" + one chip per collaborator (avatar + name), selecting one filters the board to that assignee.
- Use `hlm-toggle-group type="single"` (same primitive as the kanban/timeline view switch in `app-bar.ts`) with `nullable` — actually the source's "All" IS a selectable option representing null, so model it as: `value = selectedAssigneeId() ?? '__all__'`, toggle-group items `value="__all__"` label "All", then one item per collaborator with `[value]="collaborator.id"`. On `(valueChange)`, emit `null` for `'__all__'`, else the id.
- Inputs: `collaborators = input.required<Collaborator[]>()`, `selectedAssigneeId = input<string | null>(null)`. Output: `selectedAssigneeIdChange = output<string | null>()`.
- Each toggle item shows `<app-user-avatar size="small" [showTooltip]="false">` + name (matches source's `Chip avatar={...}`).

### 2. `features/board/label-picker/label-picker.ts`
Source: `src/components/kanban/LabelPicker.tsx`. Inline checkbox list of board labels (for `TaskDialog`), plus "Manage" (opens `LabelManagement`) and "Create label" (opens `LabelEditor`) entry points.
- **Deliberate deviation (already decided):** do NOT replicate the `useEffect` that lazily seeds default labels on first open — `BoardService.createBoard` already seeds them at creation time. Just render whatever labels exist (possibly empty for boards created before this port, which is fine — no legacy data to migrate here).
- Inputs: `labels = input.required<Label[]>()` (pass `store.labels() ?? []` from the parent — don't re-fetch), `selectedLabelIds = input<string[]>([])`, `boardId = input.required<string>()` (needed to construct `LabelEditor`'s create handler). Output: `selectedLabelIdsChange = output<string[]>()`.
- Row = checkbox + `<app-label-chip>`, whole row clickable (same toggle pattern as `assignee-picker.ts`). Sort by `compareOrder`.
- "Manage" button opens `<app-label-management #management [boardId]="boardId()" />` (viewChild + `.open()`). "Create label" button opens `<app-label-editor #editor [saveHandler]="createHandler" />`.
- Inject `LabelService` directly for the create handler: `createHandler = (data: CreateLabelInput) => this.labelService.createLabel(this.boardId(), data).then(() => {})`.

### 3. `shared/components/label-chip/` already exists — reuse. New: `features/board/label-editor/label-editor.ts`
Source: `src/components/kanban/LabelEditor.tsx`. Create/edit-one-label dialog: name (required), emoji (optional, maxlength 4), `ColorPicker`, live `LabelChip` preview.
- Same imperative pattern as `board-form-dialog.ts` / `task-dialog.ts`: `open(label: Label | null)`, `saveHandler = input.required<(data: CreateLabelInput) => Promise<void>>()`.
- Signal Forms model: `{ name: '', emoji: '', color: labelColors[0] }`. `required(path.name)`. Preview: `computed(() => ({ id: 'preview', name: model().name || 'Label', color: model().color, emoji: model().emoji || undefined, order: '0', createdAt: <dummy>, updatedAt: <dummy> } satisfies Label))` — feed straight into `<app-label-chip [label]="previewLabel()" />`. (A dummy `Timestamp` isn't needed since `LabelChip` never reads timestamps — but the `Label` type requires the fields; use `{} as Timestamp` like elsewhere in tests, or better, give `LabelChip` a smaller `Pick<Label, 'name'|'color'|'emoji'>` prop type if you want to avoid the cast — either is fine, prefer the narrower prop type since it's cleaner.)
- No `Timestamp.now()` needed at all in the port (that was only for the fake preview object in React).

### 4. `features/board/label-management/label-management.ts`
Source: `src/components/kanban/LabelManagement.tsx`. Lists all board labels with inline edit/delete, "Create new label" button, and a nested `LabelEditor`.
- Inject `LabelService` directly (methods take `boardId` as first param). `boardId = input.required<string>()`.
- Data: since this dialog is opened on-demand and needs live labels, either accept `labels = input<Label[]>([])` from the parent (reuse `store.labels()` — simplest, avoids a second subscription) or subscribe itself via `collectionSignal` + a `boardLabelsQuery` helper in `firestore-refs.ts` if you want it fully self-contained. **Prefer accepting `labels` as an input** — `LabelPicker` (its parent) already has them from `BoardStore`, threading them down avoids a duplicate `onSnapshot`.
- Delete: per-row busy state (`deletingLabelId = signal<string | null>(null)`), matching source (not a single global spinner).
- Same `<app-label-editor>` viewChild pattern for create AND edit (pass `saveHandler` that branches: `editingLabel() ? labelService.updateLabel(boardId, editingLabel.id, data) : labelService.createLabel(boardId, data)`).

### 5. `features/board/label-filter/label-filter.ts`
Source: `src/components/kanban/LabelFilter.tsx` (MUI `Autocomplete multiple`). **Don't force a combobox** — the earlier plan validation flagged this as the one primitive without a clean Spartan precedent. Simplest accessible equivalent: a `hlm-popover` trigger button (showing selected `LabelChip`s or "Filter by label" placeholder) that opens a checkbox list (reuse the same row pattern as `label-picker.ts`).
- Inputs: `labels = input.required<Label[]>()`, `selectedLabelIds = input<string[]>([])`. Output: `selectedLabelIdsChange = output<string[]>()`.
- Check `shared/ui/popover/` (already generated in Phase 0) for the exact `hlm-popover`/`hlmPopoverTrigger`/`*hlmPopoverPortal` composition — same "let ctx" template pattern as dialog/sheet. If popover composition proves fiddly, a `hlmDropdownMenuCheckbox` list (also already generated) is an equally valid fallback — dropdown-menu supports checkbox items (`hlm-dropdown-menu-checkbox`), which is arguably an even better semantic fit than a plain popover.

### 6. `features/board/task-detail/task-detail-dialog.ts`
Source: `src/components/kanban/TaskDetailDialog.tsx`. The big composition. Read-oriented view with Details/History tabs.
- Imperative `open(task: Task)` / uses `HlmDialog` viewChild, same pattern as `task-dialog.ts` and `board-form-dialog.ts`.
- Inject `BoardStore` directly (don't prop-drill labels/lists/collaborators — they're all already on the store). Hold `taskId = signal<string | null>(null)`; `task = computed(() => store.tasks()?.find(t => t.id === taskId()))` so the dialog stays live if the task changes while open (source takes a static `task` prop; computed is strictly better here and trivial).
- Tabs: use `hlm-tabs` (same primitive as `markdown-editor.ts`). Two tabs: "Details", "History". **Difference from source:** source fully unmounts the History tab's content when switching away (each tab re-subscribes `useHistoryQuery` on return). In Angular, `@if` inside the tab content achieves the same (destroys `HistorySection`'s `collectionSignal` subscription on tab-away, recreates on return) — this is fine and matches source behavior; don't over-think keeping it always-mounted.
- "Move to list": `hlm-select` (already generated) bound to `task().listId`, `(valueChange)="store.moveTask(task().id, $event, computeAppendOrder())"` — actually simpler: add a `BoardStore.moveTaskToList(taskId, newListId)` convenience method that appends to the end of the destination list (`getOrderAtEnd`) and calls the existing `moveTask`, mirroring source's `onMoveTask` handler in `Board.tsx` exactly (`getOrderAtEnd(targetListTasks)`). This is also the accepted keyboard-accessible cross-list move path (per the user's DnD-scope decision).
- Description: plain `<p class="whitespace-pre-wrap">{{ task().description }}</p>` (source renders it as plain text here, NOT markdown — confirmed in source, only comments use markdown).
- Labels: read-only `<app-label-chip>` row from `task().labelIds`.
- Assignees: expandable — `assigneesExpanded = signal(false)`; collapsed shows `<app-task-assignees>`, expanded shows `<app-assignee-picker [selectedUserIdsChange]="onAssigneesChange">`. `onAssigneesChange` calls `store.updateTask(taskId, { assignedTo: userIds })` (already diffs history).
- Dates: `<span hlmBadge variant="outline">` per start/due date (reuse the same date-formatting as `task-card.ts`'s `dueDateLabel`); due-date badge gets a filled/primary look when `calendarSyncEnabled` (mirrors source's `color={calendarSyncEnabled ? 'primary' : 'default'}`).
- `<app-attachment-section [attachments]="task().attachments ?? []" (attachmentsChange)="store.updateTask(taskId, { attachments: $event })" />` — `BoardStore.updateTask` already logs `attachment_added`/`attachment_removed`... **wait, check:** `task-history-diff.ts`'s `diffTaskChanges` does NOT currently branch on `attachments` (only labels/assignees/completion/simple fields) — the source's attachment history logging happens at the `Board.tsx` call site by diffing old vs. new attachment IDs directly, not through `diffTaskChanges`. **Action:** either (a) extend `diffTaskChanges` to handle `updates.attachments` (diff by `id`, emit `attachment_added`/`attachment_removed` per file, matching source's `fileName` metadata), which is the cleaner fix since all history logging then flows through one path in `BoardStore.updateTask`, or (b) special-case it in `task-detail-dialog.ts` like source did. **Prefer (a)** — extend `diffTaskChanges` (update its spec test too).
- `<app-comments-section [boardId] [taskId] [collaborators]="store.collaborators()" />` and (History tab) `<app-history-section [boardId] [taskId] [collaborators]="store.collaborators()" [createdBy]="task().createdBy" [createdAt]="task().createdAt" />`.
- Footer: "Close" + "Edit" (closes detail, opens the edit `TaskDialog` — wire this at the `KanbanBoard` level, see below).

### 7. Wire it all into `BoardStore`, `KanbanBoard`, `TaskDialog`, `TaskCard`

- **`board.store.ts`:** add filter state and apply it in `listsWithTasks`:
  ```ts
  readonly assigneeFilter = signal<string | null>(null);
  readonly labelFilter = signal<string[]>([]);
  ```
  Inside `listsWithTasks`'s computed, after building `tasks` (with overrides applied), add before sorting into lists:
  ```ts
  .filter(t => !assigneeFilter() || t.assignedTo?.includes(assigneeFilter()!))
  .filter(t => labelFilter().length === 0 || t.labelIds?.some(id => labelFilter().includes(id)))
  ```
  (Mirrors `Board.tsx`'s `filteredTasks`.) Add corresponding tests.

- **`kanban-board.ts`:** add a filter bar above the lists (`<app-label-filter>` + `<app-assignee-filter>`, bound to `store.labelFilter`/`store.assigneeFilter` via `[selectedLabelIds]`/`(selectedLabelIdsChange)="store.labelFilter.set($event)"` etc.). Add `<app-task-detail-dialog #detailDialog />` viewChild. Change `TaskCard`'s output from `edit` to `view` semantically (see below) and open the detail dialog on it: `(view)="detailDialog().open($event)"`. The detail dialog's "Edit" button should close itself and call the SAME `openEdit(task)` method `KanbanBoard` already has for the edit `TaskDialog`.

- **`task-card.ts`:** rename `edit` output to `view` (click → view). The source has a separate hover-reveal "quick edit" pencil icon distinct from the click-to-view behavior — **optional nice-to-have, not required**: if you want parity, add a small ghost icon-button (visible on hover/focus, `class="opacity-0 group-hover:opacity-100"`) emitting a separate `edit` output that opens the edit dialog directly, skipping the detail view. If you skip it, clicking a card → detail dialog → "Edit" button is still a complete, if one-extra-click, path. Given time constraints this is a reasonable place to simplify; note it either way.

- **`task-dialog.ts`:** add `LabelPicker` and `AssigneePicker` fields between description and the color picker (matches source's field order: title → description → labels → assignees → sprint → color → dates → calendar-sync). Extend `TaskFormModel` with `labelIds: string[]` and `assignedTo: string[]` (plain arrays, not form-field-bound via `[formField]` since Signal Forms' `[formField]` doesn't suit a custom multi-select component well — instead bind these two directly via `[selectedLabelIds]="model().labelIds"` / `(selectedLabelIdsChange)="model.update(m => ({...m, labelIds: $event}))"`, same pattern already used for `color` in this file). Include both in the `save()` method's mapped `data` object (straight pass-through, no null-mapping needed since arrays are never null, only possibly empty).
  - `LabelPicker` needs `boardId` — `TaskDialog` doesn't currently have it as anything other than implicit; check `KanbanBoard`'s usage — `TaskDialog` isn't told `boardId` today. Add `readonly boardId = input.required<string>()` to `TaskDialog`, pass `[boardId]="store.boardId()!"` from `KanbanBoard` (guarded — `KanbanBoard` only renders once a board is selected, so this is safe, but TypeScript won't know that; use `store.boardId() ?? ''` or a non-null assertion with a comment).
  - Also pass `labels` down: `TaskDialog` needs `labels = input.required<Label[]>()` (from `store.labels() ?? []`) to hand to `LabelPicker`.

- **Specs:** write specs for every new Phase-7 component listed above (none exist yet — `comments/*`, `history-section`, `attachments/*`, `assignee-picker` from the earlier session also still need specs, they were never written). At minimum: renders correctly, key interactions (toggle/select/save/delete), and the `BoardStore` filter + `task-history-diff` attachment-diffing additions. Update `task-card.spec.ts` for the `view`/`edit` output rename, `task-dialog.spec.ts` for the new label/assignee fields, `kanban-board.spec.ts` for the detail-dialog wiring and filter bar.

**Exit check for Phase 7:** `npm run build`, `npx tsc -p tsconfig.spec.json --noEmit`, `npx ng test --watch=false` all green. Manually trace: click a task card → detail dialog opens showing labels/assignees/dates/attachments/comments → History tab shows entries → Edit → edit dialog has label/assignee pickers → Save → detail-relevant history entries appear.

---

## Phase 8 — Sprints

Source: `src/components/sprints/{SprintPicker,SprintDialog,SprintManagement}.tsx`. `SprintService` is already fully ported (Phase 1) — this phase is UI-only.

### 1. `features/sprints/sprint-dialog/sprint-dialog.ts`
Source: `SprintDialog.tsx`. Create/edit dialog: name, start date, end date (cross-validated both ways, like `task-dialog.ts`'s dates).
- Same imperative `open()`/`HlmDialog` pattern. Two modes distinguished by whether `open()` was called with a `Sprint` (edit) or nothing (create).
- **Create mode has an async default-population step** the others don't: source calls `calculateNextSprintDates()` (a `resource()`-shaped one-off fetch, see `SprintService.calculateNextSprintDates`) to suggest a name + start/end dates BEFORE showing the form, with its own loading state gating the dialog body (shows a spinner in place of the form while `open() && !isEditing`). Implement as: inject `SprintService`; on `open(null)`, set a `loadingDefaults = signal(true)`, call `sprintService.calculateNextSprintDates(boardId)`, populate the form model from the result, then `loadingDefaults.set(false)`. On `open(sprint)` (edit), skip this entirely and populate directly from the sprint.
- Model: `{ name: '', startDate: '', endDate: '' }` (same `date-input.ts` string-sentinel convention as `task-dialog.ts`). Validation: both dates required (unlike tasks, where dates are optional) — use `required(path.startDate)` / `required(path.endDate)` plus the same cross-field `validate()` pattern for ordering.
- `saveHandler` input pattern like the others: `(data: CreateSprintInput | UpdateSprintInput) => Promise<void>`; caller (`SprintPicker`/`SprintManagement`) branches create-vs-update since `SprintService`'s methods differ (`createSprint(boardId, input)` vs `updateSprint(boardId, id, updates)`).

### 2. `features/sprints/sprint-management/sprint-management.ts`
Source: `SprintManagement.tsx`. Two sections: (a) default sprint duration config (number input 1–365 + Save, disabled when unchanged from `board.sprintConfig?.durationDays`), (b) sprint list with inline edit/delete (per-row busy state + a dialog-level error alert on delete-blocked-by-assigned-tasks).
- Inject `SprintService`. Inputs: `boardId = input.required<string>()`, `board = input<Board | null>(null)` (for `sprintConfig.durationDays` default).
- Delete flow: call `canDeleteSprint(boardId, id)` first, show the pluralized error via `hlm-alert` if blocked (message format already matches `SprintService`'s own error, but source calls `canDeleteSprint` explicitly in the UI for a nicer inline alert rather than relying on the thrown error from `deleteSprint` — replicate this pattern, don't just try/catch `deleteSprint` alone).
- Nested `<app-sprint-dialog>` for both create and edit (two separate viewChild refs or one shared ref re-opened with different args, either works — one shared ref is simpler).

### 3. `features/sprints/sprint-picker/sprint-picker.ts`
Source: `SprintPicker.tsx`. Embedded in `TaskDialog`: a `hlm-select` of the board's sprints (+ "No sprint (Backlog)" empty option) showing each sprint's date range, plus "Manage" and "Create sprint" entry points.
- Inputs: `boardId = input.required<string>()`, `board = input<Board | null>(null)`, `sprints = input.required<Sprint[]>()` (from `store.sprints()` — don't re-subscribe), `selectedSprintId = input<string | null>(null)`. Output: `selectedSprintIdChange = output<string | null>()`.
- Date range format: reuse `date-fns`'s `format` (already a dependency) — `format(sprint.startDate.toDate(), 'MMM d')`.
- Wire into `task-dialog.ts` the same way as `LabelPicker`/`AssigneePicker` (add `sprintId: string` — empty-string sentinel for "no sprint" — to the form model, map `''` → `null` on save when editing / `undefined` on create, matching the existing convention).

**Exit check:** same three-command check + full suite. Manually trace: TaskDialog → pick/create a sprint → SprintManagement → change duration, delete a sprint with/without assigned tasks.

---

## Phase 9 — Timeline/Gantt (hardest phase — spike first)

Source: `src/components/timeline/*.tsx`, `src/hooks/{useTimelineData,useVisibleDates}.ts`. The source uses `dnd-timeline` (no Angular equivalent) for: pixel↔time scale math, free-drag-to-reschedule, edge-resize, and per-row drop-zone context. This phase hand-rolls all of that. **Before wiring this into the real app, build a standalone spike: one scale service + one draggable/resizable bar in an empty test route, prove drag reschedules it and resize changes its span, THEN integrate.**

### Core design decision: CDK for lane detection, raw Pointer Events for time-axis drag + resize

- **Lane (row/list) changes** during a timeline drag map naturally onto CDK: give each `TimelineRow` a `cdkDropList` with `cdkDropListSortingDisabled` (no in-list reordering, just membership) and `cdkDropListConnectedTo` listing every other row's id — this is a **different pattern than the Kanban board's DnD** (which uses sortable lists); here you only care "which container did the pointer end up over," which is exactly what a disabled-sorting `cdkDropList` gives you via `cdkDropListDropped`'s `event.container.id`.
- **Horizontal position (time) and resize** need continuous pixel math with no snapping — this is NOT what CDK's drag primitives are built for. Hand-roll with native Pointer Events (`pointerdown`/`pointermove`/`pointerup` + `setPointerCapture`) directly in the `TimelineItem` component, computing `deltaMs` from `deltaPx` via the scale service. Do this for both "drag the body to move" and "drag an edge handle to resize" — two separate pointer-event zones on the same element (a full-width invisible "body" hit-area behind two 10px-wide edge handles, matching source's `resizeHandleWidth: 10`).
- These two systems run **simultaneously but independently**: pointerdown on the body starts the CDK drag (for lane detection) AND starts your own horizontal pixel tracking (for the time delta) at once; pointerdown on a resize handle starts ONLY your own pointer tracking (no CDK drag — resizing never changes lanes). You'll need `(mousedown)="$event.stopPropagation()"` on the resize handles so they don't also trigger `cdkDrag`'s listener on the parent.

### 1. `features/timeline/data/timeline-scale.service.ts` (or a route-scoped `@Injectable`, colocated with the timeline feature)
```ts
export const MS_PER_DAY = 86_400_000;

@Injectable()
export class TimelineScaleService {
  readonly range = signal({ start: <today-3d>, end: <today+14d, end-of-day> }); // DEFAULT_RANGE_DAYS = 14, matches source
  readonly dayWidthPx = signal(120); // pick a sensible constant; source derives it from a CSS-driven `valueToPixels`, a fixed px/day constant is simpler and sufficient

  valueToPixels(ms: number): number { return (ms / MS_PER_DAY) * this.dayWidthPx(); }
  pixelsToValue(px: number): number { return (px / this.dayWidthPx()) * MS_PER_DAY; }

  expandPast(days = 7): void { /* range.update: start -= days, matches EXPANSION_DAYS */ }
  expandFuture(days = 7): void { /* range.update: end += days */ }
}
```
Provide this at the `TimelineView`-equivalent component level (route/component-scoped like `BoardStore`, not root — each board's timeline gets its own range state).

### 2. `features/timeline/timeline-data.ts` (pure functions, no framework — near-verbatim port)
Port `useTimelineData` and `useVisibleDates` as plain functions (or `computed()`s taking signals) — both are already pure/framework-agnostic in source:
```ts
export function computeTimelineRows(lists: List[]): TimelineRow[] { /* sort by compareOrder, map to {id,title} */ }
export function computeTimelineItems(tasks: Task[]): { items: TimelineItem[]; hiddenCount: number } { /* filter tasks with BOTH startDate+dueDate; map to {id, rowId: listId, span: {start,end} in ms via .toMillis(), task} */ }
export function computeVisibleDates(opts: { rangeStart, rangeEnd, scrollLeft, viewportWidth, dayWidthPixels, buffer? }): Date[] { /* verbatim port — pure date-fns math, zero changes needed */ }
```

### 3. `features/timeline/timeline-item/timeline-item.ts`
Source: `TimelineItem.tsx`. The draggable/resizable bar.
- Inputs: `item = input.required<TimelineItem>()`, `labels = input<Label[]>([])`. Outputs: `viewTask = output<Task>()` (click, distinguishing click-vs-drag via the same `DRAG_THRESHOLD = 5` pixel check as source — track pointerdown position, compare to pointerup position), `spanChanged = output<{start:number,end:number}>()` (both drag-move and resize end here — same shape, different trigger), `laneChanged = output<string>()` (row/list id, only fires on cross-lane drag-drop).
- Position/size come from `TimelineScaleService.valueToPixels()` applied to `item().span.start - range().start` (left) and `span.end - span.start` (width) — computed signals, applied via `[style.left.px]`/`[style.width.px]` (never `ngStyle`).
- Primary color: first matching label's color, else CSS var `--primary` (source used `theme.palette.primary.main`; use `var(--primary)` directly in a style binding, or just default to a Tailwind class `bg-primary` when there's no label and only apply the inline color when a label match exists).
- Resize handles: two 10px-wide absolutely-positioned `<div>`s at the left/right edges, each with `role="slider"` + keyboard nudge as a reasonable accessibility nod (ArrowLeft/ArrowRight adjust by e.g. 1 day) since true keyboard resize is a stretch goal, not required per the user's DnD-scope decision — a minimal keydown handler here is cheap and worth adding since it's local to one component, unlike a whole custom keyboard-drag engine.

### 4. `features/timeline/timeline-row/timeline-row.ts`
Source: `TimelineRow.tsx`. Thin wrapper: `cdkDropList [id]="row().id" cdkDropListSortingDisabled [cdkDropListConnectedTo]="allRowIds()" (cdkDropListDropped)="dropped.emit($event)"`, fixed 48px height, relatively positioned, projects `<ng-content>` (the row's `TimelineItem`s, absolutely positioned within it).

### 5. `features/timeline/timeline-header/timeline-header.ts`
Source: `TimelineHeader.tsx`. Renders visible day cells using `computeVisibleDates`. Needs `scrollState` (scrollLeft + viewportWidth) as inputs from the parent (same as source). Today's cell gets a highlight class. Cell label switches between `d` (narrow) and `EEE, MMM d` (wide) based on `dayWidthPx < 60`.

### 6. `features/timeline/current-time-line/current-time-line.ts`
Source: `CurrentTimeLine.tsx`. Absolutely positioned red line at `valueToPixels(now - range.start)`, only rendered when `now` is within `range`. **No `useEffect`-equivalent needed for the 60s tick** — use `toSignal(interval(60_000).pipe(map(() => Date.now())), { initialValue: Date.now() })` (this is exactly the `httpResource`-polling idiom already used elsewhere, just with `interval` instead of an HTTP call — a clean, effect-free port of what was a `setInterval`-in-`useEffect` in source).

### 7. `features/timeline/sprint-overlays/sprint-overlays.ts`
Source: `SprintOverlays.tsx`. Pure `computed()` rendering — background bands per visible sprint, sticky label header. Straightforward port; the only source-specific bit is `SPRINT_BASE_COLORS` (blue/orange/green/purple `[500]` swatches) — hardcode the same four hex values (MUI's `blue[500]` etc. are well-known constants: `#2196f3`, `#ff9800`, `#4caf50`, `#9c27b0` — verify against MUI's actual palette if you want exactness, or just pick four reasonable Tailwind-ish colors; this is cosmetic).

### 8. `features/timeline/timeline-grid/timeline-grid.ts` (≈ source's `TimelineContent.tsx`)
The scroll/virtualization/expansion orchestrator. This is the trickiest supporting logic to port correctly:
- A scrollable container (`(scroll)` binding, not `useEffect`+manual listener — Angular template event bindings ARE the idiomatic replacement here, no effect needed at all for the scroll listener itself).
- Track `scrollState = signal({scrollLeft: 0, viewportWidth: 0})`, updated on scroll AND on resize. For resize, use a `ResizeObserver` — this genuinely has no non-effect Angular idiom (it's an imperative external API), so a **legitimate `effect()`** (or `afterRenderEffect` since it's DOM measurement) wrapping `new ResizeObserver(...)` + `onCleanup` to disconnect is correct here, matching the project's own `effects.md` guidance ("valid use case: syncing to imperative/external APIs").
- Near-edge detection (< 200px from either end) triggers `scaleService.expandPast()`/`expandFuture()` — same thresholds as source.
- **Scroll-position preservation on left-expansion** (prepending days shifts content right, needs a compensating `scrollLeft` adjustment): mirror source's ref-based approach — plain instance fields (not signals — this is transient interaction state, not reactive UI state) tracking `isExpanding`, `prevScrollWidth`, `prevScrollLeft`; after `range().start` changes AND `isExpanding` was true, use `afterNextRender` (Angular's SSR-safe one-shot post-render hook — a clean substitute for source's `requestAnimationFrame`) to read the new `scrollWidth` and adjust `scrollLeft` by the delta. This is fiddly — port it as close to verbatim as possible rather than trying to redesign it; it's a solved, self-contained piece of logic.
- Renders: sidebar of row titles (200px fixed) + the scrollable timeline area containing `SprintOverlays`, `CurrentTimeLine`, `TimelineHeader`, and one `TimelineRow` per list (each populated with its `TimelineItem`s, filtered by `rowId`).

### 9. `features/timeline/timeline-view/timeline-view.ts` (≈ source's `TimelineView.tsx`, top-level)
- Injects `BoardStore` and `TimelineScaleService` (provided here, component-scoped).
- Optimistic overrides: **reuse the exact same `linkedSignal` override-map pattern already used for Kanban DnD** in `board.store.ts` (`taskOverrides`/`listOverrides`) — don't invent a third pattern. Concretely: add `spanOverrides`/`rowOverrides` `linkedSignal`s here (source-keyed off `store.tasks()`, so they auto-clear when Firestore echoes back, exactly like the kanban ones), OR — better, for consistency and less duplication — extend `BoardStore.taskOverrides` to optionally carry a `span` (`{start,end}`) alongside `{listId, order}`, so `listsWithTasks`-derived timeline items automatically reflect the same single optimistic-override mechanism the kanban board already uses. Prefer the shared-mechanism approach if it doesn't overcomplicate `board.store.ts`; fall back to a separate local override map here if that coupling gets awkward.
- On item drag-drop (lane changed): call `store.moveTaskToList`-equivalent (append to end of destination list — same as the detail dialog's move-to-list) for the list/order change, then `store.updateTask(id, {startDate, dueDate})` for the date change (source does list-move THEN date-update, awaited in sequence — replicate that order to avoid write races).
- On resize end / same-lane drag end: just `store.updateTask(id, {startDate, dueDate})`.
- Empty states: no lists → prompt to add a list; no tasks with dates → prompt to set dates; some-hidden → info banner with count (`hlm-alert` + `hlm-badge`, matching source's `Alert` + `Chip`).

### 10. Wire into `board-workspace.ts` / `kanban-board.ts`
`AppBar` already has the `viewMode` toggle (`'kanban' | 'timeline'`) wired at the `BoardWorkspace` level from Phase 3 — currently `BoardWorkspace` only ever renders `<app-kanban-board>`. Change the `@else` branch (board loaded) to `@if (viewMode() === 'kanban') { <app-kanban-board /> } @else { <app-timeline-view /> }`.

**Exit check:** the standalone spike works first (non-negotiable given complexity). Then: drag a bar horizontally within its lane → dates update; drag across lanes → list + dates update; resize an edge → due/start date updates; scroll near either edge → range expands without visual jump; toggle kanban/timeline in the app bar and confirm state (filters, selected board) is preserved.

---

## Phase 10 — Google Calendar sync

`CalendarService` + `SyncService` are fully ported (Phase 1). This phase is UI wiring only, into the already-built `task-dialog.ts`.

1. Add the `calendarSyncEnabled` switch (`hlm-switch`, already generated) to `TaskDialog`'s form, disabled when `!model().dueDate` (mirrors source), with the same "Set a due date to enable calendar sync" caption when disabled-but-somehow-true.
2. Add `calendarSyncEnabled: boolean` to `TaskFormModel`.
3. **The actual sync call happens at the `KanbanBoard`/`BoardStore` call site, not inside `TaskDialog` itself** (matches source: `TaskDialog` only sets the boolean; `Board.tsx`'s `handleSaveTask`/`handleAddTask` call `syncTaskToCalendar` afterward). Concretely: inject `SyncService` into `BoardStore` (or into `KanbanBoard` — `BoardStore` is more consistent with how history-logging is already centralized there) and extend `updateTask`/`addTask`:
   - After a successful `updateTask` where the resulting task has `calendarSyncEnabled && dueDate`: call `syncService.syncTaskToCalendar(boardId, updatedTask)`.
   - **Fix from source (already decided):** if `calendarSyncEnabled` was true and is now false (toggled off), call `syncService.unlinkTaskFromCalendar(boardId, task)` instead — source orphaned the Google Calendar event here; `SyncService.unlinkTaskFromCalendar` already exists and does the right thing, it just needs to be called from this toggle-off branch, which source never did.
4. `AuthStore.login()` already forwards the Google OAuth access token to `CalendarService.setAccessToken()` (done in Phase 2) — no changes needed there. Access token is memory-only / lost on reload, same as source (inherent Firebase limitation, out of scope to fix).
5. Optional (source has it but it's unreachable from any UI, confirmed dead in the original research — **skip unless you want extra credit**): `syncCalendarToTasks` (pull changes FROM Google Calendar back into tasks). Not required for parity since the source never wired a UI entry point to it either.

**Exit check:** create a task with a due date, enable sync → a real Google Calendar event appears (needs real credentials in `environment.ts` to verify manually — unit-test the `BoardStore` wiring with a mocked `SyncService` instead, same pattern as existing store specs).

---

## Phase 11 — Sharing

Source: `src/components/collaboration/ShareDialog.tsx`. `BoardService.shareBoard`/`removeCollaborator` and `UserService.getUserByEmail` are already ported.

### 1. `features/collaboration/share-dialog/share-dialog.ts`
- Imperative `open()` pattern (viewChild + `HlmDialog`), same as other dialogs. Inputs: `boardId = input.required<string>()`, `boardTitle = input.required<string>()`, `collaborators = input.required<Collaborator[]>()` (pass `store.collaborators()` from the parent).
- Invite: Signal Forms `{ email: '' }`, `required` + `email()` validator. On submit: `userService.getUserByEmail(email)` → if null, error "No user found with email: {email}" (matches source's `App.tsx` `handleShareBoard` behavior — that logic currently lives nowhere in the Angular port since Phase 11 hasn't started; it belongs in this dialog's submit handler, calling `UserService` + `BoardService.shareBoard` directly) → else `boardService.shareBoard(boardId, user.id)`. Success message: "Invitation sent to {email}" (it's actually immediate, not a real "invitation" — same slightly-misleading copy as source, keep it for parity).
- "Copy board link": `navigator.clipboard.writeText(window.location.href)` + transient success message (3s timeout — a plain `setTimeout` here is fine, this is a one-off UI toast dismissal, not something requiring signal-interop machinery).
- Collaborator list: avatar + name + "Owner" `hlm-badge` when `isOwner` + remove button (hidden for the owner) calling `boardService.removeCollaborator(boardId, userId)` — **this now actually works**, unlike source's no-op stub.

### 2. Wire the entry points (currently missing — Phase 4 deliberately deferred them)
- `AppBar`'s `share` output already exists (Phase 3) but nothing listens to it yet in `BoardWorkspace` — add a `ShareDialog` viewChild there, `(share)="shareDialog().open()"`, pass `boardId`/`boardTitle`/`collaborators` from `BoardStore`.
- `BoardListItem`'s dropdown menu (sidebar) doesn't have a "Share" item — source's `BoardList.tsx` menu has Rename/Share/Delete. Add a `share = output<void>()` to `BoardListItem`, a menu item, and wire it in `BoardsSidebar` to open the SAME `ShareDialog` (it'll need the target board's id/title/collaborators — since `ShareDialog` here would be for a board that might not be the currently-open one, either fetch collaborators specifically for that board via `collaboratorsResource` inline in `BoardsSidebar`, or — simpler — only wire this from `AppBar` (the open board) for now and treat the sidebar's "Share" menu item as **optional**; source's `App.tsx` actually supports sharing a non-open board via `sharingBoardId` state, but this is genuinely more plumbing (a second `collaboratorsResource` call) for modest value. Your call — note which you chose in `PORT_PROGRESS.md` when done.

**Exit check:** open Share from the app bar → invite by email (valid + invalid-email cases) → remove a collaborator → verify `firestore.rules` still allows these writes (it does, already confirmed: board member can update, `arrayRemove`/`arrayUnion` on `collaborators` is an update the rules permit).

---

## Phase 12 — Polish

Checklist-level; no single piece is architecturally hard, but there are several small items scattered through this whole document worth sweeping up:

1. **Dark-mode consolidation.** Everything so far uses Tailwind's semantic tokens (`bg-primary`, `text-muted-foreground`, etc.) which already flip automatically via the `.dark` class + CSS variables (`ThemeService`) — there should be very little one-off dark-mode-specific code to consolidate, unlike source's decentralized `theme.applyStyles('dark', ...)` calls. Grep for any hardcoded colors (`bg-white`, `text-black`, raw hex in `[style.*]` bindings outside of label/sprint swatches which are intentionally raw) and convert to semantic tokens.
2. **Version-update toast.** Port `useVersionCheck` as a `VersionCheckService` (`@Service()`): `httpResource(() => '/version.json')`-based fetch + a `setInterval`-via-`toSignal(interval(...))` re-trigger every 5 minutes (same idiom as `current-time-line.ts`'s clock tick), comparing against the build-time `BUILD_HASH` (`core/version/build-hash.ts`, already stamped by `scripts/stamp-version.mjs` since Phase 0). Render via Spartan's `sonner` (`hlm-toaster` — already generated in Phase 0) triggered from an `effect()` in `App` when `hasNewVersion` flips true, action button calls `window.location.reload()`.
3. **Bundle size.** Currently ~1.46MB raw / ~338kB gzipped (Firebase SDK dominates). `angular.json`'s budget was raised to 1.5MB warning / 2.5MB error as a stopgap. Consider: lazy-loading the `board/:boardId` route (code-split away from the sign-in/boards-list path), checking whether `firebase/app`+`firebase/auth`+`firebase/firestore`+`firebase/storage` tree-shake fully (modular SDK should, but double check no accidental full-SDK import snuck in), and whether `ngx-markdown`'s optional deps (mermaid/katex/emoji-toolkit — flagged as a risk in the original plan) got pulled in — if so, verify they're tree-shaken given this app doesn't use them.
4. **Full AXE pass.** Every phase gate up to now has just been build+test green, not an explicit accessibility audit. Do one now across the whole app: keyboard-only pass through auth → boards → board CRUD → drag-and-drop "Move" menus → task detail → all dialogs (focus trap, Escape-to-close, focus return) → timeline. Pay particular attention to: the timeline's custom pointer-driven drag/resize (needs SOME keyboard alternative — see Phase 9's per-handle keydown nudge suggestion), and color-only distinctions (label colors, sprint overlay colors) having a text/icon backup for colorblind users (labels already do via name text; sprint overlays rely on position + sticky label text, which is fine).
5. Sweep `console.error`-only error handling (there's a lot of it, matching source's own fire-and-forget style for history logging) and confirm nothing user-facing silently fails without at least a toast — source itself doesn't surface most of these either, so **parity is "console.error is fine,"** but flag anywhere a *destructive* action (delete) could silently no-op.

**Exit check:** full suite green, build green, manual smoke test of the entire app end-to-end (the `/verify` or `/run` skill can drive this if `environment.ts` has real credentials), AXE-clean.

---

## Cross-phase reminders

- Every new `@Service()`/`@Injectable()` that touches Firestore must inject `FIRESTORE_DB` (or `FIREBASE_STORAGE`/`FIREBASE_AUTH`), never import a plain const — this is what makes it testable (see `PORT_PROGRESS.md`'s testing section).
- Every new dialog-style component should follow the SAME imperative `open()`/`viewChild(HlmDialog)`/`saveHandler` input pattern already established in `board-form-dialog.ts` and `task-dialog.ts` — don't invent a new dialog-control convention partway through.
- Keep using the `linkedSignal`-sourced-from-live-data override pattern for ANY new optimistic-UI need (the timeline is the next place this applies) rather than a bespoke local cache.
- Update `PORT_PROGRESS.md`'s phase-status table and "current in-progress state" section as you complete each phase, the same way it's structured now — future handoffs depend on it staying current.
