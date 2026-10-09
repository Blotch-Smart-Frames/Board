import type { Timestamp } from 'firebase/firestore';
import { provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BoardListItem } from './board-list-item';
import type { BoardFolder, BoardWithOrder } from '../data/user-boards.store';

function fakeBoard(): BoardWithOrder {
  return {
    id: 'board-1',
    title: 'Project Alpha',
    ownerId: 'u1',
    collaborators: [],
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
  };
}

const folders: BoardFolder[] = [
  { id: 'f1', name: 'Work', order: 'a0', collapsed: false },
  { id: 'f2', name: 'Personal', order: 'a1', collapsed: true },
];

// CDK opens submenus on hover, so user-event's hover-then-click would toggle it
// straight back shut; a bare click opens it, as a tap does.
async function openFolderSubmenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /options for project alpha/i }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /move to folder/i }));
}

describe('BoardListItem', () => {
  it('links to the board and shows its title', async () => {
    await render(BoardListItem, {
      inputs: { board: fakeBoard() },
      providers: [provideRouter([])],
    });

    const link = screen.getByRole('link', { name: /project alpha/i });
    expect(link).toHaveAttribute('href', '/board/board-1');
  });

  it('emits rename when the Rename menu item is chosen', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    await render(BoardListItem, {
      inputs: { board: fakeBoard() },
      providers: [provideRouter([])],
      on: { rename: onRename },
    });

    await user.click(screen.getByRole('button', { name: /options for project alpha/i }));
    await user.click(await screen.findByRole('menuitem', { name: /rename/i }));

    expect(onRename).toHaveBeenCalled();
  });

  it('emits deleted when the owner chooses the Delete menu item', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const onLeave = vi.fn();
    await render(BoardListItem, {
      inputs: { board: fakeBoard(), isOwner: true },
      providers: [provideRouter([])],
      on: { deleted: onDeleted, leave: onLeave },
    });

    await user.click(screen.getByRole('button', { name: /options for project alpha/i }));
    // Owners get "Delete", never "Leave board".
    expect(screen.queryByRole('menuitem', { name: /leave board/i })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));

    expect(onDeleted).toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('emits leave (and never delete) when a non-owner chooses Leave board', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const onLeave = vi.fn();
    await render(BoardListItem, {
      // isOwner defaults to false.
      inputs: { board: fakeBoard() },
      providers: [provideRouter([])],
      on: { deleted: onDeleted, leave: onLeave },
    });

    await user.click(screen.getByRole('button', { name: /options for project alpha/i }));
    expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: /leave board/i }));

    expect(onLeave).toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('exposes a keyboard drag handle and position-gated move options', async () => {
    const user = userEvent.setup();
    const onMoveDown = vi.fn();
    await render(BoardListItem, {
      inputs: { board: fakeBoard(), canMoveUp: false, canMoveDown: true },
      providers: [provideRouter([])],
      on: { moveDown: onMoveDown },
    });

    expect(screen.getByRole('button', { name: /drag to reorder board/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /options for project alpha/i }));
    expect(screen.queryByRole('menuitem', { name: /move up/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /move down/i }));

    expect(onMoveDown).toHaveBeenCalled();
  });

  it('hides the drag handle when dragDisabled is true (touch/mobile)', async () => {
    await render(BoardListItem, {
      inputs: { board: fakeBoard(), dragDisabled: true },
      providers: [provideRouter([])],
    });

    expect(
      screen.queryByRole('button', { name: /drag to reorder board/i }),
    ).not.toBeInTheDocument();
  });

  it('emits moveUp when the "Move up" menu item is chosen', async () => {
    const user = userEvent.setup();
    const onMoveUp = vi.fn();
    await render(BoardListItem, {
      inputs: { board: fakeBoard(), canMoveUp: true, canMoveDown: false },
      providers: [provideRouter([])],
      on: { moveUp: onMoveUp },
    });

    await user.click(screen.getByRole('button', { name: /options for project alpha/i }));
    await user.click(await screen.findByRole('menuitem', { name: /move up/i }));

    expect(onMoveUp).toHaveBeenCalled();
  });

  it('moves a root board into another folder from the "Move to folder" submenu', async () => {
    const user = userEvent.setup();
    const onMoveToFolder = vi.fn();
    await render(BoardListItem, {
      inputs: { board: fakeBoard(), folders },
      providers: [provideRouter([])],
      on: { moveToFolder: onMoveToFolder },
    });

    await openFolderSubmenu(user);

    // A root board can't be taken out of a folder, so there's no remove option.
    expect(screen.queryByRole('menuitem', { name: /remove from folder/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'Work' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Personal' }));

    expect(onMoveToFolder).toHaveBeenCalledWith('f2');
  });

  it('offers the other folders and "Remove from folder" for a board inside a folder', async () => {
    const user = userEvent.setup();
    const onMoveToFolder = vi.fn();
    await render(BoardListItem, {
      inputs: { board: fakeBoard(), folders, folderId: 'f1' },
      providers: [provideRouter([])],
      on: { moveToFolder: onMoveToFolder },
    });

    await openFolderSubmenu(user);

    expect(screen.queryByRole('menuitem', { name: 'Work' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: /remove from folder/i }));

    expect(onMoveToFolder).toHaveBeenCalledWith(null);
  });

  it('emits newFolder from the submenu, which is the only option with no folders yet', async () => {
    const user = userEvent.setup();
    const onNewFolder = vi.fn();
    await render(BoardListItem, {
      inputs: { board: fakeBoard() },
      providers: [provideRouter([])],
      on: { newFolder: onNewFolder },
    });

    await openFolderSubmenu(user);

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: /new folder/i }));

    expect(onNewFolder).toHaveBeenCalled();
  });
});
