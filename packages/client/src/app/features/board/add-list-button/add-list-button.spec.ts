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

  it('emits when the Add list button is clicked and returns to the trigger view', async () => {
    const user = userEvent.setup();
    const onAdded = vi.fn();
    await render(AddListButton, { on: { listAdded: onAdded } });

    await user.click(screen.getByRole('button', { name: /add another list/i }));
    await user.type(screen.getByLabelText('List title'), 'Backlog');
    await user.click(screen.getByRole('button', { name: /^add list$/i }));

    expect(onAdded).toHaveBeenCalledWith('Backlog');
    expect(screen.getByRole('button', { name: /add another list/i })).toBeInTheDocument();
  });

  it('cancels the draft when the Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onAdded = vi.fn();
    await render(AddListButton, { on: { listAdded: onAdded } });

    await user.click(screen.getByRole('button', { name: /add another list/i }));
    await user.type(screen.getByLabelText('List title'), 'Draft');
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /add another list/i })).toBeInTheDocument();
  });

  it('cancels the draft when Escape is pressed in the input', async () => {
    const user = userEvent.setup();
    await render(AddListButton);

    await user.click(screen.getByRole('button', { name: /add another list/i }));
    await user.type(screen.getByLabelText('List title'), 'Draft{Escape}');

    expect(screen.getByRole('button', { name: /add another list/i })).toBeInTheDocument();
  });

  it('prevents the mousedown on Add list from stealing focus from the input', async () => {
    await render(AddListButton);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /add another list/i }));
    await user.type(screen.getByLabelText('List title'), 'Backlog');

    // Mousedown default is prevented so the input keeps focus (the click still fires).
    const addButton = screen.getByRole('button', { name: /^add list$/i });
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    addButton.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
