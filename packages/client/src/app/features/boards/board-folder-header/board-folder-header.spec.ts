import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { BoardFolder } from '../data/user-boards.store';
import { BoardFolderHeader } from './board-folder-header';

function folder(overrides: Partial<BoardFolder> = {}): BoardFolder {
  return { id: 'f1', name: 'Work', order: 'a0', collapsed: false, ...overrides };
}

describe('BoardFolderHeader', () => {
  it('shows the name and board count, and tags its host with the folder id', async () => {
    const { container } = await render(BoardFolderHeader, {
      inputs: { folder: folder(), boardCount: 3, contentId: 'list-f1' },
    });

    const toggle = screen.getByRole('button', { name: /work, 3 boards/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'list-f1');
    expect(container).toHaveAttribute('data-folder-id', 'f1');
  });

  it('reports a collapsed folder without pointing at its hidden contents', async () => {
    await render(BoardFolderHeader, {
      inputs: { folder: folder({ collapsed: true }), boardCount: 1, contentId: 'list-f1' },
    });

    const toggle = screen.getByRole('button', { name: /work, 1 board$/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).not.toHaveAttribute('aria-controls');
  });

  it('emits toggle when the folder row is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    await render(BoardFolderHeader, { inputs: { folder: folder() }, on: { toggle: onToggle } });

    await user.click(screen.getByRole('button', { name: /work/i, expanded: true }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('emits rename and deleted from the options menu', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onDeleted = vi.fn();
    await render(BoardFolderHeader, {
      inputs: { folder: folder() },
      on: { rename: onRename, deleted: onDeleted },
    });

    await user.click(screen.getByRole('button', { name: /options for folder work/i }));
    await user.click(await screen.findByRole('menuitem', { name: /rename/i }));
    expect(onRename).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /options for folder work/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete folder/i }));
    expect(onDeleted).toHaveBeenCalled();
  });

  it('offers move options only where the folder can move', async () => {
    const user = userEvent.setup();
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    const view = await render(BoardFolderHeader, {
      inputs: { folder: folder(), canMoveUp: false, canMoveDown: true },
      on: { moveUp: onMoveUp, moveDown: onMoveDown },
    });

    await user.click(screen.getByRole('button', { name: /options for folder work/i }));
    expect(screen.queryByRole('menuitem', { name: /move up/i })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: /move down/i }));
    expect(onMoveDown).toHaveBeenCalled();

    view.fixture.componentRef.setInput('canMoveUp', true);
    view.fixture.componentRef.setInput('canMoveDown', false);
    await user.click(screen.getByRole('button', { name: /options for folder work/i }));
    expect(screen.queryByRole('menuitem', { name: /move down/i })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: /move up/i }));
    expect(onMoveUp).toHaveBeenCalled();
  });

  it('shows a drag handle unless dragging is disabled', async () => {
    const view = await render(BoardFolderHeader, { inputs: { folder: folder() } });
    expect(screen.getByRole('button', { name: /drag to reorder folder/i })).toBeInTheDocument();

    view.fixture.componentRef.setInput('dragDisabled', true);
    view.fixture.detectChanges();
    expect(
      screen.queryByRole('button', { name: /drag to reorder folder/i }),
    ).not.toBeInTheDocument();
  });

  it('highlights the row while a board is dragged over it', async () => {
    const view = await render(BoardFolderHeader, {
      inputs: { folder: folder(), dropTarget: true },
    });

    expect(view.container.firstElementChild).toHaveClass('ring-2');
  });
});
