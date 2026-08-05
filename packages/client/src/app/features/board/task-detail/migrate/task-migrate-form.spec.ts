import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TaskMigrateForm } from './task-migrate-form';
import { BoardStore } from '../../data/board.store';
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
  const boardStore = {
    migrateTaskToBoard: vi.fn().mockResolvedValue('new-task-id'),
  };
  return {
    userBoardsStore,
    boardStore,
    providers: [
      { provide: FIRESTORE_DB, useValue: {} },
      { provide: UserBoardsStore, useValue: userBoardsStore },
      { provide: BoardStore, useValue: boardStore },
    ],
  };
}

async function renderForm(opts: { boards?: BoardWithOrder[] } = {}) {
  const { userBoardsStore, boardStore, providers } = setup(opts);
  const view = await render(TaskMigrateForm, {
    providers,
    inputs: { taskId: 't1', sourceBoardId: 'board-1' },
  });
  return { ...view, userBoardsStore, boardStore };
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

  it('disables Move task until both a board and list are picked, then delegates to the store', async () => {
    const user = userEvent.setup();
    const { boardStore } = await renderForm({
      boards: [fakeBoard('board-2', 'Other Board')],
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

    await waitFor(() =>
      expect(boardStore.migrateTaskToBoard).toHaveBeenCalledWith(
        't1',
        'board-2',
        'list-x',
        'Other Board',
      ),
    );
  });

  it('surfaces the store error when migration fails', async () => {
    const user = userEvent.setup();
    const { boardStore } = await renderForm({
      boards: [fakeBoard('board-2', 'Other Board')],
    });
    boardStore.migrateTaskToBoard.mockRejectedValue(new Error('offline'));

    await user.click(screen.getByRole('combobox', { name: 'Target board' }));
    await user.click(await screen.findByRole('option', { name: 'Other Board' }));

    emitListsFor('board-2', [fakeList('list-x', 'Backlog')]);

    await user.click(screen.getByRole('combobox', { name: 'Target list' }));
    await user.click(await screen.findByRole('option', { name: 'Backlog' }));

    await user.click(screen.getByRole('button', { name: /move task/i }));

    expect(await screen.findByText('offline')).toBeInTheDocument();
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
    const { userBoardsStore, boardStore } = await renderForm({
      boards: [fakeBoard('board-2', 'Other Board')],
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
    expect(boardStore.migrateTaskToBoard).not.toHaveBeenCalled();
  });

  it('falls back to a generic error message when the store throws a non-Error value', async () => {
    const user = userEvent.setup();
    const { boardStore } = await renderForm({
      boards: [fakeBoard('board-2', 'Other Board')],
    });
    boardStore.migrateTaskToBoard.mockRejectedValue('kaboom');

    await user.click(screen.getByRole('combobox', { name: 'Target board' }));
    await user.click(await screen.findByRole('option', { name: 'Other Board' }));

    emitListsFor('board-2', [fakeList('list-x', 'Backlog')]);

    await user.click(screen.getByRole('combobox', { name: 'Target list' }));
    await user.click(await screen.findByRole('option', { name: 'Backlog' }));

    await user.click(screen.getByRole('button', { name: /move task/i }));

    expect(await screen.findByText(/failed to migrate task/i)).toBeInTheDocument();
  });

  it('is a no-op when submit is called without both a board and list selected', async () => {
    const { boardStore, fixture } = await renderForm({
      boards: [fakeBoard('board-2', 'Other')],
    });

    // No selections yet — submit early-returns.
    await fixture.componentInstance['submit']();

    expect(boardStore.migrateTaskToBoard).not.toHaveBeenCalled();
  });
});
