import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { KanbanBoard } from './kanban-board';
import { BoardStore } from '../data/board.store';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { BoardService } from '../../../core/services/board.service';
import { StorageService } from '../../../core/services/storage.service';
import type { Board, Task } from '../../../shared/types/board';

// The task detail dialog's CommentsSection/HistorySection read live Firestore
// queries; stub the SDK so onSnapshot never fires instead of hitting real
// Firebase (a misconfigured, key-less app in this test environment).
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ type: 'query', ref, constraints })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ where: [field, op, value] })),
  limit: vi.fn((count: number) => ({ limit: count })),
  onSnapshot: vi.fn(() => vi.fn()),
}));

// celebrateAt (a plain relative-import util, which Angular's vitest harness
// won't let us vi.mock directly) dynamically imports @tsparticles/confetti —
// mock that package boundary instead and let celebrateAt run for real.
const confettiFn = vi.fn().mockResolvedValue(undefined);
vi.mock('@tsparticles/confetti', () => ({ confetti: (...args: unknown[]) => confettiFn(...args) }));

function ts(): Timestamp {
  return { toDate: () => new Date(2026, 0, 1) } as Timestamp;
}

function fakeBoard(): Board {
  return {
    id: 'board-1',
    title: 'My Board',
    ownerId: 'u1',
    collaborators: [],
    createdAt: ts(),
    updatedAt: ts(),
  };
}

function fakeTask(): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Existing task',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'u1',
    createdAt: ts(),
    updatedAt: ts(),
  };
}

function setup() {
  const store = {
    boardId: signal('board-1'),
    board: signal<Board | null>(fakeBoard()),
    labels: signal([]),
    collaborators: signal([]),
    tasks: signal([fakeTask()]),
    sprints: signal([]),
    labelFilter: signal<string[]>([]),
    assigneeFilter: signal<string[]>([]),
    listsWithTasks: signal([
      { id: 'list-1', title: 'To Do', order: 'a0', createdAt: ts(), tasks: [fakeTask()] },
    ]),
    archivalListIds: signal<string[]>([]),
    archivedPreviewByListId: signal(new Map<string, ReturnType<typeof fakeTask>[]>()),
    addList: vi.fn().mockResolvedValue(undefined),
    updateListTitle: vi.fn().mockResolvedValue(undefined),
    deleteList: vi.fn().mockResolvedValue(undefined),
    addTask: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    setTaskCompleted: vi.fn().mockResolvedValue(undefined),
    reorderListToIndex: vi.fn().mockResolvedValue(undefined),
    moveTaskToIndex: vi.fn().mockResolvedValue(undefined),
    moveTaskToList: vi.fn().mockResolvedValue(undefined),
  };
  return {
    store,
    providers: [
      { provide: BoardStore, useValue: store },
      { provide: FIRESTORE_DB, useValue: {} },
      { provide: AuthStore, useValue: { user: signal({ uid: 'u1' }) } },
      { provide: BoardService, useValue: {} },
      { provide: StorageService, useValue: {} },
    ],
  };
}

