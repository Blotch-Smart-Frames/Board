import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TaskDialog } from './task-dialog';
import type { Sprint, Task } from '../../../shared/types/board';

// jsdom lacks these; the sprint picker's hlm-select touches them once its
// option list opens (active-descendant highlighting + overlay positioning).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoViewPolyfill(): void {};

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

function fakeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 's1',
    name: 'Sprint 1',
    startDate: ts(new Date(2026, 0, 1)),
    endDate: ts(new Date(2026, 0, 14)),
    order: 'a0',
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    ...overrides,
  };
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

async function openWith(
  task: Task | null,
  saveHandler = vi.fn().mockResolvedValue(undefined),
  deleteHandler: (() => Promise<void>) | null = null,
  sprints: Sprint[] = [],
) {
  const view = await render(TaskDialog, {
    inputs: { saveHandler, deleteHandler, boardId: 'board-1', labels: [], collaborators: [], sprints },
  });
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

  it('includes the selected sprint when saving', async () => {
    const user = userEvent.setup();
    const { saveHandler } = await openWith(fakeTask(), undefined, null, [fakeSprint({ name: 'Sprint A' })]);

    await user.click(await screen.findByRole('combobox', { name: 'Sprint' }));
    await user.click(await screen.findByRole('option', { name: /sprint a/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(saveHandler).toHaveBeenCalledWith(expect.objectContaining({ sprintId: 's1' })));
  });

  it('deletes the task from the dialog when a delete handler is provided', async () => {
    const user = userEvent.setup();
    const deleteHandler = vi.fn().mockResolvedValue(undefined);
    await openWith(fakeTask(), vi.fn(), deleteHandler);

    await user.click(await screen.findByRole('button', { name: /delete/i }));

    expect(deleteHandler).toHaveBeenCalled();
  });
});
