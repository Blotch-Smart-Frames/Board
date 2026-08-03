import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AddListButton } from './add-list-button';

describe('AddListButton', () => {
  it('reveals a title input when the trigger is clicked', async () => {
    const user = userEvent.setup();
    await render(AddListButton);

    await user.click(screen.getByRole('button', { name: /add another list/i }));

    expect(screen.getByLabelText('List title')).toBeInTheDocument();
  });

  it('emits the trimmed title on Enter and resets', async () => {
    const user = userEvent.setup();
    const onAdded = vi.fn();
    await render(AddListButton, { on: { listAdded: onAdded } });

    await user.click(screen.getByRole('button', { name: /add another list/i }));
    await user.type(screen.getByLabelText('List title'), '  Backlog  {Enter}');

    expect(onAdded).toHaveBeenCalledWith('Backlog');
    expect(screen.getByRole('button', { name: /add another list/i })).toBeInTheDocument();
  });

  it('does not emit an empty title', async () => {
    const user = userEvent.setup();
    const onAdded = vi.fn();
    await render(AddListButton, { on: { listAdded: onAdded } });

    await user.click(screen.getByRole('button', { name: /add another list/i }));
    await user.type(screen.getByLabelText('List title'), '{Enter}');

    expect(onAdded).not.toHaveBeenCalled();
  });
});
