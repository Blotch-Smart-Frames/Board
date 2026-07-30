import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ListColumn, type ListWithTasks } from './list-column';
import { BoardStore } from '../data/board.store';
import type { Task } from '../../../shared/types/board';

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Task 1',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'u1',
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

function fakeList(tasks: Task[]): ListWithTasks {
  return { id: 'list-1', title: 'To Do', order: 'a0', createdAt: {} as Timestamp, tasks };
}

// TaskCard injects BoardStore; provide a minimal fake for the whole column.
const storeProvider = {
  provide: BoardStore,
  useValue: { collaborators: signal([]), setTaskCompleted: vi.fn() },
};

describe('ListColumn', () => {
  it('renders active tasks and hides completed ones behind a disclosure', async () => {
    const list = fakeList([
      fakeTask({ id: 't1', title: 'Active task' }),
      fakeTask({ id: 't2', title: 'Done task', completedAt: {} as Timestamp }),
    ]);
    await render(ListColumn, { inputs: { list }, providers: [storeProvider] });

    expect(screen.getByText('Active task')).toBeInTheDocument();
    expect(screen.getByText('Completed (1)')).toBeInTheDocument();
  });

  it('shows an empty state when there are no active tasks', async () => {
    await render(ListColumn, { inputs: { list: fakeList([]) }, providers: [storeProvider] });

    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
  });

  it('emits addTask with the trimmed title', async () => {
    const user = userEvent.setup();
    const onAddTask = vi.fn();
    await render(ListColumn, {
      inputs: { list: fakeList([]) },
      providers: [storeProvider],
      on: { addTask: onAddTask },
    });

    await user.click(screen.getByRole('button', { name: /add a task/i }));
    await user.type(screen.getByLabelText('Task title'), '  New task  {Enter}');

    expect(onAddTask).toHaveBeenCalledWith('New task');
  });
});
