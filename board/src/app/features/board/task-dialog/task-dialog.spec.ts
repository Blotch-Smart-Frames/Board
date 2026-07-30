import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TaskDialog } from './task-dialog';
import type { Task } from '../../../shared/types/board';

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Original title',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'u1',
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

async function openWith(task: Task | null, saveHandler = vi.fn().mockResolvedValue(undefined), deleteHandler: (() => Promise<void>) | null = null) {
  const view = await render(TaskDialog, { inputs: { saveHandler, deleteHandler } });
  view.fixture.componentInstance.open(task);
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  return { ...view, saveHandler, deleteHandler };
}

describe('TaskDialog', () => {
  it('prefills fields from the task in edit mode', async () => {
    await openWith(fakeTask({ description: 'Some notes', dueDate: ts(new Date(2026, 5, 1)) }));

    expect(await screen.findByRole('heading', { name: /edit task/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Original title');
    expect(screen.getByLabelText('Description')).toHaveValue('Some notes');
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-06-01');
  });

  it('saves edited fields, clearing an emptied optional field to null', async () => {
    const user = userEvent.setup();
    const { saveHandler } = await openWith(fakeTask({ color: '#EF4444' }));

    const title = await screen.findByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Updated title');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(saveHandler).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated title', color: '#EF4444' })),
    );
  });

  it('blocks saving when the title is emptied', async () => {
    const user = userEvent.setup();
    const { saveHandler } = await openWith(fakeTask());

    const title = await screen.findByLabelText('Title');
    await user.clear(title);
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(saveHandler).not.toHaveBeenCalled();
  });

  it('flags a due date earlier than the start date', async () => {
    const user = userEvent.setup();
    const { saveHandler } = await openWith(fakeTask());

    await user.type(await screen.findByLabelText('Start date'), '2026-06-10');
    await user.type(screen.getByLabelText('Due date'), '2026-06-01');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText(/due date must be on or after the start date/i)).toBeInTheDocument();
    expect(saveHandler).not.toHaveBeenCalled();
  });

  it('deletes the task from the dialog when a delete handler is provided', async () => {
    const user = userEvent.setup();
    const deleteHandler = vi.fn().mockResolvedValue(undefined);
    await openWith(fakeTask(), vi.fn(), deleteHandler);

    await user.click(await screen.findByRole('button', { name: /delete/i }));

    expect(deleteHandler).toHaveBeenCalled();
  });
});
