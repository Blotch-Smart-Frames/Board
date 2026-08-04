import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ListHeader } from './list-header';

describe('ListHeader', () => {
  it('shows the title and task count', async () => {
    await render(ListHeader, { inputs: { title: 'To Do', taskCount: 3 } });

    expect(screen.getByRole('button', { name: /rename list to do/i })).toHaveTextContent('To Do');
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('commits a renamed title on Enter', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    await render(ListHeader, { inputs: { title: 'To Do', taskCount: 0 }, on: { updateTitle: onUpdate } });

    await user.click(screen.getByRole('button', { name: /rename list to do/i }));
    const input = screen.getByLabelText('List title');
    await user.clear(input);
    await user.type(input, 'In Progress{Enter}');

    expect(onUpdate).toHaveBeenCalledWith('In Progress');
  });

  it('does not emit when the title is unchanged', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    await render(ListHeader, { inputs: { title: 'To Do', taskCount: 0 }, on: { updateTitle: onUpdate } });

    await user.click(screen.getByRole('button', { name: /rename list to do/i }));
    await user.type(screen.getByLabelText('List title'), '{Enter}');

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('cancels editing on Escape without emitting', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    await render(ListHeader, { inputs: { title: 'To Do', taskCount: 0 }, on: { updateTitle: onUpdate } });

    await user.click(screen.getByRole('button', { name: /rename list to do/i }));
    await user.type(screen.getByLabelText('List title'), 'Whatever{Escape}');

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /rename list to do/i })).toBeInTheDocument();
  });

  it('deletes the list from the options menu', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    await render(ListHeader, { inputs: { title: 'To Do', taskCount: 0 }, on: { deleteList: onDelete } });

    await user.click(screen.getByRole('button', { name: /list options/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete list/i }));

    expect(onDelete).toHaveBeenCalled();
  });

  it('offers keyboard move options gated by position and emits them', async () => {
    const user = userEvent.setup();
    const onMoveLeft = vi.fn();
    const onMoveRight = vi.fn();
    await render(ListHeader, {
      inputs: { title: 'To Do', taskCount: 0, canMoveLeft: true, canMoveRight: false },
      on: { moveLeft: onMoveLeft, moveRight: onMoveRight },
    });

    await user.click(screen.getByRole('button', { name: /list options/i }));
    expect(screen.queryByRole('menuitem', { name: /move right/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /move left/i }));

    expect(onMoveLeft).toHaveBeenCalled();
  });
});
