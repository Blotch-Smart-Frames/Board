import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideMarkdown } from 'ngx-markdown';
import { TaskDetailDialog } from './task-detail-dialog';
import { BoardStore } from '../data/board.store';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { BoardService } from '../../../core/services/board.service';
import { StorageService } from '../../../core/services/storage.service';
import type { Task, Label, Collaborator, List } from '../../../shared/types/board';

// CommentsSection/HistorySection subscribe via collectionSignal, which calls the
// real onSnapshot unless the SDK is mocked. Stub it so it never fires — both
// sections already render an empty state ("No comments yet" / gated behind the
// History tab) in that case.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'collection', path: segments.join('/') })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ type: 'query', ref, constraints })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  onSnapshot: vi.fn(() => vi.fn()),
}));

// jsdom doesn't implement these; the select's active-descendant key manager and
// the popover overlay's size tracking both touch them as soon as an option list opens.
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

function fakeList(id: string, title: string, order: string): List {
  return { id, title, order, createdAt: ts(new Date(2026, 0, 1)) };
}

function fakeCollaborator(overrides: Partial<Collaborator> = {}): Collaborator {
  return { id: 'u9', email: 'u9@example.com', name: 'Bob', isOwner: false, ...overrides };
}

type SetupOpts = {
  labels?: Label[];
  collaborators?: Collaborator[];
  lists?: List[];
};

function setup(task: Task, opts: SetupOpts = {}) {
  const store = {
    boardId: signal('board-1'),
    tasks: signal<Task[]>([task]),
    labels: signal<Label[]>(opts.labels ?? []),
    collaborators: signal<Collaborator[]>(opts.collaborators ?? []),
    listsWithTasks: signal((opts.lists ?? [fakeList('list-1', 'To Do', 'a0')]).map((l) => ({ ...l, tasks: [] }))),
    updateTask: vi.fn().mockResolvedValue(undefined),
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
      provideMarkdown(),
    ],
  };
}

async function openWith(
  task: Task,
  opts: SetupOpts = {},
  on: Record<string, (...args: never[]) => void> = {},
) {
  const { store, providers } = setup(task, opts);
  const view = await render(TaskDetailDialog, { providers, on });
  view.fixture.componentInstance.open(task);
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  return { ...view, store };
}

describe('TaskDetailDialog', () => {
  it('shows the task title, description, and due date', async () => {
    await openWith(fakeTask({ description: 'Some notes', dueDate: ts(new Date(2026, 5, 1)) }));

    expect(await screen.findByRole('heading', { name: 'Existing task' })).toBeInTheDocument();
    expect(screen.getByText('Some notes')).toBeInTheDocument();
    expect(screen.getByText(/due:/i)).toBeInTheDocument();
  });

  it('shows resolved labels for the task', async () => {
    const label: Label = {
      id: 'l1',
      name: 'Urgent',
      color: '#EF4444',
      order: 'a0',
      createdAt: ts(new Date()),
      updatedAt: ts(new Date()),
    };
    await openWith(fakeTask({ labelIds: ['l1'] }), { labels: [label] });

    expect(await screen.findByText('Urgent')).toBeInTheDocument();
  });

  it('shows "No assignees" and expands into a picker that updates assignments', async () => {
    const user = userEvent.setup();
    const collaborator = fakeCollaborator();
    const { store } = await openWith(fakeTask(), { collaborators: [collaborator] });

    expect(screen.getByText('No assignees')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Assignees' }));
    await user.click(screen.getByRole('checkbox', { name: 'Assign Bob' }));

    expect(store.updateTask).toHaveBeenCalledWith('t1', { assignedTo: ['u9'] });
  });

  it('moves the task to a different list through the List select', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask({ listId: 'list-1' }), {
      lists: [fakeList('list-1', 'To Do', 'a0'), fakeList('list-2', 'Doing', 'a1')],
    });

    await user.click(screen.getByRole('combobox', { name: 'List' }));
    await user.click(await screen.findByRole('option', { name: 'Doing' }));

    expect(store.moveTaskToList).toHaveBeenCalledWith('t1', 'list-2');
  });

  it('closes and emits edit when the Edit button is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const task = fakeTask();
    await openWith(task, {}, { edit: onEdit });

    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(onEdit).toHaveBeenCalledWith(task);
  });

  it('shows a synthetic "created this task" row on the History tab', async () => {
    const user = userEvent.setup();
    const creator = fakeCollaborator({ id: 'u1', name: 'Alice' });
    await openWith(fakeTask({ createdBy: 'u1', createdAt: ts(new Date(2026, 0, 1)) }), {
      collaborators: [creator],
    });

    await user.click(screen.getByRole('tab', { name: 'History' }));

    expect(await screen.findByText(/alice created this task/i)).toBeInTheDocument();
  });
});
