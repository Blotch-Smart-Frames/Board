import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideMarkdown } from 'ngx-markdown';
import { TaskDetailDialog } from './task-detail-dialog';
import { BoardStore } from '../data/board.store';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { BoardService } from '../../../core/services/board.service';
import { StorageService } from '../../../core/services/storage.service';
import type {
  Board,
  Collaborator,
  Label,
  List,
  Sprint,
  Task,
} from '../../../shared/types/board';

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

function fakeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 's1',
    name: 'Sprint 1',
    startDate: ts(new Date(2026, 0, 1)),
    endDate: ts(new Date(2026, 0, 14)),
    order: 'a0',
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    ...overrides,
  };
}

type SetupOpts = {
  labels?: Label[];
  collaborators?: Collaborator[];
  lists?: List[];
  sprints?: Sprint[];
  board?: Board | null;
};

function setup(task: Task, opts: SetupOpts = {}) {
  const store = {
    boardId: signal('board-1'),
    tasks: signal<Task[]>([task]),
    labels: signal<Label[]>(opts.labels ?? []),
    collaborators: signal<Collaborator[]>(opts.collaborators ?? []),
    sprints: signal<Sprint[]>(opts.sprints ?? []),
    board: signal<Board | null>(opts.board ?? null),
    listsWithTasks: signal((opts.lists ?? [fakeList('list-1', 'To Do', 'a0')]).map((l) => ({ ...l, tasks: [] }))),
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
      provideMarkdown(),
    ],
  };
}

async function openWith(task: Task, opts: SetupOpts = {}) {
  const { store, providers } = setup(task, opts);
  const view = await render(TaskDetailDialog, { providers });
  view.fixture.componentInstance.open(task);
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  return { ...view, store };
}

describe('TaskDetailDialog', () => {
  it('shows the task title, description, and due date', async () => {
    await openWith(fakeTask({ description: 'Some notes', dueDate: ts(new Date(2026, 5, 1)) }));

    expect(await screen.findByRole('heading', { name: 'Existing task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Some notes');
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-06-01');
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

  it('saves an edited title after clicking it and blurring', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask());

    await user.click(await screen.findByRole('heading', { name: 'Existing task' }));
    const input = screen.getByLabelText('Title');
    await user.clear(input);
    await user.type(input, 'Updated title');
    await user.tab();

    await waitFor(() =>
      expect(store.updateTask).toHaveBeenCalledWith('t1', { title: 'Updated title' }),
    );
  });

  it('does not save an empty title and reverts it on blur', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask());

    await user.click(await screen.findByRole('heading', { name: 'Existing task' }));
    const input = screen.getByLabelText('Title');
    await user.clear(input);
    await user.tab();

    expect(store.updateTask).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Existing task' })).toBeInTheDocument();
  });

  it('saves an edited description on blur', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask());

    const description = screen.getByLabelText('Description');
    await user.type(description, 'New notes');
    await user.tab();

    await waitFor(() =>
      expect(store.updateTask).toHaveBeenCalledWith('t1', { description: 'New notes' }),
    );
  });

  it('flags a due date earlier than the start date', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask());

    await user.type(screen.getByLabelText('Start date'), '2026-06-10');
    await user.tab();
    await user.type(screen.getByLabelText('Due date'), '2026-06-01');
    await user.tab();

    expect(screen.getByText(/due date must be on or after the start date/i)).toBeInTheDocument();
    expect(store.updateTask).not.toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ dueDate: expect.anything() }),
    );
  });

  it('saves the selected sprint through the sprint picker', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask(), {
      sprints: [fakeSprint({ name: 'Sprint A' })],
    });

    await user.click(await screen.findByRole('combobox', { name: 'Sprint' }));
    await user.click(await screen.findByRole('option', { name: /sprint a/i }));

    await waitFor(() =>
      expect(store.updateTask).toHaveBeenCalledWith('t1', { sprintId: 's1' }),
    );
  });

  it('deletes the task and closes the dialog when Delete is clicked', async () => {
    const user = userEvent.setup();
    const { store } = await openWith(fakeTask());

    await user.click(await screen.findByRole('button', { name: /delete/i }));

    expect(store.deleteTask).toHaveBeenCalledWith('t1');
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

  describe('calendar sync toggle', () => {
    it('is disabled when there is no due date', async () => {
      await openWith(fakeTask({ dueDate: undefined }));

      const toggle = await screen.findByRole('switch', { name: /sync with google calendar/i });
      expect(toggle).toHaveAttribute('data-disabled', 'true');
    });

    it('shows a hint when the due date is empty', async () => {
      await openWith(fakeTask({ dueDate: undefined }));

      expect(screen.getByText(/set a due date to enable calendar sync/i)).toBeInTheDocument();
    });

    it('saves calendarSyncEnabled: true when toggled on with a due date set', async () => {
      const user = userEvent.setup();
      const { store } = await openWith(fakeTask({ dueDate: ts(new Date(2026, 5, 1)) }));

      await user.click(await screen.findByRole('switch', { name: /sync with google calendar/i }));

      await waitFor(() =>
        expect(store.updateTask).toHaveBeenCalledWith('t1', { calendarSyncEnabled: true }),
      );
    });
  });
});
