import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TaskSprintTab } from './task-sprint-tab';
import { BoardStore } from '../../data/board.store';
import { SprintService } from '../../../../core/services/sprint.service';
import type { Board, Sprint, Task } from '../../../../shared/types/board';

// jsdom shims — the calendar range component uses the overlay/keymanager APIs
// that touch these globals on open.
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

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Existing task',
    order: 'a0',
    calendarSyncEnabled: false,
    archive: false,
    createdBy: 'u1',
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    ...overrides,
  };
}

function setup(task: Task, sprints: Sprint[] = [], board: Board | null = null) {
  const store = {
    boardId: signal('board-1'),
    sprints: signal<Sprint[]>(sprints),
    board: signal<Board | null>(board),
    updateTask: vi.fn().mockResolvedValue(undefined),
  };
  return {
    store,
    providers: [
      { provide: BoardStore, useValue: store },
      { provide: SprintService, useValue: {} },
    ],
  };
}

describe('TaskSprintTab', () => {
  it('does not offer a Clear button when neither date is set', async () => {
    const { providers } = setup(fakeTask());
    await render(TaskSprintTab, { providers, inputs: { task: fakeTask(), boardId: 'board-1' } });

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('shows the Clear button when start or due date is set, and clears both on click', async () => {
    const user = userEvent.setup();
    const task = fakeTask({
      startDate: ts(new Date(2026, 0, 1)),
      dueDate: ts(new Date(2026, 0, 5)),
    });
    const { store, providers } = setup(task);
    await render(TaskSprintTab, { providers, inputs: { task, boardId: 'board-1' } });

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(store.updateTask).toHaveBeenCalledWith('t1', { startDate: null, dueDate: null });
  });

  it('disables calendar sync and shows a hint when no due date is set', async () => {
    const task = fakeTask();
    const { providers } = setup(task);
    await render(TaskSprintTab, { providers, inputs: { task, boardId: 'board-1' } });

    expect(screen.getByLabelText('Sync with Google Calendar')).toBeDisabled();
    expect(screen.getByText('Set a due date to enable calendar sync')).toBeInTheDocument();
  });

  it('enables calendar sync once a due date is present and reflects the current value', async () => {
    const task = fakeTask({
      dueDate: ts(new Date(2026, 1, 1)),
      calendarSyncEnabled: true,
    });
    const { providers } = setup(task);
    await render(TaskSprintTab, { providers, inputs: { task, boardId: 'board-1' } });

    const toggle = screen.getByLabelText('Sync with Google Calendar');
    expect(toggle).not.toBeDisabled();
    expect(toggle).toBeChecked();
  });

  it('persists a toggle change through the store', async () => {
    const user = userEvent.setup();
    const task = fakeTask({ dueDate: ts(new Date(2026, 1, 1)), calendarSyncEnabled: false });
    const { store, providers } = setup(task);
    await render(TaskSprintTab, { providers, inputs: { task, boardId: 'board-1' } });

    await user.click(screen.getByLabelText('Sync with Google Calendar'));

    expect(store.updateTask).toHaveBeenCalledWith('t1', { calendarSyncEnabled: true });
  });

  it('updates the start date when the calendar range emits a different value', async () => {
    const task = fakeTask({ startDate: ts(new Date(2026, 0, 1)) });
    const { store, providers } = setup(task);
    const view = await render(TaskSprintTab, { providers, inputs: { task, boardId: 'board-1' } });

    // Same date — no update should fire.
    view.fixture.componentInstance['onStartDateChange'](new Date(2026, 0, 1));
    expect(store.updateTask).not.toHaveBeenCalled();

    // Different date — persists.
    view.fixture.componentInstance['onStartDateChange'](new Date(2026, 0, 10));
    expect(store.updateTask).toHaveBeenCalledWith('t1', { startDate: new Date(2026, 0, 10) });

    // Undefined — clears (branch: date is undefined).
    store.updateTask.mockClear();
    view.fixture.componentInstance['onStartDateChange'](undefined);
    expect(store.updateTask).toHaveBeenCalledWith('t1', { startDate: null });
  });

  it('updates the due date when the calendar range emits a different value', async () => {
    const task = fakeTask({ dueDate: ts(new Date(2026, 0, 5)) });
    const { store, providers } = setup(task);
    const view = await render(TaskSprintTab, { providers, inputs: { task, boardId: 'board-1' } });

    view.fixture.componentInstance['onEndDateChange'](new Date(2026, 0, 5));
    expect(store.updateTask).not.toHaveBeenCalled();

    view.fixture.componentInstance['onEndDateChange'](new Date(2026, 0, 15));
    expect(store.updateTask).toHaveBeenCalledWith('t1', { dueDate: new Date(2026, 0, 15) });

    store.updateTask.mockClear();
    view.fixture.componentInstance['onEndDateChange'](undefined);
    expect(store.updateTask).toHaveBeenCalledWith('t1', { dueDate: null });
  });
});
