import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TaskMigrateForm, type MigrateSubmit } from './task-migrate-form';
import { UserBoardsStore, type BoardWithOrder } from '../../../boards/data/user-boards.store';
import { FIRESTORE_DB } from '../../../../core/firebase/firebase.config';
import type { List } from '../../../../shared/types/board';

// TaskMigrateForm subscribes to the target board's lists via collectionSignal,
// which calls onSnapshot. We drive that subscription synchronously in tests by
// exposing the captured callback per query.
const listCallbacks = new Map<string, (snap: unknown) => void>();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: { path: string }, ..._constraints: unknown[]) => ({
    type: 'query',
    path: ref.path,
  })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  onSnapshot: vi.fn((ref: { path: string }, onNext: (snap: unknown) => void) => {
    listCallbacks.set(ref.path, onNext);
    return vi.fn();
  }),
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

function fakeBoard(id: string, title: string): BoardWithOrder {
  return {
    id,
    title,
    ownerId: 'u1',
    collaborators: [],
    createdAt: ts(new Date()),
    updatedAt: ts(new Date()),
  };
}

function fakeList(id: string, title: string, order = 'a0'): List {
  return { id, title, order, createdAt: ts(new Date()) };
}

function emitListsFor(boardId: string, lists: List[]): void {
  const cb = listCallbacks.get(`boards/${boardId}/lists`);
  cb?.({ docs: lists.map((l) => ({ id: l.id, data: () => l })) });
}

function setup(opts: { boards?: BoardWithOrder[] } = {}) {
  listCallbacks.clear();
  const userBoardsStore = { boards: signal(opts.boards ?? []) };
  return {
    userBoardsStore,
    providers: [
      { provide: FIRESTORE_DB, useValue: {} },
      { provide: UserBoardsStore, useValue: userBoardsStore },
    ],
  };
}

async function renderForm(
  opts: {
    boards?: BoardWithOrder[];
    errorMessage?: string | null;
    isSubmitting?: boolean;
    onSubmit?: (value: MigrateSubmit) => void;
  } = {},
) {
  const { userBoardsStore, providers } = setup(opts);
  const view = await render(TaskMigrateForm, {
    providers,
    inputs: {
      sourceBoardId: 'board-1',
      ...(opts.errorMessage !== undefined ? { errorMessage: opts.errorMessage } : {}),
      ...(opts.isSubmitting !== undefined ? { isSubmitting: opts.isSubmitting } : {}),
    },
    ...(opts.onSubmit ? { on: { submitMigration: opts.onSubmit } } : {}),
  });
  return { ...view, userBoardsStore };
}

describe('TaskMigrateForm', () => {
  it('excludes the current board from the target combobox', async () => {
    const user = userEvent.setup();
    await renderForm({
      boards: [fakeBoard('board-1', 'Current'), fakeBoard('board-2', 'Other')],
    });

    await user.click(screen.getByRole('combobox', { name: 'Target board' }));

    expect(await screen.findByRole('option', { name: 'Other' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Current' })).not.toBeInTheDocument();
  });

  it('disables the list combobox until a target board is selected', async () => {
    await renderForm({ boards: [fakeBoard('board-2', 'Other')] });

    expect(screen.getByRole('combobox', { name: 'Target list' })).toBeDisabled();
  });

  it('disables Move task until both a board and list are picked, then emits submitMigration', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    await renderForm({
      boards: [fakeBoard('board-2', 'Other Board')],
      onSubmit,
    });

    const submit = screen.getByRole('button', { name: /move task/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('combobox', { name: 'Target board' }));
    await user.click(await screen.findByRole('option', { name: 'Other Board' }));

    emitListsFor('board-2', [fakeList('list-x', 'Backlog')]);

    await user.click(screen.getByRole('combobox', { name: 'Target list' }));
    await user.click(await screen.findByRole('option', { name: 'Backlog' }));

    await waitFor(() => expect(submit).not.toBeDisabled());

    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledWith({
      boardId: 'board-2',
      listId: 'list-x',
      boardTitle: 'Other Board',
    });
  });

  it('surfaces the errorMessage input as a destructive alert', async () => {
    await renderForm({
      boards: [fakeBoard('board-2', 'Other')],
      errorMessage: 'offline',
    });

    expect(await screen.findByText('offline')).toBeInTheDocument();
  });

  it('disables Move task and shows a spinner while isSubmitting is true', async () => {
    await renderForm({
      boards: [fakeBoard('board-2', 'Other')],
      isSubmitting: true,
    });

    expect(screen.getByRole('button', { name: /move task/i })).toBeDisabled();
  });

  it('resets the picked list when the target board changes', async () => {
    const user = userEvent.setup();
    await renderForm({
      boards: [fakeBoard('board-2', 'B2'), fakeBoard('board-3', 'B3')],
    });

    await user.click(screen.getByRole('combobox', { name: 'Target board' }));
    await user.click(await screen.findByRole('option', { name: 'B2' }));

    emitListsFor('board-2', [fakeList('l1', 'Backlog')]);
    await user.click(screen.getByRole('combobox', { name: 'Target list' }));
    await user.click(await screen.findByRole('option', { name: 'Backlog' }));

    // Switch to the second target board — the previously picked list should
    // no longer be selected, since it belongs to a different board.
    await user.click(screen.getByRole('combobox', { name: 'Target board' }));
    await user.click(await screen.findByRole('option', { name: 'B3' }));

    expect(screen.getByRole('button', { name: /move task/i })).toBeDisabled();
  });

  it('shows a "no longer available" error when the target board disappears mid-flow', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { userBoardsStore } = await renderForm({
      boards: [fakeBoard('board-2', 'Other Board')],
      onSubmit,
    });

    await user.click(screen.getByRole('combobox', { name: 'Target board' }));
    await user.click(await screen.findByRole('option', { name: 'Other Board' }));

    emitListsFor('board-2', [fakeList('list-x', 'Backlog')]);

    await user.click(screen.getByRole('combobox', { name: 'Target list' }));
    await user.click(await screen.findByRole('option', { name: 'Backlog' }));

    // Simulate the target board being deleted before submission.
    userBoardsStore.boards.set([]);

    await user.click(screen.getByRole('button', { name: /move task/i }));

    expect(await screen.findByText(/target board is no longer available/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('is a no-op when submit is called without both a board and list selected', async () => {
    const onSubmit = vi.fn();
    const { fixture } = await renderForm({
      boards: [fakeBoard('board-2', 'Other')],
      onSubmit,
    });

    // No selections yet — submit early-returns.
    fixture.componentInstance['submit']();

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