describe('KanbanBoard', () => {
  beforeEach(() => {
    confettiFn.mockClear();
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 500);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the board’s lists and tasks', async () => {
    const { providers } = setup();
    await render(KanbanBoard, { providers });

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Existing task')).toBeInTheDocument();
  });

  it('adds a list through the add-list control', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup();
    await render(KanbanBoard, { providers });

    await user.click(screen.getByRole('button', { name: /add another list/i }));
    await user.type(screen.getByLabelText('List title'), 'Doing{Enter}');

    expect(store.addList).toHaveBeenCalledWith({ title: 'Doing' });
  });

  it('quick-adds a task to a list', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup();
    await render(KanbanBoard, { providers });

    await user.click(screen.getByRole('button', { name: /add a task/i }));
    await user.type(screen.getByLabelText('Task title'), 'Fresh task{Enter}');

    expect(store.addTask).toHaveBeenCalledWith('list-1', { title: 'Fresh task' });
  });

  it('opens the task detail view and saves an updated title through the store', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup();
    await render(KanbanBoard, { providers });

    await user.click(screen.getByRole('button', { name: /open task existing task/i }));
    await user.click(await screen.findByRole('heading', { name: 'Existing task' }));

    const title = await screen.findByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Renamed task');
    await user.tab();

    await waitFor(() =>
      expect(store.updateTask).toHaveBeenCalledWith('t1', { title: 'Renamed task' }),
    );
  });

  it('reorders a list via the keyboard "Move right" action', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup();
    // Two lists so the first can move right.
    store.listsWithTasks.set([
      { id: 'list-1', title: 'To Do', order: 'a0', createdAt: ts(), tasks: [] },
      { id: 'list-2', title: 'Doing', order: 'a1', createdAt: ts(), tasks: [] },
    ]);
    await render(KanbanBoard, { providers });

    // Open the first list's options menu (the To Do column).
    await user.click(screen.getAllByRole('button', { name: /list options/i })[0]);
    await user.click(await screen.findByRole('menuitem', { name: /move right/i }));

    expect(store.reorderListToIndex).toHaveBeenCalledWith('list-1', 1);
  });

  it('shows an empty state with a Create list button when the board has no lists', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup();
    store.listsWithTasks.set([]);
    await render(KanbanBoard, { providers });

    expect(screen.getByText(/no lists yet/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create list/i }));
    expect(store.addList).toHaveBeenCalledWith({ title: 'New list' });
  });

  it('reorders a list to a new index when a list is dropped', async () => {
    const { store, providers } = setup();
    const view = await render(KanbanBoard, { providers });

    // Same index -> guard early-return, no store call.
    view.fixture.componentInstance['onListDrop']({
      previousIndex: 1,
      currentIndex: 1,
      item: { data: 'list-1' },
    } as never);
    expect(store.reorderListToIndex).not.toHaveBeenCalled();

    // Different index -> forwards to the store.
    view.fixture.componentInstance['onListDrop']({
      previousIndex: 0,
      currentIndex: 2,
      item: { data: 'list-1' },
    } as never);
    expect(store.reorderListToIndex).toHaveBeenCalledWith('list-1', 2);
  });

  it('wires the horizontal cdkDropList output into onListDrop', async () => {
    const { CdkDropList } = await import('@angular/cdk/drag-drop');
    const { store, providers } = setup();
    const view = await render(KanbanBoard, { providers });

    const dropListDebug = view.fixture.debugElement.query(
      (el) => !!el.injector.get(CdkDropList, null),
    );
    const dropList = dropListDebug!.injector.get(CdkDropList);
    // The output name is `cdkDropListDropped` — CDK exposes it as `dropped`.
    (dropList.dropped as unknown as { emit: (e: unknown) => void }).emit({
      previousIndex: 0,
      currentIndex: 1,
      item: { data: 'list-1' },
    });

    expect(store.reorderListToIndex).toHaveBeenCalledWith('list-1', 1);
  });

  it('moves a task to a different list index when a task is dropped', async () => {
    const { store, providers } = setup();
    const view = await render(KanbanBoard, { providers });
    const task = fakeTask();

    // Same list, same index -> guard early-return.
    const sameContainer = { id: 'list-1' } as unknown;
    view.fixture.componentInstance['onTaskDrop']({
      previousContainer: sameContainer,
      container: sameContainer,
      previousIndex: 0,
      currentIndex: 0,
      item: { data: task },
    } as never);
    expect(store.moveTaskToIndex).not.toHaveBeenCalled();

    // Same list, different index -> forwards.
    view.fixture.componentInstance['onTaskDrop']({
      previousContainer: sameContainer,
      container: sameContainer,
      previousIndex: 0,
      currentIndex: 2,
      item: { data: task },
    } as never);
    expect(store.moveTaskToIndex).toHaveBeenCalledWith('t1', 'list-1', 2);

    // Different list -> forwards regardless of index.
    store.moveTaskToIndex.mockClear();
    view.fixture.componentInstance['onTaskDrop']({
      previousContainer: { id: 'list-1' } as unknown,
      container: { id: 'list-2' } as unknown,
      previousIndex: 0,
      currentIndex: 0,
      item: { data: task },
    } as never);
    expect(store.moveTaskToIndex).toHaveBeenCalledWith('t1', 'list-2', 0);
  });

  it('fires a confetti burst at the drop point when a task enters an archival list', async () => {
    const { store, providers } = setup();
    store.archivalListIds.set(['list-2']);
    const view = await render(KanbanBoard, { providers });
    const task = fakeTask();

    view.fixture.componentInstance['onTaskDrop']({
      previousContainer: { id: 'list-1' } as unknown,
      container: { id: 'list-2' } as unknown,
      previousIndex: 0,
      currentIndex: 0,
      dropPoint: { x: 250, y: 100 },
      item: { data: task },
    } as never);

    // dropPoint (250, 100) against the stubbed 1000x500 viewport -> 25%, 20%.
    await waitFor(() =>
      expect(confettiFn).toHaveBeenCalledWith(
        expect.objectContaining({ position: { x: 25, y: 20 } }),
      ),
    );
  });

  it('does not fire confetti when moving between two non-archival lists', async () => {
    const { providers } = setup();
    const view = await render(KanbanBoard, { providers });
    const task = fakeTask();

    view.fixture.componentInstance['onTaskDrop']({
      previousContainer: { id: 'list-1' } as unknown,
      container: { id: 'list-2' } as unknown,
      previousIndex: 0,
      currentIndex: 0,
      dropPoint: { x: 0, y: 0 },
      item: { data: task },
    } as never);

    expect(confettiFn).not.toHaveBeenCalled();
  });

  it('does not fire confetti when a task is already in an archival list (moving between two archival lists)', async () => {
    const { store, providers } = setup();
    store.archivalListIds.set(['list-1', 'list-2']);
    const view = await render(KanbanBoard, { providers });
    const task = fakeTask();

    view.fixture.componentInstance['onTaskDrop']({
      previousContainer: { id: 'list-1' } as unknown,
      container: { id: 'list-2' } as unknown,
      previousIndex: 0,
      currentIndex: 0,
      dropPoint: { x: 0, y: 0 },
      item: { data: task },
    } as never);

    expect(confettiFn).not.toHaveBeenCalled();
  });

  it('renames a list through the header edit flow', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup();
    await render(KanbanBoard, { providers });

    await user.click(screen.getAllByRole('button', { name: /list options/i })[0]);
    await user.click(await screen.findByRole('menuitem', { name: /edit title/i }));

    const input = await screen.findByLabelText('List title');
    await user.clear(input);
    await user.type(input, 'Renamed{Enter}');

    await waitFor(() =>
      expect(store.updateListTitle).toHaveBeenCalledWith('list-1', { title: 'Renamed' }),
    );
  });

  it('deletes a list through the header delete action', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup();
    await render(KanbanBoard, { providers });

    await user.click(screen.getAllByRole('button', { name: /list options/i })[0]);
    await user.click(await screen.findByRole('menuitem', { name: /delete list/i }));

    await waitFor(() => expect(store.deleteList).toHaveBeenCalledWith('list-1'));
  });

  it('applies label and assignee filters when the toolbar dispatches changes', async () => {
    const { store, providers } = setup();
    store.labels.set([
      { id: 'l1', name: 'Urgent', color: '#EF4444', order: 'a0', createdAt: ts(), updatedAt: ts() },
    ] as never);
    store.collaborators.set([
      { id: 'u1', email: 'alice@example.com', name: 'Alice', isOwner: true },
    ] as never);
    const { fixture } = await render(KanbanBoard, { providers });

    // Emit filter changes from the child components directly rather than
    // driving the popover/menu UI end-to-end. The template listener under test
    // is a one-liner (store.labelFilter.set($event)).
    const debug = fixture.debugElement.nativeElement as HTMLElement;
    const labelFilter = debug.querySelector('app-label-filter');
    const assigneeFilter = debug.querySelector('app-assignee-filter');
    expect(labelFilter).not.toBeNull();
    expect(assigneeFilter).not.toBeNull();

    // Trigger outputs via DebugElement to hit the template listeners.
    const labelDebug = fixture.debugElement.query((el) => el.name === 'app-label-filter');
    const assigneeDebug = fixture.debugElement.query((el) => el.name === 'app-assignee-filter');
    (
      labelDebug.componentInstance as { selectedLabelIdsChange: { emit: (v: string[]) => void } }
    ).selectedLabelIdsChange.emit(['l1']);
    (
      assigneeDebug.componentInstance as {
        selectedAssigneeIdsChange: { emit: (v: string[]) => void };
      }
    ).selectedAssigneeIdsChange.emit(['u1']);

    expect(store.labelFilter()).toEqual(['l1']);
    expect(store.assigneeFilter()).toEqual(['u1']);
  });

  it('forwards a task drop from a list-column to onTaskDrop → store.moveTaskToIndex', async () => {
    const { store, providers } = setup();
    const { fixture } = await render(KanbanBoard, { providers });

    const column = fixture.debugElement.query((el) => el.name === 'app-list-column');
    const container = { id: 'list-1' } as unknown;
    (column.componentInstance as { taskDropped: { emit: (v: unknown) => void } }).taskDropped.emit({
      previousContainer: container,
      container: { id: 'list-2' } as unknown,
      previousIndex: 0,
      currentIndex: 1,
      item: { data: fakeTask() },
    });

    expect(store.moveTaskToIndex).toHaveBeenCalledWith('t1', 'list-2', 1);
  });

  it('reorders a list one slot to the left when moveLeft is emitted from a column', async () => {
    const { store, providers } = setup();
    store.listsWithTasks.set([
      { id: 'list-1', title: 'To Do', order: 'a0', createdAt: ts(), tasks: [] },
      { id: 'list-2', title: 'Doing', order: 'a1', createdAt: ts(), tasks: [] },
    ]);
    const { fixture } = await render(KanbanBoard, { providers });

    const columns = fixture.debugElement.queryAll((el) => el.name === 'app-list-column');
    (columns[1].componentInstance as { moveLeft: { emit: () => void } }).moveLeft.emit();

    expect(store.reorderListToIndex).toHaveBeenCalledWith('list-2', 0);
  });
});
