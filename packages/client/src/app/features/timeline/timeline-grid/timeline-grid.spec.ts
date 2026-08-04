import { render, screen } from '@testing-library/angular';
import { TimelineGrid } from './timeline-grid';
import { TimelineScaleService, MS_PER_DAY } from '../data/timeline-scale.service';
import type { TimelineItemData, TimelineRow } from '../data/timeline-data';
import type { Task } from '../../../shared/types/board';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.setPointerCapture ??= function setPointerCaptureStub(): void {};
document.elementFromPoint ??= (): Element | null => null;

function fakeScale(): TimelineScaleService {
  const scale = new TimelineScaleService();
  scale.dayWidthPx.set(100);
  scale.range.set({ start: 10 * MS_PER_DAY, end: 20 * MS_PER_DAY });
  return scale;
}

function fakeRow(id: string, title: string): TimelineRow {
  return { id, title };
}

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Design review',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'u1',
    createdAt: {} as Task['createdAt'],
    updatedAt: {} as Task['updatedAt'],
    ...overrides,
  };
}

function fakeItem(overrides: Partial<TimelineItemData> = {}): TimelineItemData {
  const id = overrides.id ?? 't1';
  const rowId = overrides.rowId ?? 'list-1';
  const task = overrides.task ?? fakeTask({ id, listId: rowId });
  return {
    id,
    rowId,
    span: { start: 12 * MS_PER_DAY, end: 14 * MS_PER_DAY },
    task,
    ...overrides,
  };
}

function stubScrollMetrics(
  el: HTMLElement,
  { scrollLeft = 0, scrollWidth = 1000, clientWidth = 500 }: Partial<Record<'scrollLeft' | 'scrollWidth' | 'clientWidth', number>> = {},
) {
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, configurable: true, writable: true });
}

function pointer(type: string, clientX: number, clientY = 0, pointerId = 1): PointerEvent {
  return new PointerEvent(type, { clientX, clientY, pointerId, button: 0, bubbles: true });
}

describe('TimelineGrid', () => {
  it('renders a sidebar row per list and groups item bars under their row', async () => {
    const scale = fakeScale();
    const rows = [fakeRow('list-1', 'To Do'), fakeRow('list-2', 'Doing')];
    const items = [
      fakeItem({ id: 't1', rowId: 'list-1', task: fakeTask({ id: 't1', title: 'Task One', listId: 'list-1' }) }),
      fakeItem({ id: 't2', rowId: 'list-2', task: fakeTask({ id: 't2', title: 'Task Two', listId: 'list-2' }) }),
    ];

    await render(TimelineGrid, {
      inputs: { rows, items },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Doing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View task Task One' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View task Task Two' })).toBeInTheDocument();
  });

  it('re-emits an item view as viewTask with the task', async () => {
    const onViewTask = vi.fn();
    const scale = fakeScale();
    const item = fakeItem();

    await render(TimelineGrid, {
      inputs: { rows: [fakeRow('list-1', 'To Do')], items: [item] },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
      on: { viewTask: onViewTask },
    });

    const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });
    bar.dispatchEvent(pointer('pointerdown', 500, 100));
    bar.dispatchEvent(pointer('pointermove', 501, 100));
    bar.dispatchEvent(pointer('pointerup', 501, 100));

    expect(onViewTask).toHaveBeenCalledWith(item.task);
  });

  it('re-emits an item drag as taskMoved with the item id attached', async () => {
    const onTaskMoved = vi.fn();
    const scale = fakeScale();
    const item = fakeItem();

    await render(TimelineGrid, {
      inputs: { rows: [fakeRow('list-1', 'To Do')], items: [item] },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
      on: { taskMoved: onTaskMoved },
    });

    const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });
    bar.dispatchEvent(pointer('pointerdown', 0, 0));
    bar.dispatchEvent(pointer('pointermove', 200, 0));
    bar.dispatchEvent(pointer('pointerup', 200, 0));

    expect(onTaskMoved).toHaveBeenCalledWith({
      id: item.id,
      span: { start: 14 * MS_PER_DAY, end: 16 * MS_PER_DAY },
      rowId: null,
    });
  });

  it('re-emits an item resize as taskResized with the item id attached', async () => {
    const onTaskResized = vi.fn();
    const scale = fakeScale();
    const item = fakeItem();

    const view = await render(TimelineGrid, {
      inputs: { rows: [fakeRow('list-1', 'To Do')], items: [item] },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
      on: { taskResized: onTaskResized },
    });

    const endHandle = view.container.querySelectorAll('[aria-hidden="true"]')[1];
    endHandle.dispatchEvent(pointer('pointerdown', 0, 0));
    endHandle.dispatchEvent(pointer('pointermove', 100, 0));
    endHandle.dispatchEvent(pointer('pointerup', 100, 0));

    expect(onTaskResized).toHaveBeenCalledWith({ id: item.id, span: { start: 12 * MS_PER_DAY, end: 15 * MS_PER_DAY } });
  });

  it('expands the range on a near-edge scroll and skips expansion when there is nothing to scroll', async () => {
    const scale = fakeScale();
    const view = await render(TimelineGrid, {
      inputs: { rows: [fakeRow('list-1', 'To Do')], items: [] },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });
    const container = view.container.firstElementChild as HTMLElement;

    // Nothing to scroll: scrollWidth === clientWidth, no expansion should occur.
    stubScrollMetrics(container, { scrollLeft: 0, scrollWidth: 500, clientWidth: 500 });
    const rangeBeforeNoop = scale.range();
    container.dispatchEvent(new Event('scroll'));
    view.fixture.detectChanges();
    expect(scale.range()).toEqual(rangeBeforeNoop);

    // Near the right edge with real overflow: expands the future end.
    stubScrollMetrics(container, { scrollLeft: 950, scrollWidth: 1500, clientWidth: 500 });
    const endBefore = scale.range().end;
    container.dispatchEvent(new Event('scroll'));
    view.fixture.detectChanges();
    expect(scale.range().end).toBeGreaterThan(endBefore);
  });

  it('does not expand past when already sitting at scrollLeft 0', async () => {
    const scale = fakeScale();
    const view = await render(TimelineGrid, {
      inputs: { rows: [fakeRow('list-1', 'To Do')], items: [] },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });
    const container = view.container.firstElementChild as HTMLElement;

    stubScrollMetrics(container, { scrollLeft: 0, scrollWidth: 1500, clientWidth: 500 });
    const startBefore = scale.range().start;
    container.dispatchEvent(new Event('scroll'));
    view.fixture.detectChanges();

    expect(scale.range().start).toBe(startBefore);
  });

  it('expands past on a near-left-edge scroll and preserves the visual scroll position', async () => {
    const scale = fakeScale();
    const view = await render(TimelineGrid, {
      inputs: { rows: [fakeRow('list-1', 'To Do')], items: [] },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });
    const container = view.container.firstElementChild as HTMLElement;

    stubScrollMetrics(container, { scrollLeft: 100, scrollWidth: 1500, clientWidth: 500 });
    const startBefore = scale.range().start;

    container.dispatchEvent(new Event('scroll'));
    view.fixture.detectChanges();

    // The range grew backward...
    expect(scale.range().start).toBeLessThan(startBefore);

    // ...and once the content is (simulated to be) wider, the effect compensates scrollLeft
    // so the same content stays under the viewport instead of visually jumping.
    Object.defineProperty(container, 'scrollWidth', { value: 2200, configurable: true });
    view.fixture.detectChanges();
    await view.fixture.whenStable();

    expect(container.scrollLeft).toBe(100 + (2200 - 1500));
  });
});
