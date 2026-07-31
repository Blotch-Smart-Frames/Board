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
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'collection', path: segments.join('/') })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ type: 'query', ref, constraints })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  onSnapshot: vi.fn(() => vi.fn()),
}));

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
    assigneeFilter: signal<string | null>(null),
    listsWithTasks: signal([{ id: 'list-1', title: 'To Do', order: 'a0', createdAt: ts(), tasks: [fakeTask()] }]),
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

  it('opens the task detail view, then the edit dialog, saving an update through the store', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup();
    await render(KanbanBoard, { providers });

    await user.click(screen.getByRole('button', { name: /open task existing task/i }));
    await user.click(await screen.findByRole('button', { name: /^edit$/i }));

    const title = await screen.findByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Renamed task');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(store.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Renamed task' })));
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
});
