import { computed, signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { provideRouter, Router } from '@angular/router';
import { fireEvent, render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  UserBoardsStore,
  type BoardNode,
  type BoardWithOrder,
  type FolderNode,
  type SidebarNode,
} from '../data/user-boards.store';
import { BoardsSidebar } from './boards-sidebar';
import { toast } from '@spartan-ng/brain/sonner';
import type { Subject } from 'rxjs';

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

function boardNode(board: BoardWithOrder, folderId: string | null = null): BoardNode {
  return { kind: 'board', id: board.id, board: { ...board, order: '' }, folderId };
}

function folderNode(id: string, name: string, boards: BoardWithOrder[], collapsed = false) {
  return {
    kind: 'folder',
    id,
    folder: { id, name, order: '', collapsed },
    boards: boards.map((board) => boardNode(board, id)),
  } satisfies FolderNode;
}

/** Accepts plain boards (all at the root) or a ready-made sidebar tree. */
function setup(items: (BoardWithOrder | SidebarNode)[], isLoading = false) {
  const sidebar = signal<SidebarNode[]>(
    items.map((item) => ('kind' in item ? item : boardNode(item))),
  );
  const store = {
    sidebar,
    folders: computed(() =>
      sidebar()
        .filter((node): node is FolderNode => node.kind === 'folder')
        .map((node) => node.folder),
    ),
    isLoading: signal(isLoading),
    currentUserId: signal<string | null>('u1'),
    createBoard: vi.fn().mockResolvedValue(fakeBoard('new-board', 'New Board')),
    renameBoard: vi.fn().mockResolvedValue(undefined),
    deleteBoard: vi.fn().mockResolvedValue(undefined),
    leaveBoard: vi.fn().mockResolvedValue(undefined),
    moveBoard: vi.fn().mockResolvedValue(undefined),
    moveBoardToFolder: vi.fn().mockResolvedValue(undefined),
    moveFolder: vi.fn().mockResolvedValue(undefined),
    createFolder: vi.fn().mockResolvedValue('new-folder'),
    renameFolder: vi.fn().mockResolvedValue(undefined),
    setFolderCollapsed: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
  };
  return {
    store,
    providers: [provideRouter([]), { provide: UserBoardsStore, useValue: store }],
  };
}

type Sidebar = BoardsSidebar & Record<string, (...args: never[]) => unknown>;

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
    // The expand fade-in stays off for the first render.
    expect(host).not.toHaveAttribute('data-reveal-on-expand');

    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(host.classList.contains('w-14')).toBe(true);
    expect(host).toHaveAttribute('data-reveal-on-expand');
    // While collapsed the icon-only "Create board" button is used.
    expect(screen.getByRole('button', { name: /create board/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(host.classList.contains('w-70')).toBe(true);
    expect(screen.getByText('My Board')).toHaveClass('sidebar-reveal');
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

  it('is a no-op when the rename handlers run without a target set', async () => {
    const { store, providers } = setup([]);
    const { fixture } = await render(BoardsSidebar, { providers });
    const sidebar = fixture.componentInstance as unknown as {
      renameHandler: (title: string) => Promise<void>;
      renameFolderHandler: (name: string) => Promise<void>;
    };

    await sidebar.renameHandler('Ignored');
    await sidebar.renameFolderHandler('Ignored');

    expect(store.renameBoard).not.toHaveBeenCalled();
    expect(store.renameFolder).not.toHaveBeenCalled();
  });

  describe('reordering from menus', () => {
    it('moves a root board up and down', async () => {
      const user = userEvent.setup();
      const { store, providers } = setup([fakeBoard('1', 'Alpha'), fakeBoard('2', 'Beta')]);
      await render(BoardsSidebar, { providers });

      await user.click(screen.getByRole('button', { name: /options for beta/i }));
      await user.click(await screen.findByRole('menuitem', { name: /move up/i }));
      expect(store.moveBoard).toHaveBeenCalledWith('2', null, 0);

      await user.click(screen.getByRole('button', { name: /options for alpha/i }));
      await user.click(await screen.findByRole('menuitem', { name: /move down/i }));
      expect(store.moveBoard).toHaveBeenCalledWith('1', null, 1);
    });

    it('moves a board up and down within its folder', async () => {
      const user = userEvent.setup();
      const { store, providers } = setup([
        folderNode('f1', 'Work', [fakeBoard('1', 'Alpha'), fakeBoard('2', 'Beta')]),
      ]);
      await render(BoardsSidebar, { providers });

      await user.click(screen.getByRole('button', { name: /options for beta/i }));
      await user.click(await screen.findByRole('menuitem', { name: /move up/i }));
      expect(store.moveBoard).toHaveBeenCalledWith('2', 'f1', 0);

      await user.click(screen.getByRole('button', { name: /options for alpha/i }));
      await user.click(await screen.findByRole('menuitem', { name: /move down/i }));
      expect(store.moveBoard).toHaveBeenCalledWith('1', 'f1', 1);
    });

    it('moves a folder up and down among the root items', async () => {
      const user = userEvent.setup();
      const { store, providers } = setup([
        fakeBoard('1', 'Alpha'),
        folderNode('f1', 'Work', []),
        fakeBoard('2', 'Beta'),
      ]);
      await render(BoardsSidebar, { providers });

      await user.click(screen.getByRole('button', { name: /options for folder work/i }));
      await user.click(await screen.findByRole('menuitem', { name: /move up/i }));
      expect(store.moveFolder).toHaveBeenCalledWith('f1', 0);

      await user.click(screen.getByRole('button', { name: /options for folder work/i }));
      await user.click(await screen.findByRole('menuitem', { name: /move down/i }));
      expect(store.moveFolder).toHaveBeenCalledWith('f1', 2);
    });

    it('shows an error toast when a layout change fails to save', async () => {
      const user = userEvent.setup();
      const { store, providers } = setup([fakeBoard('1', 'Alpha'), fakeBoard('2', 'Beta')]);
      store.moveBoard.mockRejectedValue(new Error('offline'));
      await render(BoardsSidebar, { providers });

      await user.click(screen.getByRole('button', { name: /options for beta/i }));
      await user.click(await screen.findByRole('menuitem', { name: /move up/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/sidebar layout/i)),
      );
    });
  });

  describe('folders', () => {
    it('shows an expanded folder with its boards, and toggles it closed', async () => {
      const user = userEvent.setup();
      const { store, providers } = setup([
        folderNode('f1', 'Work', [fakeBoard('1', 'Alpha')]),
        fakeBoard('2', 'Beta'),
      ]);
      await render(BoardsSidebar, { providers });

      const group = screen.getByRole('group', { name: 'Work' });
      expect(group).toContainElement(screen.getByRole('link', { name: /alpha/i }));
      expect(group).not.toContainElement(screen.getByRole('link', { name: /beta/i }));

      await user.click(screen.getByRole('button', { name: /work, 1 board/i }));
      expect(store.setFolderCollapsed).toHaveBeenCalledWith('f1', true);
    });

    it('hides the boards of a collapsed folder, and toggles it open', async () => {
      const user = userEvent.setup();
      const { store, providers } = setup([
        folderNode('f1', 'Work', [fakeBoard('1', 'Alpha')], true),
      ]);
      await render(BoardsSidebar, { providers });

      expect(screen.queryByRole('link', { name: /alpha/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /work, 1 board/i }));
      expect(store.setFolderCollapsed).toHaveBeenCalledWith('f1', false);
    });

    it('shows a hint inside an empty folder', async () => {
      const { providers } = setup([folderNode('f1', 'Work', [])]);
      await render(BoardsSidebar, { providers });

      expect(screen.getByText(/no boards in this folder/i)).toBeInTheDocument();
    });

    it('creates a folder from the footer button', async () => {
      const user = userEvent.setup();
      const { store, providers } = setup([fakeBoard('1', 'Alpha')]);
      await render(BoardsSidebar, { providers });

      await user.click(screen.getByRole('button', { name: /^new folder$/i }));
      await user.type(await screen.findByLabelText(/folder name/i), 'Work');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(store.createFolder).toHaveBeenCalledWith('Work'));
      expect(store.moveBoardToFolder).not.toHaveBeenCalled();
    });

    it('files a board into a folder from its "Move to folder" submenu', async () => {
      const user = userEvent.setup();
      const { store, providers } = setup([fakeBoard('1', 'Alpha'), folderNode('f1', 'Work', [])]);
      await render(BoardsSidebar, { providers });

      await user.click(screen.getByRole('button', { name: /options for alpha/i }));
      fireEvent.click(await screen.findByRole('menuitem', { name: /move to folder/i }));
      await user.click(await screen.findByRole('menuitem', { name: 'Work' }));

      expect(store.moveBoardToFolder).toHaveBeenCalledWith('1', 'f1');
    });

    it('takes a board out of its folder from the submenu', async () => {
      const user = userEvent.setup();
      const { store, providers } = setup([folderNode('f1', 'Work', [fakeBoard('1', 'Alpha')])]);
      await render(BoardsSidebar, { providers });

      await user.click(screen.getByRole('button', { name: /options for alpha/i }));
      fireEvent.click(await screen.findByRole('menuitem', { name: /move to folder/i }));
      await user.click(await screen.findByRole('menuitem', { name: /remove from folder/i }));

      expect(store.moveBoardToFolder).toHaveBeenCalledWith('1', null);
    });

    it.each([
      ['a root board', [fakeBoard('1', 'Alpha')]],
      ['a board in a folder', [folderNode('f1', 'Work', [fakeBoard('1', 'Alpha')])]],
    ])("creates a folder from %s's menu and moves the board into it", async (_, items) => {
      const user = userEvent.setup();
      const { store, providers } = setup(items);
      await render(BoardsSidebar, { providers });

      await user.click(screen.getByRole('button', { name: /options for alpha/i }));
      fireEvent.click(await screen.findByRole('menuitem', { name: /move to folder/i }));
      await user.click(await screen.findByRole('menuitem', { name: /new folder/i }));
      await user.type(await screen.findByLabelText(/folder name/i), 'Later');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(store.moveBoardToFolder).toHaveBeenCalledWith('1', 'new-folder'));
      expect(store.createFolder).toHaveBeenCalledWith('Later');
    });

    it('renames, deletes and leaves boards inside a folder', async () => {
      const user = userEvent.setup();
      const foreign = { ...fakeBoard('2', 'Shared'), ownerId: 'someone-else' };
      const { store, providers } = setup([
        folderNode('f1', 'Work', [fakeBoard('1', 'Alpha'), foreign]),
      ]);
      await render(BoardsSidebar, { providers });

      await user.click(screen.getByRole('button', { name: /options for alpha/i }));
      await user.click(await screen.findByRole('menuitem', { name: /rename/i }));
      const input = await screen.findByLabelText(/board title/i);
      await user.clear(input);
      await user.type(input, 'Alpha 2');
      await user.click(screen.getByRole('button', { name: /^rename$/i }));
      expect(store.renameBoard).toHaveBeenCalledWith('1', 'Alpha 2');

      await user.click(screen.getByRole('button', { name: /options for alpha/i }));
      await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
      expect(store.deleteBoard).toHaveBeenCalledWith('1');

      await user.click(screen.getByRole('button', { name: /options for shared/i }));
      await user.click(await screen.findByRole('menuitem', { name: /leave board/i }));
      expect(store.leaveBoard).toHaveBeenCalledWith('2');
    });

    it('renames a folder through its menu', async () => {
      const user = userEvent.setup();
      const { store, providers } = setup([folderNode('f1', 'Work', [])]);
      await render(BoardsSidebar, { providers });

      await user.click(screen.getByRole('button', { name: /options for folder work/i }));
      await user.click(await screen.findByRole('menuitem', { name: /rename/i }));
      const input = await screen.findByLabelText(/folder name/i);
      expect(input).toHaveValue('Work');
      await user.clear(input);
      await user.type(input, 'Clients');
      await user.click(screen.getByRole('button', { name: /^rename$/i }));

      expect(store.renameFolder).toHaveBeenCalledWith('f1', 'Clients');
    });

    it('deletes a folder, and shows a toast if that fails', async () => {
      const user = userEvent.setup();
      const { store, providers } = setup([folderNode('f1', 'Work', [])]);
      await render(BoardsSidebar, { providers });

      await user.click(screen.getByRole('button', { name: /options for folder work/i }));
      await user.click(await screen.findByRole('menuitem', { name: /delete folder/i }));
      expect(store.deleteFolder).toHaveBeenCalledWith('f1');

      store.deleteFolder.mockRejectedValue(new Error('offline'));
      await user.click(screen.getByRole('button', { name: /options for folder work/i }));
      await user.click(await screen.findByRole('menuitem', { name: /delete folder/i }));
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Work')),
      );
    });
  });

  describe('drag and drop', () => {
    const alpha = boardNode(fakeBoard('1', 'Alpha'));
    const work = folderNode('f1', 'Work', [fakeBoard('2', 'Beta')]);
    const beta = work.boards[0];
    const root = { id: 'boards-root' };
    const folderList = { id: 'board-folder-f1' };

    async function renderTree() {
      const { store, providers } = setup([alpha, work]);
      const view = await render(BoardsSidebar, { providers });
      return { store, view, sidebar: view.fixture.componentInstance as Sidebar };
    }

    function hover(sidebar: Sidebar, node: SidebarNode, element: Element | null) {
      document.elementFromPoint = vi.fn(() => element);
      sidebar['onDragMoved']({ pointerPosition: { x: 1, y: 1 }, source: { data: node } } as never);
    }

    function drop(
      sidebar: Sidebar,
      node: SidebarNode,
      from: object,
      to: object,
      prev: number,
      cur: number,
    ) {
      sidebar['onDrop']({
        item: { data: node },
        previousContainer: from,
        container: to,
        previousIndex: prev,
        currentIndex: cur,
      } as never);
    }

    it('connects the root list to expanded folders only', async () => {
      const { view } = await renderTree();

      expect(view.container.querySelector('#boards-root')).toBeInTheDocument();
      expect(view.container.querySelector('#board-folder-f1')).toBeInTheDocument();
      expect((view.fixture.componentInstance as Sidebar)['allListIds']()).toEqual([
        'board-folder-f1',
        'boards-root',
      ]);
    });

    it('only lets the innermost hovered list accept an item, and keeps folders out of folders', async () => {
      const { view, sidebar } = await renderTree();
      const canEnter = (node: SidebarNode, list: object) =>
        sidebar['canEnterList']({ data: node } as never, list as never);
      const inFolder = view.container.querySelector('#board-folder-f1 a')!;

      hover(sidebar, alpha, inFolder);
      expect(canEnter(alpha, folderList)).toBe(true);
      expect(canEnter(alpha, root)).toBe(false);
      expect(canEnter(work, folderList)).toBe(false);

      hover(sidebar, alpha, view.container.querySelector('app-board-list-item'));
      expect(canEnter(alpha, root)).toBe(true);
      expect(canEnter(work, root)).toBe(true);

      hover(sidebar, alpha, null); // pointer left the page
      expect(canEnter(alpha, root)).toBe(false);
    });

    it('targets a folder when a board hovers its row, freezing root sorting', async () => {
      const { view, sidebar, store } = await renderTree();
      const folderRow = view.container.querySelector('app-board-folder-header button')!;

      hover(sidebar, work, folderRow); // folders can't go into folders
      expect(sidebar['canSortRoot']()).toBe(true);

      hover(sidebar, alpha, folderRow);
      expect(sidebar['canSortRoot']()).toBe(false);
      view.fixture.detectChanges();
      expect(view.container.querySelector('app-board-folder-header > div')).toHaveClass('ring-2');

      drop(sidebar, alpha, root, root, 0, 1);
      expect(store.moveBoardToFolder).toHaveBeenCalledWith('1', 'f1');
      expect(store.moveBoard).not.toHaveBeenCalled();
      expect(sidebar['canSortRoot']()).toBe(true); // reset after the drop
    });

    it('ignores a board dropped onto the folder it is already in', async () => {
      const { view, sidebar, store } = await renderTree();

      hover(sidebar, beta, view.container.querySelector('app-board-folder-header button'));
      drop(sidebar, beta, folderList, root, 0, 1);

      expect(store.moveBoardToFolder).not.toHaveBeenCalled();
      expect(store.moveBoard).not.toHaveBeenCalled();
    });

    it('moves boards within and between lists, skipping drops back in place', async () => {
      const { sidebar, store } = await renderTree();

      drop(sidebar, alpha, root, root, 0, 0);
      expect(store.moveBoard).not.toHaveBeenCalled();

      drop(sidebar, alpha, root, folderList, 0, 1);
      expect(store.moveBoard).toHaveBeenCalledWith('1', 'f1', 1);

      drop(sidebar, beta, folderList, root, 0, 0);
      expect(store.moveBoard).toHaveBeenCalledWith('2', null, 0);
    });

    it('moves folders within the root list', async () => {
      const { sidebar, store } = await renderTree();

      drop(sidebar, work, root, root, 1, 1);
      expect(store.moveFolder).not.toHaveBeenCalled();

      drop(sidebar, work, root, root, 1, 0);
      expect(store.moveFolder).toHaveBeenCalledWith('f1', 0);
    });

    it('wires both drop lists and every drag item into the handlers', async () => {
      const { CdkDrag, CdkDropList } = await import('@angular/cdk/drag-drop');
      const { view, store } = await renderTree();
      document.elementFromPoint = vi.fn(() => null);

      const lists = view.fixture.debugElement
        .queryAll((el) => !!el.injector.get(CdkDropList, null) && el.attributes['id'] !== undefined)
        .map((el) => el.injector.get(CdkDropList))
        .filter((list, i, all) => all.indexOf(list) === i);
      const drags = view.fixture.debugElement
        .queryAll((el) => el.providerTokens.includes(CdkDrag))
        .map((el) => el.injector.get(CdkDrag));
      expect(lists.map((list) => list.id).sort()).toEqual(['board-folder-f1', 'boards-root']);
      expect(drags).toHaveLength(3);

      for (const drag of drags) {
        (drag._dragRef.moved as unknown as Subject<unknown>).next({
          pointerPosition: { x: 0, y: 0 },
        });
      }
      for (const list of lists) {
        (list.dropped as unknown as { emit: (e: unknown) => void }).emit({
          item: { data: alpha },
          container: list,
          previousContainer: null,
          previousIndex: 0,
          currentIndex: 0,
        });
      }

      expect(store.moveBoard).toHaveBeenCalledWith('1', null, 0);
      expect(store.moveBoard).toHaveBeenCalledWith('1', 'f1', 0);
    });
  });
});
