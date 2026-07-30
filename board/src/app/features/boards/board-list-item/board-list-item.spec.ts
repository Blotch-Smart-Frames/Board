import type { Timestamp } from 'firebase/firestore';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BoardListItem } from './board-list-item';
import type { BoardWithOrder } from '../data/user-boards.store';

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

  it('emits deleted when the Delete menu item is chosen', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    await render(BoardListItem, {
      inputs: { board: fakeBoard() },
      providers: [provideRouter([])],
      on: { deleted: onDeleted },
    });

    await user.click(screen.getByRole('button', { name: /options for project alpha/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));

    expect(onDeleted).toHaveBeenCalled();
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
});
