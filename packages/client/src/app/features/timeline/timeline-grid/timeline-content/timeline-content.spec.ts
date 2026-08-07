import { render, screen } from '@testing-library/angular';
import { TimelineContent } from './timeline-content';
import { TimelineScaleService, MS_PER_DAY } from '../../data/timeline-scale.service';
import type { TimelineItemData, TimelineRow } from '../../data/timeline-data';
import type { Task } from '../../../../shared/types/board';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.setPointerCapture ??= function setPointerCaptureStub(): void {};
document.elementFromPoint ??= (): Element | null => null;

const HEADER_HEIGHT_PX = 40;
const ROW_HEIGHT_PX = 48;

function fakeScale(): TimelineScaleService {
  const scale = new TimelineScaleService();
  scale.dayWidthPx.set(100);
  scale.range.set({ start: 0, end: 20 * MS_PER_DAY });
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
    archive: false,
    archivedAt: null,
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
    span: { start: 2 * MS_PER_DAY, end: 4 * MS_PER_DAY },
    task,
    ...overrides,
  };
}

const baseInputs = {
  scrollState: { scrollLeft: 0, viewportWidth: 1000 },
  rowHeightPx: ROW_HEIGHT_PX,
  headerHeightPx: HEADER_HEIGHT_PX,
};

function pointer(type: string, clientX: number, clientY = 0, pointerId = 1): PointerEvent {
  return new PointerEvent(type, { clientX, clientY, pointerId, button: 0, bubbles: true });
}

describe('TimelineContent', () => {
  it('sizes the content pane to the scale total width', async () => {
    const scale = fakeScale();
    const view = await render(TimelineContent, {
      inputs: { rows: [], items: [], ...baseInputs },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });

    const pane = view.container.firstElementChild as HTMLElement;
    expect(pane.style.width).toBe(`${scale.totalWidthPx()}px`);
  });

  it('groups item bars under their row and renders one bar per item', async () => {
    const rows = [fakeRow('list-1', 'To Do'), fakeRow('list-2', 'Doing')];
    const items = [
      fakeItem({
        id: 't1',
        rowId: 'list-1',
        task: fakeTask({ id: 't1', title: 'Task One', listId: 'list-1' }),
      }),
      fakeItem({
        id: 't2',
        rowId: 'list-2',
        task: fakeTask({ id: 't2', title: 'Task Two', listId: 'list-2' }),
      }),
    ];

    await render(TimelineContent, {
      inputs: { rows, items, ...baseInputs },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
    });

    expect(screen.getByRole('button', { name: 'View task Task One' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View task Task Two' })).toBeInTheDocument();
  });

  it('skips items whose rowId does not match any row', async () => {
    const rows = [fakeRow('list-1', 'To Do')];
    const items = [
      fakeItem({
        id: 't-orphan',
        rowId: 'list-99',
        task: fakeTask({ id: 't-orphan', title: 'Orphan', listId: 'list-99' }),
      }),
    ];

    await render(TimelineContent, {
      inputs: { rows, items, ...baseInputs },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
    });

    expect(screen.queryByRole('button', { name: 'View task Orphan' })).not.toBeInTheDocument();
  });

  it('re-emits viewTask with the task when an item is clicked', async () => {
    const onViewTask = vi.fn();
    const item = fakeItem();

    await render(TimelineContent, {
      inputs: { rows: [fakeRow('list-1', 'To Do')], items: [item], ...baseInputs },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { viewTask: onViewTask },
    });

    const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });
    bar.dispatchEvent(pointer('pointerdown', 500, 100));
    bar.dispatchEvent(pointer('pointermove', 501, 100));
    bar.dispatchEvent(pointer('pointerup', 501, 100));

    expect(onViewTask).toHaveBeenCalledWith(item.task);
  });

  it('re-emits taskMoved with the item id merged in when a bar is dragged', async () => {
    const onTaskMoved = vi.fn();
    const item = fakeItem();

    await render(TimelineContent, {
      inputs: { rows: [fakeRow('list-1', 'To Do')], items: [item], ...baseInputs },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { taskMoved: onTaskMoved },
    });

    const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });
    bar.dispatchEvent(pointer('pointerdown', 0, 0));
    bar.dispatchEvent(pointer('pointermove', 200, 0));
    bar.dispatchEvent(pointer('pointerup', 200, 0));

    expect(onTaskMoved).toHaveBeenCalledWith(expect.objectContaining({ id: item.id, rowId: null }));
  });

  it('re-emits taskResized with the item id merged in when a resize handle is dragged', async () => {
    const onTaskResized = vi.fn();
    const item = fakeItem();

    const view = await render(TimelineContent, {
      inputs: { rows: [fakeRow('list-1', 'To Do')], items: [item], ...baseInputs },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { taskResized: onTaskResized },
    });

    const endHandle = view.container.querySelectorAll('[aria-hidden="true"]')[1];
    endHandle.dispatchEvent(pointer('pointerdown', 0, 0));
    endHandle.dispatchEvent(pointer('pointermove', 100, 0));
    endHandle.dispatchEvent(pointer('pointerup', 100, 0));

    expect(onTaskResized).toHaveBeenCalledWith(
      expect.objectContaining({ id: item.id, span: expect.any(Object) }),
    );
  });
});
