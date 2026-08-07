import { render, screen } from '@testing-library/angular';
import { TimelineItem } from './timeline-item';
import { TimelineScaleService } from '../data/timeline-scale.service';
import type { TimelineItemData } from '../data/timeline-data';
import type { Task } from '../../../shared/types/board';

// jsdom doesn't implement pointer capture or elementFromPoint.
Element.prototype.setPointerCapture ??= function setPointerCaptureStub(): void {};
document.elementFromPoint ??= (): Element | null => null;

const DAY_WIDTH_PX = 100;
const MS_PER_DAY = 86_400_000;

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
  const task = fakeTask();
  return {
    id: task.id,
    rowId: task.listId,
    span: { start: 10 * MS_PER_DAY, end: 12 * MS_PER_DAY },
    task,
    ...overrides,
  };
}

function pointer(type: string, clientX: number, clientY = 0, pointerId = 1): PointerEvent {
  return new PointerEvent(type, { clientX, clientY, pointerId, button: 0, bubbles: true });
}

function fakeScale(): TimelineScaleService {
  const scale = new TimelineScaleService();
  scale.dayWidthPx.set(DAY_WIDTH_PX);
  scale.range.set({ start: 0, end: 30 * MS_PER_DAY });
  return scale;
}

async function setup(item = fakeItem()) {
  const scale = fakeScale();
  const view = await render(TimelineItem, {
    inputs: { item },
    providers: [{ provide: TimelineScaleService, useValue: scale }],
  });
  const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });
  return { ...view, bar, scale };
}

