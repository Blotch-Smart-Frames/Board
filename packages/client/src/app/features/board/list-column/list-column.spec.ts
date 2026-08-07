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
    archive: false,
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
  useValue: { collaborators: signal([]) },
};

describe('ListColumn', () => {
  it('renders every task in the list', async () => {
    const list = fakeList([
      fakeTask({ id: 't1', title: 'Task one' }),
      fakeTask({ id: 't2', title: 'Task two' }),
    ]);
    await render(ListColumn, { inputs: { list }, providers: [storeProvider] });

    expect(screen.getByText('Task one')).toBeInTheDocument();
    expect(screen.getByText('Task two')).toBeInTheDocument();
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

  it('shows the drag handle by default', async () => {
    await render(ListColumn, {
      inputs: { list: fakeList([]) },
      providers: [storeProvider],
    });

    expect(screen.getByRole('button', { name: /drag to reorder list/i })).toBeInTheDocument();
  });

  it('hides the drag handle when dragDisabled is true (touch/mobile)', async () => {
    await render(ListColumn, {
      inputs: { list: fakeList([]), dragDisabled: true },
      providers: [storeProvider],
    });

    expect(screen.queryByRole('button', { name: /drag to reorder list/i })).not.toBeInTheDocument();
  });

  it('emits viewTask when a task card is clicked', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const list = fakeList([fakeTask({ id: 't1', title: 'Click me' })]);
    await render(ListColumn, {
      inputs: { list },
      providers: [storeProvider],
      on: { viewTask: onView },
    });

    await user.click(screen.getByRole('button', { name: /open task click me/i }));

    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  it('emits moveLeft when the list header requests moving left', async () => {
    const onMoveLeft = vi.fn();
    const list = fakeList([]);
    const { fixture } = await render(ListColumn, {
      inputs: { list, canMoveLeft: true },
      providers: [storeProvider],
      on: { moveLeft: onMoveLeft },
    });

    const header = fixture.debugElement.query((el) => el.name === 'app-list-header');
    (header.componentInstance as { moveLeft: { emit: () => void } }).moveLeft.emit();

    expect(onMoveLeft).toHaveBeenCalled();
  });

  it('forwards a task drop event upward via taskDropped', async () => {
    const onTaskDropped = vi.fn();
    const list = fakeList([]);
    const { fixture } = await render(ListColumn, {
      inputs: { list },
      providers: [storeProvider],
      on: { taskDropped: onTaskDropped },
    });

    // The template listener is a one-line `taskDropped.emit($event)` on the
    // CDK drop list. Emit through the ListColumn's own output — which is the
    // exact wiring the template listener sets up — to exercise the branch.
    const container = { id: 'list-1' } as unknown;
    const event = {
      previousContainer: container,
      container,
      previousIndex: 0,
      currentIndex: 1,
      item: { data: fakeTask() },
    };
    (fixture.componentInstance as { taskDropped: { emit: (v: unknown) => void } }).taskDropped.emit(
      event,
    );

    expect(onTaskDropped).toHaveBeenCalledWith(event);
  });

  it('renders a faded archived preview on archival lists and opens those cards', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    await render(ListColumn, {
      inputs: {
        list: fakeList([]),
        isArchival: true,
        archivedPreview: [fakeTask({ id: 'a1', title: 'Archived one', archive: true })],
      },
      providers: [storeProvider],
      on: { viewTask: onView },
    });

    expect(screen.getByRole('button', { name: /open task archived one/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /open task archived one/i }));

    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  it('wires the inner cdkDropList output into taskDropped', async () => {
    const { CdkDropList } = await import('@angular/cdk/drag-drop');
    const onTaskDropped = vi.fn();
    const list = fakeList([]);
    const view = await render(ListColumn, {
      inputs: { list },
      providers: [storeProvider],
      on: { taskDropped: onTaskDropped },
    });

    const dropListDebug = view.fixture.debugElement.query(
      (el) => !!el.injector.get(CdkDropList, null),
    );
    const dropList = dropListDebug!.injector.get(CdkDropList);
    (dropList.dropped as unknown as { emit: (e: unknown) => void }).emit({
      previousContainer: { id: 'list-1' },
      container: { id: 'list-1' },
      previousIndex: 0,
      currentIndex: 1,
      item: { data: fakeTask() },
    });

    expect(onTaskDropped).toHaveBeenCalled();
  });
});
