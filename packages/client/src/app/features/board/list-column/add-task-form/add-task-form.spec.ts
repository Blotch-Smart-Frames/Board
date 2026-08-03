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
});
