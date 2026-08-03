import { computed, signal } from '@angular/core';
import { MS_PER_DAY, TimelineScaleService } from '../../data/timeline-scale.service';
import type { TimelineSpan } from '../../data/timeline-data';
import type { Task } from '../../../../shared/types/board';

const DRAG_THRESHOLD_PX = 5;
const MIN_SPAN_MS = MS_PER_DAY;

type DragState = { pointerId: number; startClientX: number; originSpan: TimelineSpan };
type ResizeState = {
  pointerId: number;
  edge: 'start' | 'end';
  startClientX: number;
  originSpan: TimelineSpan;
};

type ControllerHooks = {
  readonly getSpan: () => TimelineSpan;
  readonly getRowId: () => string;
  readonly getTask: () => Task;
  readonly onView: (task: Task) => void;
  readonly onMoved: (event: { span: TimelineSpan; rowId: string | null }) => void;
  readonly onResized: (span: TimelineSpan) => void;
};

/**
 * Pointer state + math for the draggable/resizable Gantt bar.
 * Extracted from TimelineItem so the component itself stays a thin,
 * declarative shell. Raw Pointer Events with pointer capture (rather than
 * CDK drag-drop) are still used here — CDK's drag primitives are built for
 * discrete reorder-by-index, not continuous pixel-accurate positioning, and
 * running CDK's own drag lifecycle alongside an independent pointer tracker
 * on the same element risked event conflicts. Lane changes are detected via
 * `elementFromPoint` against each row's `data-row-id`.
 */
export class TimelineItemDragController {
  private readonly dragState = signal<DragState | null>(null);
  private readonly resizeState = signal<ResizeState | null>(null);
  private readonly pointerX = signal(0);
  private downClientX = 0;
  private downClientY = 0;
  private hoveredRowId: string | null = null;

  constructor(
    private readonly scale: TimelineScaleService,
    private readonly hooks: ControllerHooks,
  ) {}

  readonly liveSpan = computed<TimelineSpan>(() => {
    const drag = this.dragState();
    if (drag) {
      const deltaMs = this.scale.pixelsToValue(this.pointerX() - drag.startClientX);
      return { start: drag.originSpan.start + deltaMs, end: drag.originSpan.end + deltaMs };
    }

    const resize = this.resizeState();
    if (resize) {
      const deltaMs = this.scale.pixelsToValue(this.pointerX() - resize.startClientX);
      if (resize.edge === 'start') {
        return {
          start: Math.min(resize.originSpan.start + deltaMs, resize.originSpan.end - MIN_SPAN_MS),
          end: resize.originSpan.end,
        };
      }
      return {
        start: resize.originSpan.start,
        end: Math.max(resize.originSpan.end + deltaMs, resize.originSpan.start + MIN_SPAN_MS),
      };
    }

    return this.hooks.getSpan();
  });

  onBodyPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.downClientX = event.clientX;
    this.downClientY = event.clientY;
    this.pointerX.set(event.clientX);
    this.dragState.set({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      originSpan: this.hooks.getSpan(),
    });
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  onBodyPointerMove(event: PointerEvent): void {
    const drag = this.dragState();
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.pointerX.set(event.clientX);
    this.hoveredRowId = this.hitTestRow(event.clientX, event.clientY);
  }

  onBodyPointerUp(event: PointerEvent): void {
    const drag = this.dragState();
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = Math.abs(event.clientX - this.downClientX);
    const dy = Math.abs(event.clientY - this.downClientY);
    const finalSpan = this.liveSpan();
    const targetRowId = this.hoveredRowId;
    this.dragState.set(null);
    this.hoveredRowId = null;

    if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) {
      this.hooks.onView(this.hooks.getTask());
      return;
    }

    const rowId = targetRowId && targetRowId !== this.hooks.getRowId() ? targetRowId : null;
    this.hooks.onMoved({ span: finalSpan, rowId });
  }

  onResizePointerDown(event: PointerEvent, edge: 'start' | 'end'): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    this.pointerX.set(event.clientX);
    this.resizeState.set({
      pointerId: event.pointerId,
      edge,
      startClientX: event.clientX,
      originSpan: this.hooks.getSpan(),
    });
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  onResizePointerMove(event: PointerEvent): void {
    const resize = this.resizeState();
    if (!resize || resize.pointerId !== event.pointerId) return;
    event.stopPropagation();
    this.pointerX.set(event.clientX);
  }

  onResizePointerUp(event: PointerEvent): void {
    const resize = this.resizeState();
    if (!resize || resize.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const finalSpan = this.liveSpan();
    this.resizeState.set(null);
    this.hooks.onResized(finalSpan);
  }

  onCancel(): void {
    this.dragState.set(null);
    this.resizeState.set(null);
    this.hoveredRowId = null;
  }

  private hitTestRow(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest('[data-row-id]')?.getAttribute('data-row-id') ?? null;
  }
}
