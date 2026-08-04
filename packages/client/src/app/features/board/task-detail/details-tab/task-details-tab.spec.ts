import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TaskDetailsTab } from './task-details-tab';
import { BoardStore } from '../../data/board.store';
import { AuthStore } from '../../../../core/auth/auth.store';
import { FIRESTORE_DB } from '../../../../core/firebase/firebase.config';
import { StorageService } from '../../../../core/services/storage.service';
import type {
  Attachment,
  Collaborator,
  Label,
  List,
  Task,
} from '../../../../shared/types/board';

// TaskDetailsTab renders CommentsSection which subscribes via collectionSignal;
// stubbing onSnapshot keeps the empty-state safe under jsdom.
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

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Existing task',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'u1',
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    ...overrides,
  };
}

function fakeList(id: string, title: string, order = 'a0'): List {
  return { id, title, order, createdAt: ts(new Date(2026, 0, 1)) };
}

type SetupOpts = {
  labels?: Label[];
  collaborators?: Collaborator[];
  lists?: List[];
};

function setup(task: Task, opts: SetupOpts = {}) {
  const store = {
    boardId: signal('board-1'),
    labels: signal<Label[]>(opts.labels ?? []),
    collaborators: signal<Collaborator[]>(opts.collaborators ?? []),
    listsWithTasks: signal(
      (opts.lists ?? [fakeList('list-1', 'To Do')]).map((l) => ({ ...l, tasks: [] })),
    ),
    updateTask: vi.fn().mockResolvedValue(undefined),
    moveTaskToList: vi.fn().mockResolvedValue(undefined),
  };
  return {
    store,
    providers: [
      { provide: BoardStore, useValue: store },
      { provide: FIRESTORE_DB, useValue: {} },
      { provide: AuthStore, useValue: { user: signal({ uid: 'u1' }) } },
      { provide: StorageService, useValue: {} },
    ],
  };
}

describe('TaskDetailsTab', () => {
  it('shows the description field seeded from the task', async () => {
    const task = fakeTask({ description: 'Some notes' });
    const { providers } = setup(task);
    await render(TaskDetailsTab, { providers, inputs: { task, boardId: 'board-1' } });

    expect(screen.getByLabelText('Description')).toHaveValue('Some notes');
  });

  it('saves an edited description on blur when changed', async () => {
    const user = userEvent.setup();
    const task = fakeTask({ description: 'old' });
    const { store, providers } = setup(task);
    await render(TaskDetailsTab, { providers, inputs: { task, boardId: 'board-1' } });

    const textarea = screen.getByLabelText('Description');
    await user.clear(textarea);
    await user.type(textarea, 'new');
    await user.tab();

    await waitFor(() =>
      expect(store.updateTask).toHaveBeenCalledWith('t1', { description: 'new' }),
    );
  });

  it('drops an empty description to undefined so the field is cleared', async () => {
    const user = userEvent.setup();
    const task = fakeTask({ description: 'old' });
    const { store, providers } = setup(task);
    await render(TaskDetailsTab, { providers, inputs: { task, boardId: 'board-1' } });

    const textarea = screen.getByLabelText('Description');
    await user.clear(textarea);
    await user.tab();

    await waitFor(() =>
      expect(store.updateTask).toHaveBeenCalledWith('t1', { description: undefined }),
    );
  });

  it('does not call updateTask on blur if the description was not changed', async () => {
    const user = userEvent.setup();
    const task = fakeTask({ description: 'same' });
    const { store, providers } = setup(task);
    await render(TaskDetailsTab, { providers, inputs: { task, boardId: 'board-1' } });

    await user.click(screen.getByLabelText('Description'));
    await user.tab();

    expect(store.updateTask).not.toHaveBeenCalled();
  });

  it('shows the List select only when lists exist and moves the task on change', async () => {
    const user = userEvent.setup();
    const task = fakeTask({ listId: 'list-1' });
    const { store, providers } = setup(task, {
      lists: [fakeList('list-1', 'To Do', 'a0'), fakeList('list-2', 'Doing', 'a1')],
    });
    await render(TaskDetailsTab, { providers, inputs: { task, boardId: 'board-1' } });

    await user.click(screen.getByRole('combobox', { name: 'List' }));
    await user.click(await screen.findByRole('option', { name: 'Doing' }));

    expect(store.moveTaskToList).toHaveBeenCalledWith('t1', 'list-2');
  });

  it('hides the List select when the board has no lists yet', async () => {
    const task = fakeTask();
    const { providers } = setup(task, { lists: [] });
    await render(TaskDetailsTab, { providers, inputs: { task, boardId: 'board-1' } });

    expect(screen.queryByRole('combobox', { name: 'List' })).not.toBeInTheDocument();
  });
});
