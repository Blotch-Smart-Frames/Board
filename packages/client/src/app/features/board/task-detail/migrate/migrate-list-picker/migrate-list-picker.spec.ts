import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MigrateListPicker } from './migrate-list-picker';
import { FIRESTORE_DB } from '../../../../../core/firebase/firebase.config';
import type { List } from '../../../../../shared/types/board';

// The picker subscribes to the target board's lists via collectionSignal,
// which calls onSnapshot. Capturing the callback per query path lets us
// drive it synchronously from the test.
const listCallbacks = new Map<string, (snap: unknown) => void>();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: { path: string }) => ({
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

function fakeList(id: string, title: string, order = 'a0'): List {
  return { id, title, order, createdAt: ts(new Date()) };
}

function emitListsFor(boardId: string, lists: List[]): void {
  const cb = listCallbacks.get(`boards/${boardId}/lists`);
  cb?.({ docs: lists.map((l) => ({ id: l.id, data: () => l })) });
}

async function renderPicker(
  inputs: { boardId: string | null; value?: string | null } = { boardId: null },
) {
  return render(MigrateListPicker, {
    inputs,
    providers: [{ provide: FIRESTORE_DB, useValue: {} }],
  });
}

describe('MigrateListPicker', () => {
  beforeEach(() => {
    listCallbacks.clear();
  });

  it('disables the trigger and prompts to pick a board first', async () => {
    await renderPicker({ boardId: null });

    const trigger = screen.getByRole('combobox', { name: 'Target list' });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent(/select a board first/i);
  });

  it('shows a Loading placeholder while the target board lists are pending', async () => {
    await renderPicker({ boardId: 'board-2' });

    const trigger = screen.getByRole('combobox', { name: 'Target list' });
    // Nothing has been emitted yet — collectionSignal is still undefined.
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent(/loading lists/i);
  });

  it('shows the empty-state hint when the target board has no lists', async () => {
    await renderPicker({ boardId: 'board-2' });

    emitListsFor('board-2', []);

    expect(await screen.findByText(/no lists — create one there first/i)).toBeInTheDocument();
    // The trigger becomes enabled once loading resolves, even with no lists.
    const trigger = screen.getByRole('combobox', { name: 'Target list' });
    expect(trigger).not.toBeDisabled();
  });

  it('lists options sorted by fractional order after lists are emitted', async () => {
    const user = userEvent.setup();
    await renderPicker({ boardId: 'board-2' });

    emitListsFor('board-2', [
      fakeList('l2', 'Doing', 'a1'),
      fakeList('l1', 'Backlog', 'a0'),
      fakeList('l3', 'Done', 'a2'),
    ]);

    await user.click(screen.getByRole('combobox', { name: 'Target list' }));

    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent?.trim())).toEqual(['Backlog', 'Doing', 'Done']);
  });

  it('emits valueChange with the picked list id', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const view = await render(MigrateListPicker, {
      inputs: { boardId: 'board-2' },
      on: { valueChange: onValueChange },
      providers: [{ provide: FIRESTORE_DB, useValue: {} }],
    });

    emitListsFor('board-2', [fakeList('l1', 'Backlog')]);
    view.fixture.detectChanges();

    await user.click(screen.getByRole('combobox', { name: 'Target list' }));
    await user.click(await screen.findByRole('option', { name: 'Backlog' }));

    expect(onValueChange).toHaveBeenCalledWith('l1');
  });

  it('shows the selected list title on the trigger', async () => {
    const view = await renderPicker({ boardId: 'board-2', value: 'l2' });

    emitListsFor('board-2', [fakeList('l1', 'Backlog', 'a0'), fakeList('l2', 'Doing', 'a1')]);
    view.fixture.detectChanges();

    expect(screen.getByRole('combobox', { name: 'Target list' })).toHaveTextContent('Doing');
  });

  it('emits null when the underlying select bubbles a non-string value', async () => {
    const onValueChange = vi.fn();
    const view = await render(MigrateListPicker, {
      inputs: { boardId: 'board-2' },
      on: { valueChange: onValueChange },
      providers: [{ provide: FIRESTORE_DB, useValue: {} }],
    });

    view.fixture.componentInstance['onValueChange'](undefined);

    expect(onValueChange).toHaveBeenCalledWith(null);
  });
});