describe('TimelineItem', () => {
  it('positions the bar from its span relative to the visible range', async () => {
    const { bar } = await setup();

    // 10 days in at 100px/day = 1000px; 2-day span = 200px wide.
    expect(bar.style.left).toBe('1000px');
    expect(bar.style.width).toBe('200px');
  });

  it('emits view (not moved) on a small click-like movement', async () => {
    const onView = vi.fn();
    const onMoved = vi.fn();
    const item = fakeItem();

    const view = await render(TimelineItem, {
      inputs: { item },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { view: onView, moved: onMoved },
    });
    const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });

    bar.dispatchEvent(pointer('pointerdown', 500, 100));
    bar.dispatchEvent(pointer('pointermove', 502, 101));
    bar.dispatchEvent(pointer('pointerup', 502, 101));
    view.fixture.detectChanges();

    expect(onView).toHaveBeenCalledWith(item.task);
    expect(onMoved).not.toHaveBeenCalled();
  });

  it('dragging the body reschedules the span, with no lane change in the same row', async () => {
    const onMoved = vi.fn();
    const item = fakeItem();

    const view = await render(TimelineItem, {
      inputs: { item },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { moved: onMoved },
    });
    const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });

    // Drag 300px to the right = 3 days later.
    bar.dispatchEvent(pointer('pointerdown', 0, 0));
    bar.dispatchEvent(pointer('pointermove', 300, 0));
    bar.dispatchEvent(pointer('pointerup', 300, 0));
    view.fixture.detectChanges();

    expect(onMoved).toHaveBeenCalledWith({
      span: { start: 13 * MS_PER_DAY, end: 15 * MS_PER_DAY },
      rowId: null,
    });
  });

  it('dragging the start handle resizes without moving the end', async () => {
    const onResized = vi.fn();
    const item = fakeItem();

    const view = await render(TimelineItem, {
      inputs: { item },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { resized: onResized },
    });

    const handles = view.container.querySelectorAll('[aria-hidden="true"]');
    const startHandle = handles[0];

    startHandle.dispatchEvent(pointer('pointerdown', 0, 0));
    startHandle.dispatchEvent(pointer('pointermove', -100, 0));
    startHandle.dispatchEvent(pointer('pointerup', -100, 0));
    view.fixture.detectChanges();

    expect(onResized).toHaveBeenCalledWith({ start: 9 * MS_PER_DAY, end: 12 * MS_PER_DAY });
  });

  it('clamps a resize so the span never collapses below the minimum', async () => {
    const onResized = vi.fn();
    const item = fakeItem();

    const view = await render(TimelineItem, {
      inputs: { item },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { resized: onResized },
    });

    const handles = view.container.querySelectorAll('[aria-hidden="true"]');
    const startHandle = handles[0];

    // Drag the start handle far past the end (10 days worth of pixels).
    startHandle.dispatchEvent(pointer('pointerdown', 0, 0));
    startHandle.dispatchEvent(pointer('pointermove', 1000, 0));
    startHandle.dispatchEvent(pointer('pointerup', 1000, 0));
    view.fixture.detectChanges();

    // Clamped to end (12 days) minus the 1-day minimum span.
    expect(onResized).toHaveBeenCalledWith({ start: 11 * MS_PER_DAY, end: 12 * MS_PER_DAY });
  });

  it('detects a lane change via elementFromPoint and includes it in moved', async () => {
    const onMoved = vi.fn();
    const item = fakeItem({ rowId: 'list-1' });

    const otherRow = document.createElement('div');
    otherRow.setAttribute('data-row-id', 'list-2');
    document.body.appendChild(otherRow);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(otherRow);

    const view = await render(TimelineItem, {
      inputs: { item },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { moved: onMoved },
    });
    const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });

    bar.dispatchEvent(pointer('pointerdown', 0, 0));
    bar.dispatchEvent(pointer('pointermove', 50, 60));
    bar.dispatchEvent(pointer('pointerup', 50, 60));
    view.fixture.detectChanges();

    expect(onMoved).toHaveBeenCalledWith(expect.objectContaining({ rowId: 'list-2' }));

    otherRow.remove();
    vi.restoreAllMocks();
  });

  it('paints the bar with the first matching label color', async () => {
    const scale = fakeScale();
    const item = fakeItem({ task: fakeTask({ labelIds: ['l1'] }) });
    const labels = [
      { id: 'l1', name: 'Urgent', color: '#FF00FF', order: 'a0', createdAt: {}, updatedAt: {} },
    ] as unknown as Parameters<typeof render>[1] extends { inputs?: infer I } ? never : never;

    await render(TimelineItem, {
      inputs: {
        item,
        labels: [
          { id: 'l1', name: 'Urgent', color: '#FF00FF', order: 'a0', createdAt: {}, updatedAt: {} },
        ] as never,
      },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });
    const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });

    // Browsers may normalize the color; assert a case-insensitive match.
    expect(bar.style.backgroundColor.toLowerCase()).toBe('rgb(255, 0, 255)');
    // Reference labels to satisfy TS narrowing.
    void labels;
  });

  it('opens the task via keyboard Enter', async () => {
    const onView = vi.fn();
    const item = fakeItem();

    await render(TimelineItem, {
      inputs: { item },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { view: onView },
    });
    const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });

    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onView).toHaveBeenCalledWith(item.task);
  });

  it('cancels an in-progress drag on pointercancel and does not emit moved', async () => {
    const onMoved = vi.fn();
    const item = fakeItem();

    const view = await render(TimelineItem, {
      inputs: { item },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { moved: onMoved },
    });
    const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });

    bar.dispatchEvent(pointer('pointerdown', 0, 0));
    bar.dispatchEvent(pointer('pointermove', 200, 0));
    bar.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
    view.fixture.detectChanges();

    expect(onMoved).not.toHaveBeenCalled();
  });

  it('cancels an in-progress resize on pointercancel on either handle', async () => {
    const onResized = vi.fn();
    const item = fakeItem();

    const view = await render(TimelineItem, {
      inputs: { item },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { resized: onResized },
    });

    const handles = view.container.querySelectorAll('[aria-hidden="true"]');
    const startHandle = handles[0];
    const endHandle = handles[1];

    startHandle.dispatchEvent(pointer('pointerdown', 0, 0));
    startHandle.dispatchEvent(pointer('pointermove', -100, 0));
    startHandle.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
    view.fixture.detectChanges();

    expect(onResized).not.toHaveBeenCalled();

    endHandle.dispatchEvent(pointer('pointerdown', 0, 0));
    endHandle.dispatchEvent(pointer('pointermove', 100, 0));
    endHandle.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
    view.fixture.detectChanges();

    expect(onResized).not.toHaveBeenCalled();
  });

  it('ignores right-button and unmatched-pointerId events on the bar and its resize handles', async () => {
    const onMoved = vi.fn();
    const onResized = vi.fn();
    const item = fakeItem();

    const view = await render(TimelineItem, {
      inputs: { item },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
      on: { moved: onMoved, resized: onResized },
    });
    const bar = screen.getByRole('button', { name: `View task ${item.task.title}` });
    const [startHandle, endHandle] = Array.from(
      view.container.querySelectorAll('[aria-hidden="true"]'),
    );

    // Right-button pointerdown on the bar is ignored (event.button !== 0).
    bar.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        button: 2,
        bubbles: true,
        clientX: 0,
        clientY: 0,
      }),
    );
    bar.dispatchEvent(pointer('pointermove', 500, 0, 1));
    bar.dispatchEvent(pointer('pointerup', 500, 0, 1));

    expect(onMoved).not.toHaveBeenCalled();

    // Right-button pointerdown on the start handle is ignored.
    startHandle.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        button: 2,
        bubbles: true,
        clientX: 0,
        clientY: 0,
      }),
    );
    startHandle.dispatchEvent(pointer('pointermove', 100, 0, 1));
    startHandle.dispatchEvent(pointer('pointerup', 100, 0, 1));

    expect(onResized).not.toHaveBeenCalled();

    // Bar pointermove/up with an unmatched pointerId (no active drag) — no-op.
    bar.dispatchEvent(pointer('pointermove', 200, 0, 99));
    bar.dispatchEvent(pointer('pointerup', 200, 0, 99));

    // Resize handle pointermove/up without a prior pointerdown — no-op.
    endHandle.dispatchEvent(pointer('pointermove', 100, 0, 99));
    endHandle.dispatchEvent(pointer('pointerup', 100, 0, 99));

    expect(onMoved).not.toHaveBeenCalled();
    expect(onResized).not.toHaveBeenCalled();
  });
});
