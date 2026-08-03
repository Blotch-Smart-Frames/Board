import { Component, computed, inject, input, output } from '@angular/core';
import { TimelineScaleService } from '../data/timeline-scale.service';
import { TimelineItemDragController } from './drag-controller/drag-controller';
import type { TimelineItemData, TimelineSpan } from '../data/timeline-data';
import type { Label, Task } from '../../../shared/types/board';

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
      (pointerdown)="controller.onBodyPointerDown($event)"
      (pointermove)="controller.onBodyPointerMove($event)"
      (pointerup)="controller.onBodyPointerUp($event)"
      (pointercancel)="controller.onCancel()"
      (keydown.enter)="view.emit(item().task)"
    >
      <div
        class="absolute inset-y-0 start-0 z-10 w-2.5 cursor-ew-resize"
        aria-hidden="true"
        (pointerdown)="controller.onResizePointerDown($event, 'start')"
        (pointermove)="controller.onResizePointerMove($event)"
        (pointerup)="controller.onResizePointerUp($event)"
        (pointercancel)="controller.onCancel()"
      ></div>

      <span class="pointer-events-none truncate px-2 text-sm font-medium">{{
        item().task.title
      }}</span>

      <div
        class="absolute inset-y-0 end-0 z-10 w-2.5 cursor-ew-resize"
        aria-hidden="true"
        (pointerdown)="controller.onResizePointerDown($event, 'end')"
        (pointermove)="controller.onResizePointerMove($event)"
        (pointerup)="controller.onResizePointerUp($event)"
        (pointercancel)="controller.onCancel()"
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

  protected readonly color = computed(() => {
    const match = this.labels().find((label) => this.item().task.labelIds?.includes(label.id));
    return match?.color ?? 'var(--primary)';
  });

  protected readonly controller = new TimelineItemDragController(this.scale, {
    getSpan: () => this.item().span,
    getRowId: () => this.item().rowId,
    getTask: () => this.item().task,
    onView: (task) => this.view.emit(task),
    onMoved: (event) => this.moved.emit(event),
    onResized: (span) => this.resized.emit(span),
  });

  protected readonly left = computed(() =>
    this.scale.valueToPixels(this.controller.liveSpan().start - this.scale.range().start),
  );
  protected readonly width = computed(() =>
    this.scale.valueToPixels(this.controller.liveSpan().end - this.controller.liveSpan().start),
  );
}
