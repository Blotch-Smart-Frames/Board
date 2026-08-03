import { Component, input } from '@angular/core';
import type { TimelineRow } from '../../data/timeline-data';

/**
 * Left-hand fixed column of the timeline: shows one label cell per row plus
 * a title header. Kept passive so it can share `rowHeightPx` / `headerHeightPx`
 * with the time-axis and stay in vertical lock-step by simple flex layout.
 */
@Component({
  selector: 'app-timeline-sidebar',
  template: `
    <div class="shrink-0" [style.width.px]="widthPx()">
      <div
        class="bg-muted flex items-center border-e border-b px-4"
        [style.height.px]="headerHeightPx()"
      >
        <span class="text-sm font-semibold">Lists</span>
      </div>
      @for (row of rows(); track row.id) {
        <div
          class="border-border flex items-center border-e border-b px-4"
          [style.height.px]="rowHeightPx()"
        >
          <span class="truncate text-sm font-medium">{{ row.title }}</span>
        </div>
      }
    </div>
  `,
})
export class TimelineSidebar {
  readonly rows = input.required<TimelineRow[]>();
  readonly widthPx = input.required<number>();
  readonly headerHeightPx = input.required<number>();
  readonly rowHeightPx = input.required<number>();
}
