import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import { provideMarkdown } from 'ngx-markdown';
import { TimelineView } from './timeline-view';
import { BoardStore } from '../../board/data/board.store';
import { AuthStore } from '../../../core/auth/auth.store';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { BoardService } from '../../../core/services/board.service';
import { StorageService } from '../../../core/services/storage.service';
import { SprintService } from '../../../core/services/sprint.service';
import { UserBoardsStore } from '../../boards/data/user-boards.store';
import type { Board, Collaborator, Label, List, Sprint, Task } from '../../../shared/types/board';

// TaskDetailDialog and its children subscribe via collectionSignal — stub the
// SDK so onSnapshot never actually fires during the empty-state renders.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ type: 'query', ref, constraints })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  onSnapshot: vi.fn(() => vi.fn()),
}));

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoViewPolyfill(): void {};
Element.prototype.setPointerCapture ??= function setPointerCaptureStub(): void {};
document.elementFromPoint ??= (): Element | null => null;

function ts(date: Date): Timestamp {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
  } as Timestamp;
}

function fakeList(id: string, title: string, order = 'a0'): List {
  return { id, title, order, createdAt: ts(new Date(2026, 0, 1)) };
}

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Task',
    order: 'a0',
    calendarSyncEnabled: false,
    archive: false,
    archivedAt: null,
    createdBy: 'u1',
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    ...overrides,
  };
}

type SetupOpts = {
  lists?: List[];
  tasks?: Task[];
  labels?: Label[];
  sprints?: Sprint[];
  collaborators?: Collaborator[];
  board?: Board | null;
};

function setup(opts: SetupOpts = {}) {
  const store = {
    boardId: signal('board-1'),
    lists: signal<List[]>(opts.lists ?? []),
    tasks: signal<Task[]>(opts.tasks ?? []),
    labels: signal<Label[]>(opts.labels ?? []),
    sprints: signal<Sprint[]>(opts.sprints ?? []),
    collaborators: signal<Collaborator[]>(opts.collaborators ?? []),
    board: signal<Board | null>(opts.board ?? null),
    listsWithTasks: signal((opts.lists ?? []).map((l) => ({ ...l, tasks: [] }))),
    updateTask: vi.fn().mockResolvedValue(undefined),
    moveTaskToList: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
  };
  return {
    store,
    providers: [
      { provide: BoardStore, useValue: store },
      { provide: FIRESTORE_DB, useValue: {} },
      { provide: AuthStore, useValue: { user: signal({ uid: 'u1' }) } },
      { provide: BoardService, useValue: {} },
      { provide: StorageService, useValue: {} },
      { provide: SprintService, useValue: {} },
      { provide: UserBoardsStore, useValue: { boards: signal([]) } },
      provideMarkdown(),
    ],
  };
}

