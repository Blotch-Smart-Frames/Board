import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TaskCard } from './task-card';
import { BoardStore } from '../data/board.store';
import type { Task, Label, Collaborator } from '../../../shared/types/board';

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Write tests',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'u1',
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

function setup(task: Task, labels: Label[] = [], collaborators: Collaborator[] = []) {
  const setTaskCompleted = vi.fn().mockResolvedValue(undefined);
  return {
    setTaskCompleted,
    providers: [{ provide: BoardStore, useValue: { collaborators: signal(collaborators), setTaskCompleted } }],
    inputs: { task, labels },
  };
}

describe('TaskCard', () => {
  it('shows the task title', async () => {
    const { providers, inputs } = setup(fakeTask());
    await render(TaskCard, { providers, inputs });

    expect(screen.getByText('Write tests')).toBeInTheDocument();
  });

  it('renders resolved labels and the due date', async () => {
    const label: Label = {
      id: 'l1',
      name: 'Urgent',
      color: '#EF4444',
      order: 'a0',
      createdAt: {} as Timestamp,
      updatedAt: {} as Timestamp,
    };
    const { providers, inputs } = setup(
      fakeTask({ labelIds: ['l1'], dueDate: ts(new Date(2026, 5, 1)) }),
      [label],
    );
    await render(TaskCard, { providers, inputs });

    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Jun 1')).toBeInTheDocument();
  });

  it('emits edit when the card is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const { providers, inputs } = setup(fakeTask());
    await render(TaskCard, { providers, inputs, on: { edit: onEdit } });

    await user.click(screen.getByRole('button', { name: /open task write tests/i }));

    expect(onEdit).toHaveBeenCalled();
  });

  it('toggles completion via the checkbox without opening the card', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const { providers, inputs, setTaskCompleted } = setup(fakeTask());
    await render(TaskCard, { providers, inputs, on: { edit: onEdit } });

    await user.click(screen.getByRole('checkbox', { name: /mark write tests complete/i }));

    expect(setTaskCompleted).toHaveBeenCalledWith('t1', true);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('shows completed tasks with a strikethrough title', async () => {
    const { providers, inputs } = setup(fakeTask({ completedAt: ts(new Date()) }));
    await render(TaskCard, { providers, inputs });

    expect(screen.getByText('Write tests')).toHaveClass('line-through');
  });
});
