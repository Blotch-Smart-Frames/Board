import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AddTaskForm } from './add-task-form';

describe('AddTaskForm', () => {
  it('reveals the textarea only after the "Add a task" trigger is clicked', async () => {
    const user = userEvent.setup();

    await render(AddTaskForm);

    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add a task/i }));

    expect(screen.getByLabelText('Task title')).toBeInTheDocument();
  });

  it('emits addTask with the trimmed title on Enter', async () => {
    const user = userEvent.setup();
    const addTask = vi.fn();

    await render(AddTaskForm, { on: { addTask } });

    await user.click(screen.getByRole('button', { name: /add a task/i }));
    await user.type(screen.getByLabelText('Task title'), '  New task  {Enter}');

    expect(addTask).toHaveBeenCalledWith('New task');
  });

  it('does not emit when the title is blank', async () => {
    const user = userEvent.setup();
    const addTask = vi.fn();

    await render(AddTaskForm, { on: { addTask } });

    await user.click(screen.getByRole('button', { name: /add a task/i }));
    await user.type(screen.getByLabelText('Task title'), '   {Enter}');

    expect(addTask).not.toHaveBeenCalled();
  });

  it('collapses back to the trigger button when Cancel is clicked', async () => {
    const user = userEvent.setup();

    await render(AddTaskForm);

    await user.click(screen.getByRole('button', { name: /add a task/i }));
    await user.type(screen.getByLabelText('Task title'), 'Draft');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add a task/i })).toBeInTheDocument();
  });

  it('cancels the draft when Escape is pressed inside the textarea', async () => {
    const user = userEvent.setup();

    await render(AddTaskForm);

    await user.click(screen.getByRole('button', { name: /add a task/i }));
    await user.type(screen.getByLabelText('Task title'), 'Draft{Escape}');

    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument();
  });

  it('emits when the Add button is clicked', async () => {
    const user = userEvent.setup();
    const addTask = vi.fn();

    await render(AddTaskForm, { on: { addTask } });

    await user.click(screen.getByRole('button', { name: /add a task/i }));
    await user.type(screen.getByLabelText('Task title'), 'From click');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    expect(addTask).toHaveBeenCalledWith('From click');
  });

  it('prevents the mousedown default on Add/Cancel so the textarea keeps focus', async () => {
    const user = userEvent.setup();
    await render(AddTaskForm);

    await user.click(screen.getByRole('button', { name: /add a task/i }));
    await user.type(screen.getByLabelText('Task title'), 'x');

    const addButton = screen.getByRole('button', { name: /^add$/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    for (const button of [addButton, cancelButton]) {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      button.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  });

  it('focuses the textarea on open (effect runs when adding() flips to true)', async () => {
    const user = userEvent.setup();
    await render(AddTaskForm);

    await user.click(screen.getByRole('button', { name: /add a task/i }));

    // The textarea is focused via the effect once it becomes the active element.
    expect(screen.getByLabelText('Task title')).toHaveFocus();
  });
});