describe('TimelineView', () => {
  it('shows an empty-board message when there are no lists', async () => {
    const { providers } = setup({ lists: [] });
    await render(TimelineView, { providers });

    expect(
      screen.getByText('No lists in this board. Add a list to start using the timeline.'),
    ).toBeInTheDocument();
  });

  it('shows the "no tasks yet" message when lists exist but no tasks do', async () => {
    const { providers } = setup({ lists: [fakeList('list-1', 'To Do')] });
    await render(TimelineView, { providers });

    expect(screen.getByText('No tasks in this board yet.')).toBeInTheDocument();
  });

  it('shows a hidden-tasks alert when tasks exist without both start and due dates', async () => {
    const { providers } = setup({
      lists: [fakeList('list-1', 'To Do')],
      tasks: [fakeTask({ id: 't1' })],
    });
    await render(TimelineView, { providers });

    expect(screen.getByText('1 task hidden.')).toBeInTheDocument();
    expect(screen.getByText('Tasks need both start and due dates to appear')).toBeInTheDocument();
    expect(
      screen.getByText('Set start and due dates on tasks to see them in the timeline.'),
    ).toBeInTheDocument();
  });

  it('pluralizes the hidden-tasks count when multiple tasks are missing dates', async () => {
    const { providers } = setup({
      lists: [fakeList('list-1', 'To Do')],
      tasks: [fakeTask({ id: 't1' }), fakeTask({ id: 't2' })],
    });
    await render(TimelineView, { providers });

    expect(screen.getByText('2 tasks hidden.')).toBeInTheDocument();
  });

  it('renders the timeline grid once at least one task has both dates', async () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 5);
    const { providers } = setup({
      lists: [fakeList('list-1', 'To Do')],
      tasks: [
        fakeTask({ id: 't1', title: 'Design review', startDate: ts(start), dueDate: ts(end) }),
      ],
    });
    const view = await render(TimelineView, { providers });

    // TimelineGrid renders sidebar list titles + item bars.
    expect(view.container.querySelector('app-timeline-grid')).not.toBeNull();
    expect(screen.queryByText('No tasks in this board yet.')).not.toBeInTheDocument();
  });

  it('persists resize events by writing new start and due dates', async () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 5);
    const { store, providers } = setup({
      lists: [fakeList('list-1', 'To Do')],
      tasks: [fakeTask({ id: 't1', startDate: ts(start), dueDate: ts(end) })],
    });
    const { fixture } = await render(TimelineView, { providers });

    const grid = fixture.debugElement.query((el) => el.name === 'app-timeline-grid');
    (grid.componentInstance as { taskResized: { emit: (v: unknown) => void } }).taskResized.emit({
      id: 't1',
      span: { start: new Date(2026, 0, 2).getTime(), end: new Date(2026, 0, 10).getTime() },
    });

    expect(store.updateTask).toHaveBeenCalledWith('t1', {
      startDate: new Date(2026, 0, 2),
      dueDate: new Date(2026, 0, 10),
    });
  });

  it('persists a move within the same list by writing new dates directly', async () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 5);
    const { store, providers } = setup({
      lists: [fakeList('list-1', 'To Do')],
      tasks: [fakeTask({ id: 't1', startDate: ts(start), dueDate: ts(end) })],
    });
    const { fixture } = await render(TimelineView, { providers });

    const grid = fixture.debugElement.query((el) => el.name === 'app-timeline-grid');
    (grid.componentInstance as { taskMoved: { emit: (v: unknown) => void } }).taskMoved.emit({
      id: 't1',
      span: { start: new Date(2026, 0, 3).getTime(), end: new Date(2026, 0, 7).getTime() },
      rowId: null,
    });

    expect(store.updateTask).toHaveBeenCalledWith('t1', {
      startDate: new Date(2026, 0, 3),
      dueDate: new Date(2026, 0, 7),
    });
    expect(store.moveTaskToList).not.toHaveBeenCalled();
  });

  it('sequences the list-move then date-update when moving across rows', async () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 5);
    const { store, providers } = setup({
      lists: [fakeList('list-1', 'To Do'), fakeList('list-2', 'Doing', 'a1')],
      tasks: [fakeTask({ id: 't1', startDate: ts(start), dueDate: ts(end) })],
    });
    const { fixture } = await render(TimelineView, { providers });

    let resolveMove: (() => void) | undefined;
    store.moveTaskToList.mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolveMove = r;
        }),
    );

    const grid = fixture.debugElement.query((el) => el.name === 'app-timeline-grid');
    (grid.componentInstance as { taskMoved: { emit: (v: unknown) => void } }).taskMoved.emit({
      id: 't1',
      span: { start: new Date(2026, 0, 3).getTime(), end: new Date(2026, 0, 7).getTime() },
      rowId: 'list-2',
    });

    // The list move fires first; updateTask must wait for it.
    expect(store.moveTaskToList).toHaveBeenCalledWith('t1', 'list-2');
    expect(store.updateTask).not.toHaveBeenCalled();

    resolveMove?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(store.updateTask).toHaveBeenCalledWith('t1', {
      startDate: new Date(2026, 0, 3),
      dueDate: new Date(2026, 0, 7),
    });
  });

  it('opens the task detail dialog when a bar is clicked', async () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 5);
    const { providers } = setup({
      lists: [fakeList('list-1', 'To Do')],
      tasks: [fakeTask({ id: 't1', startDate: ts(start), dueDate: ts(end) })],
    });
    const { fixture } = await render(TimelineView, { providers });

    const grid = fixture.debugElement.query((el) => el.name === 'app-timeline-grid');
    const task = fakeTask({ id: 't1', startDate: ts(start), dueDate: ts(end) });
    (grid.componentInstance as { viewTask: { emit: (v: unknown) => void } }).viewTask.emit(task);

    // The dialog surface is queried via viewChild — once opened, the dialog title should appear.
    fixture.detectChanges();
    // Task detail dialog uses aria attributes to expose its title heading.
    expect(await screen.findByRole('heading', { name: task.title })).toBeInTheDocument();
  });

  it('applies optimistic overrides to the items projected into the grid', async () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 5);
    const { providers } = setup({
      lists: [fakeList('list-1', 'To Do'), fakeList('list-2', 'Doing', 'a1')],
      tasks: [fakeTask({ id: 't1', startDate: ts(start), dueDate: ts(end) })],
    });
    const { fixture } = await render(TimelineView, { providers });

    // Sanity check: initial items come straight from the server data.
    const gridDebug = fixture.debugElement.query((el) => el.name === 'app-timeline-grid');
    const gridInstance = gridDebug.componentInstance as { items: () => unknown[] };
    const initial = gridInstance.items() as {
      id: string;
      rowId: string;
      span: { start: number; end: number };
    }[];
    expect(initial).toHaveLength(1);

    // Emit a move that changes both the span and the row.
    const nextSpan = {
      start: new Date(2026, 0, 6).getTime(),
      end: new Date(2026, 0, 10).getTime(),
    };
    (gridDebug.componentInstance as { taskMoved: { emit: (v: unknown) => void } }).taskMoved.emit({
      id: 't1',
      span: nextSpan,
      rowId: 'list-2',
    });
    fixture.detectChanges();

    const overridden = gridInstance.items() as {
      id: string;
      rowId: string;
      span: { start: number; end: number };
    }[];
    expect(overridden[0].span).toEqual(nextSpan);
    expect(overridden[0].rowId).toBe('list-2');
  });

  it('applies a span-only override when a move stays on the same row', async () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 5);
    const { providers } = setup({
      lists: [fakeList('list-1', 'To Do')],
      tasks: [fakeTask({ id: 't1', startDate: ts(start), dueDate: ts(end) })],
    });
    const { fixture } = await render(TimelineView, { providers });

    const gridDebug = fixture.debugElement.query((el) => el.name === 'app-timeline-grid');
    const gridInstance = gridDebug.componentInstance as { items: () => unknown[] };
    const spanOnly = {
      start: new Date(2026, 0, 3).getTime(),
      end: new Date(2026, 0, 7).getTime(),
    };
    (gridDebug.componentInstance as { taskMoved: { emit: (v: unknown) => void } }).taskMoved.emit({
      id: 't1',
      span: spanOnly,
      rowId: null,
    });
    fixture.detectChanges();

    const overridden = gridInstance.items() as {
      id: string;
      rowId: string;
      span: { start: number; end: number };
    }[];
    // The rowId is inherited from the underlying task; only the span override was applied.
    expect(overridden[0].span).toEqual(spanOnly);
    expect(overridden[0].rowId).toBe('list-1');
  });

  it('projects labels and sprints as empty arrays when the store’s signals are undefined', async () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 5);
    const { providers } = setup({
      lists: [fakeList('list-1', 'To Do')],
      tasks: [fakeTask({ id: 't1', startDate: ts(start), dueDate: ts(end) })],
    });
    const { fixture } = await render(TimelineView, { providers });

    const grid = fixture.debugElement.query((el) => el.name === 'app-timeline-grid');
    const gridInstance = grid.componentInstance as {
      labels: () => unknown[];
      sprints: () => unknown[];
    };
    expect(gridInstance.labels()).toEqual([]);
    expect(gridInstance.sprints()).toEqual([]);
  });
});
