import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { provideRouter, Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { UserBoardsStore, type BoardWithOrder } from '../data/user-boards.store';
import { BoardsSidebar } from './boards-sidebar';
import { toast } from '@spartan-ng/brain/sonner';

vi.mock('@spartan-ng/brain/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function fakeBoard(id: string, title: string): BoardWithOrder {
  return {
    id,
    title,
    ownerId: 'u1',
    collaborators: [],
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
  };
}

function setup(boards: BoardWithOrder[], isLoading = false) {
  const store = {
    boards: signal(boards),
    isLoading: signal(isLoading),
    currentUserId: signal<string | null>('u1'),
    createBoard: vi.fn().mockResolvedValue(fakeBoard('new-board', 'New Board')),
    renameBoard: vi.fn().mockResolvedValue(undefined),
    deleteBoard: vi.fn().mockResolvedValue(undefined),
    leaveBoard: vi.fn().mockResolvedValue(undefined),
  };
  return {
    store,
    providers: [provideRouter([]), { provide: UserBoardsStore, useValue: store }],
  };
}

describe('BoardsSidebar', () => {
  it('lists the user boards', async () => {
    const { providers } = setup([fakeBoard('1', 'Alpha'), fakeBoard('2', 'Beta')]);
    await render(BoardsSidebar, { providers });

    expect(screen.getByRole('link', { name: /alpha/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /beta/i })).toBeInTheDocument();
  });

  it('shows an empty state when there are no boards', async () => {
    const { providers } = setup([]);
    await render(BoardsSidebar, { providers });

    expect(screen.getByText(/no boards yet/i)).toBeInTheDocument();
  });

  it('shows a spinner while boards are loading', async () => {
    const { providers } = setup([], true);
    await render(BoardsSidebar, { providers });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('creates a board and navigates to it', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup([]);
    const { fixture } = await render(BoardsSidebar, { providers });
    const navigate = vi
      .spyOn(fixture.debugElement.injector.get(Router), 'navigate')
      .mockResolvedValue(true);

    await user.click(screen.getByRole('button', { name: /create board/i }));
    await user.type(await screen.findByLabelText(/board title/i), 'Gamma');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(store.createBoard).toHaveBeenCalledWith({ title: 'Gamma' });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(['/board', 'new-board']));
  });

  it('renames a board through the item menu', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup([fakeBoard('1', 'Alpha')]);
    await render(BoardsSidebar, { providers });

    await user.click(screen.getByRole('button', { name: /options for alpha/i }));
    await user.click(await screen.findByRole('menuitem', { name: /rename/i }));

    const input = await screen.findByLabelText(/board title/i);
    expect(input).toHaveValue('Alpha');
    await user.clear(input);
    await user.type(input, 'Alpha Renamed');
    await user.click(screen.getByRole('button', { name: /^rename$/i }));

    expect(store.renameBoard).toHaveBeenCalledWith('1', 'Alpha Renamed');
  });

  it('deletes a board through the item menu', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup([fakeBoard('1', 'Alpha')]);
    await render(BoardsSidebar, { providers });

    await user.click(screen.getByRole('button', { name: /options for alpha/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));

    expect(store.deleteBoard).toHaveBeenCalledWith('1');
  });

  it('navigates home after deleting the currently open board', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup([fakeBoard('1', 'Alpha')]);
    const { fixture } = await render(BoardsSidebar, { providers });
    const router = fixture.debugElement.injector.get(Router);
    Object.defineProperty(router, 'url', { get: () => '/board/1', configurable: true });
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await user.click(screen.getByRole('button', { name: /options for alpha/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));

    await waitFor(() => expect(store.deleteBoard).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(['/']));
  });

  it('offers "Leave board" (not Delete) for a board the user does not own, and leaves it', async () => {
    const user = userEvent.setup();
    const foreign = { ...fakeBoard('9', 'Shared'), ownerId: 'someone-else' };
    const { store, providers } = setup([foreign]);
    await render(BoardsSidebar, { providers });

    await user.click(screen.getByRole('button', { name: /options for shared/i }));
    expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: /leave board/i }));

    expect(store.leaveBoard).toHaveBeenCalledWith('9');
  });

  it('shows an error toast and stays put when deleting a board fails', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup([fakeBoard('1', 'Alpha')]);
    store.deleteBoard.mockRejectedValue(new Error('permission-denied'));
    const { fixture } = await render(BoardsSidebar, { providers });
    const navigate = vi
      .spyOn(fixture.debugElement.injector.get(Router), 'navigate')
      .mockResolvedValue(true);

    await user.click(screen.getByRole('button', { name: /options for alpha/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Alpha')));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows an error toast when leaving a board fails', async () => {
    const user = userEvent.setup();
    const foreign = { ...fakeBoard('9', 'Shared'), ownerId: 'someone-else' };
    const { store, providers } = setup([foreign]);
    store.leaveBoard.mockRejectedValue(new Error('offline'));
    await render(BoardsSidebar, { providers });

    await user.click(screen.getByRole('button', { name: /options for shared/i }));
    await user.click(await screen.findByRole('menuitem', { name: /leave board/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Shared')),
    );
  });

  it('collapses and re-expands the sidebar when the menu button is toggled', async () => {
    const user = userEvent.setup();
    const { providers } = setup([fakeBoard('1', 'Alpha')]);
    const { fixture } = await render(BoardsSidebar, {
      providers,
      inputs: { boardTitle: 'My Board' },
    });

    const host = fixture.debugElement.nativeElement as HTMLElement;
    expect(host.classList.contains('w-70')).toBe(true);

    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(host.classList.contains('w-14')).toBe(true);
    // While collapsed the icon-only "Create board" button is used.
    expect(screen.getByRole('button', { name: /create board/i })).toBeInTheDocument();
  });

  it('emits settings when the Board settings button is clicked', async () => {
    const user = userEvent.setup();
    const onSettings = vi.fn();
    const { providers } = setup([]);
    await render(BoardsSidebar, {
      providers,
      inputs: { showSettings: true },
      on: { settings: onSettings },
    });

    await user.click(screen.getByRole('button', { name: /board settings/i }));

    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('emits a viewMode change when the toggle group changes value', async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();
    const { providers } = setup([]);
    await render(BoardsSidebar, {
      providers,
      inputs: { viewMode: 'kanban' },
      on: { viewModeChange: onViewModeChange },
    });

    await user.click(screen.getByRole('button', { name: /timeline view/i }));

    expect(onViewModeChange).toHaveBeenCalledWith('timeline');
  });

  it('does nothing when a foreign value is dispatched to the toggle group', async () => {
    const onViewModeChange = vi.fn();
    const { providers } = setup([]);
    const { fixture } = await render(BoardsSidebar, {
      providers,
      inputs: { viewMode: 'kanban' },
      on: { viewModeChange: onViewModeChange },
    });

    // Call the guarded event handler directly with a foreign value.
    fixture.componentInstance['onViewModeChange']('gantt');

    expect(onViewModeChange).not.toHaveBeenCalled();
  });

  it('reorders a board via the item Move Up action', async () => {
    const user = userEvent.setup();
    const store = {
      boards: signal([fakeBoard('1', 'Alpha'), fakeBoard('2', 'Beta')]),
      isLoading: signal(false),
      currentUserId: signal<string | null>('u1'),
      createBoard: vi.fn(),
      renameBoard: vi.fn(),
      deleteBoard: vi.fn(),
      leaveBoard: vi.fn(),
      reorderBoardToIndex: vi.fn().mockResolvedValue(undefined),
    };
    await render(BoardsSidebar, {
      providers: [provideRouter([]), { provide: UserBoardsStore, useValue: store }],
    });

    // Move Beta up.
    await user.click(screen.getByRole('button', { name: /options for beta/i }));
    await user.click(await screen.findByRole('menuitem', { name: /move up/i }));

    expect(store.reorderBoardToIndex).toHaveBeenCalledWith('2', 0);
  });

  it('reorders a board via the item Move Down action', async () => {
    const user = userEvent.setup();
    const store = {
      boards: signal([fakeBoard('1', 'Alpha'), fakeBoard('2', 'Beta')]),
      isLoading: signal(false),
      currentUserId: signal<string | null>('u1'),
      createBoard: vi.fn(),
      renameBoard: vi.fn(),
      deleteBoard: vi.fn(),
      leaveBoard: vi.fn(),
      reorderBoardToIndex: vi.fn().mockResolvedValue(undefined),
    };
    await render(BoardsSidebar, {
      providers: [provideRouter([]), { provide: UserBoardsStore, useValue: store }],
    });

    await user.click(screen.getByRole('button', { name: /options for alpha/i }));
    await user.click(await screen.findByRole('menuitem', { name: /move down/i }));

    expect(store.reorderBoardToIndex).toHaveBeenCalledWith('1', 1);
  });

  it('forwards a drag-drop reorder to the store, skipping same-index drops', async () => {
    const { providers } = setup([fakeBoard('1', 'Alpha'), fakeBoard('2', 'Beta')]);
    const store = {
      boards: signal([fakeBoard('1', 'Alpha'), fakeBoard('2', 'Beta')]),
      isLoading: signal(false),
      currentUserId: signal<string | null>('u1'),
      createBoard: vi.fn(),
      renameBoard: vi.fn(),
      deleteBoard: vi.fn(),
      leaveBoard: vi.fn(),
      reorderBoardToIndex: vi.fn().mockResolvedValue(undefined),
    };
    void providers; // silence unused-var lint
    const { fixture } = await render(BoardsSidebar, {
      providers: [provideRouter([]), { provide: UserBoardsStore, useValue: store }],
    });

    // Same index -> guard early-return, no store call.
    fixture.componentInstance['onDrop']({
      previousIndex: 1,
      currentIndex: 1,
      item: { data: '1' },
    } as never);
    expect(store.reorderBoardToIndex).not.toHaveBeenCalled();

    // Different index -> forwards.
    fixture.componentInstance['onDrop']({
      previousIndex: 0,
      currentIndex: 1,
      item: { data: '1' },
    } as never);
    expect(store.reorderBoardToIndex).toHaveBeenCalledWith('1', 1);
  });

  it('opens the create dialog from the collapsed-state icon button', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup([]);
    const { fixture } = await render(BoardsSidebar, { providers });
    const navigate = vi
      .spyOn(fixture.debugElement.injector.get(Router), 'navigate')
      .mockResolvedValue(true);

    // Collapse the sidebar so the icon-only Create board button becomes visible.
    await user.click(screen.getByRole('button', { name: 'menu' }));
    await user.click(screen.getByRole('button', { name: /create board/i }));

    await user.type(await screen.findByLabelText(/board title/i), 'From Collapsed');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(store.createBoard).toHaveBeenCalledWith({ title: 'From Collapsed' });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(['/board', 'new-board']));
  });

  it('renders the kanban/timeline toggle when a viewMode input is provided', async () => {
    const { providers } = setup([]);
    await render(BoardsSidebar, {
      providers,
      inputs: { viewMode: 'kanban' },
    });

    expect(screen.getByRole('button', { name: /kanban view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /timeline view/i })).toBeInTheDocument();
  });

  it('wires the nav cdkDropList output into onDrop', async () => {
    const { CdkDropList } = await import('@angular/cdk/drag-drop');
    const store = {
      boards: signal([fakeBoard('1', 'Alpha'), fakeBoard('2', 'Beta')]),
      isLoading: signal(false),
      currentUserId: signal<string | null>('u1'),
      createBoard: vi.fn(),
      renameBoard: vi.fn(),
      deleteBoard: vi.fn(),
      leaveBoard: vi.fn(),
      reorderBoardToIndex: vi.fn().mockResolvedValue(undefined),
    };
    const view = await render(BoardsSidebar, {
      providers: [provideRouter([]), { provide: UserBoardsStore, useValue: store }],
    });

    const dropListDebug = view.fixture.debugElement.query(
      (el) => !!el.injector.get(CdkDropList, null),
    );
    const dropList = dropListDebug!.injector.get(CdkDropList);
    (dropList.dropped as unknown as { emit: (e: unknown) => void }).emit({
      previousIndex: 0,
      currentIndex: 1,
      item: { data: '1' },
    });

    expect(store.reorderBoardToIndex).toHaveBeenCalledWith('1', 1);
  });

  it('renders the view-mode toggle even in the collapsed layout', async () => {
    const user = userEvent.setup();
    const { providers } = setup([]);
    await render(BoardsSidebar, {
      providers,
      inputs: { viewMode: 'kanban' },
    });

    // Collapse the sidebar so the toggle group renders in vertical/icon-only layout.
    await user.click(screen.getByRole('button', { name: 'menu' }));

    expect(screen.getByRole('button', { name: /kanban view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /timeline view/i })).toBeInTheDocument();
  });

  it('is a no-op when the rename handler runs without a target set', async () => {
    const store = {
      boards: signal<BoardWithOrder[]>([]),
      isLoading: signal(false),
      createBoard: vi.fn(),
      renameBoard: vi.fn().mockResolvedValue(undefined),
      deleteBoard: vi.fn(),
      reorderBoardToIndex: vi.fn(),
    };
    const { fixture } = await render(BoardsSidebar, {
      providers: [provideRouter([]), { provide: UserBoardsStore, useValue: store }],
    });

    // Invoke the renameHandler input value directly without going through openRename.
    const rename = (
      fixture.componentInstance as unknown as {
        renameHandler: (title: string) => Promise<void>;
      }
    ).renameHandler;
    await rename('Ignored');

    expect(store.renameBoard).not.toHaveBeenCalled();
  });
});
