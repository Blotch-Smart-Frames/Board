import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MS_PER_DAY, TimelineScaleService } from '../data/timeline-scale.service';
import type { TimelineItemData, TimelineSpan } from '../data/timeline-data';
import type { Label, Task } from '../../../shared/types/board';

const DRAG_THRESHOLD_PX = 5;
const MIN_SPAN_MS = MS_PER_DAY;

type DragState = { pointerId: number; startClientX: number; originSpan: TimelineSpan };
type ResizeState = { pointerId: number; edge: 'start' | 'end'; startClientX: number; originSpan: TimelineSpan };

/**
 * A draggable/resizable Gantt bar. Horizontal drag (reschedule) and edge-resize
 * both use raw Pointer Events with pointer capture rather than CDK drag-drop —
 * CDK's drag primitives are built for discrete reorder-by-index, not continuous
 * pixel-accurate positioning, and running CDK's own drag lifecycle alongside a
 * second, independent pointer tracker on the same element risked event
 * conflicts that couldn't be verified without a real browser. Lane changes are
 * detected via `elementFromPoint` against each row's `data-row-id`, which is a
 * standard DOM API rather than a CDK-specific mechanism.
 */
@Component({
  selector: 'app-timeline-item',
  template: `
    <div
      class="focus-visible:ring-ring absolute top-1.5 flex h-9 touch-none items-center overflow-hidden rounded-md text-white shadow-sm transition-[filter] outline-none hover:brightness-95 focus-visible:ring-2"
      role="button"
      tabindex="0"
      [attr.aria-label]="'View task ' + item().task.title"
      [style.left.px]="left()"
      [style.width.px]="width()"
      [style.background-color]="color()"
      (pointerdown)="onBodyPointerDown($event)"
      (pointermove)="onBodyPointerMove($event)"
      (pointerup)="onBodyPointerUp($event)"
      (pointercancel)="onCancel()"
      (keydown.enter)="view.emit(item().task)"
    >
      <div
        class="absolute inset-y-0 start-0 z-10 w-2.5 cursor-ew-resize"
        aria-hidden="true"
        (pointerdown)="onResizePointerDown($event, 'start')"
        (pointermove)="onResizePointerMove($event)"
        (pointerup)="onResizePointerUp($event)"
        (pointercancel)="onCancel()"
      ></div>

      <span class="pointer-events-none truncate px-2 text-sm font-medium">{{ item().task.title }}</span>

      <div
        class="absolute inset-y-0 end-0 z-10 w-2.5 cursor-ew-resize"
        aria-hidden="true"
        (pointerdown)="onResizePointerDown($event, 'end')"
        (pointermove)="onResizePointerMove($event)"
        (pointerup)="onResizePointerUp($event)"
        (pointercancel)="onCancel()"
      ></div>
    </div>
  `,
})
export class TimelineItem {
  private readonly scale = inject(TimelineScaleService);

  readonly item = input.required<TimelineItemData>();
  readonly labels = input<Label[]>([]);

  readonly view = output<Task>();
  /** Body-drag ended: `rowId` is set only when the drop lane differs from the item's current row. */
  readonly moved = output<{ span: TimelineSpan; rowId: string | null }>();
  /** Edge-resize ended — never changes lanes. */
  readonly resized = output<TimelineSpan>();

  private readonly dragState = signal<DragState | null>(null);
  private readonly resizeState = signal<ResizeState | null>(null);
  private readonly pointerX = signal(0);
  private downClientX = 0;
  private downClientY = 0;
  private hoveredRowId: string | null = null;

  protected readonly color = computed(() => {
    const match = this.labels().find((label) => this.item().task.labelIds?.includes(label.id));
    return match?.color ?? 'var(--primary)';
  });

  protected readonly liveSpan = computed<TimelineSpan>(() => {
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

    return this.item().span;
  });

  protected readonly left = computed(() =>
    this.scale.valueToPixels(this.liveSpan().start - this.scale.range().start),
  );
  protected readonly width = computed(() => this.scale.valueToPixels(this.liveSpan().end - this.liveSpan().start));

  protected onBodyPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.downClientX = event.clientX;
    this.downClientY = event.clientY;
    this.pointerX.set(event.clientX);
    this.dragState.set({ pointerId: event.pointerId, startClientX: event.clientX, originSpan: this.item().span });
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  protected onBodyPointerMove(event: PointerEvent): void {
    const drag = this.dragState();
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.pointerX.set(event.clientX);
    this.hoveredRowId = this.hitTestRow(event.clientX, event.clientY);
  }

  protected onBodyPointerUp(event: PointerEvent): void {
    const drag = this.dragState();
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = Math.abs(event.clientX - this.downClientX);
    const dy = Math.abs(event.clientY - this.downClientY);
    const finalSpan = this.liveSpan();
    const targetRowId = this.hoveredRowId;
    this.dragState.set(null);
    this.hoveredRowId = null;

    if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) {
      this.view.emit(this.item().task);
      return;
    }

    const rowId = targetRowId && targetRowId !== this.item().rowId ? targetRowId : null;
    this.moved.emit({ span: finalSpan, rowId });
  }

  protected onResizePointerDown(event: PointerEvent, edge: 'start' | 'end'): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    this.pointerX.set(event.clientX);
    this.resizeState.set({
      pointerId: event.pointerId,
      edge,
      startClientX: event.clientX,
      originSpan: this.item().span,
    });
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  protected onResizePointerMove(event: PointerEvent): void {
    const resize = this.resizeState();
    if (!resize || resize.pointerId !== event.pointerId) return;
    event.stopPropagation();
    this.pointerX.set(event.clientX);
  }

  protected onResizePointerUp(event: PointerEvent): void {
    const resize = this.resizeState();
    if (!resize || resize.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const finalSpan = this.liveSpan();
    this.resizeState.set(null);
    this.resized.emit(finalSpan);
  }

  protected onCancel(): void {
    this.dragState.set(null);
    this.resizeState.set(null);
    this.hoveredRowId = null;
  }

  private hitTestRow(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest('[data-row-id]')?.getAttribute('data-row-id') ?? null;
  }
}
