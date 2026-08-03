import { Component, computed, inject, input, output } from '@angular/core';
import { TimelineScaleService } from '../../data/timeline-scale.service';
import { CurrentTimeLine } from '../../current-time-line/current-time-line';
import { SprintOverlays } from '../../sprint-overlays/sprint-overlays';
import { TimelineHeader, type ScrollState } from '../../timeline-header/timeline-header';
import { TimelineItem } from '../../timeline-item/timeline-item';
import { TimelineRow } from '../../timeline-row/timeline-row';
import type {
  TimelineItemData,
  TimelineRow as TimelineRowData,
  TimelineSpan,
} from '../../data/timeline-data';
import type { Label, Sprint, Task } from '../../../../shared/types/board';

/**
 * The scrollable content pane: sprint overlays + current-time indicator +
 * paged header + one row per list. Purely presentational — parent owns
 * scroll expansion and layout constants.
 */
@Component({
  selector: 'app-timeline-content',
  imports: [CurrentTimeLine, SprintOverlays, TimelineHeader, TimelineItem, TimelineRow],
  template: `
    <div class="relative flex-1" [style.width.px]="scale.totalWidthPx()">
      <app-sprint-overlays
        [sprints]="sprints()"
        [rowCount]="rows().length"
        [rowHeightPx]="rowHeightPx()"
        [headerHeightPx]="headerHeightPx()"
      />
      <app-timeline-current-time-line />

      <div class="bg-muted border-border border-b-2" [style.height.px]="headerHeightPx()">
        <app-timeline-header [scrollState]="scrollState()" />
      </div>

      @for (row of rows(); track row.id) {
        <app-timeline-row [row]="row">
          @for (item of itemsByRow().get(row.id) ?? []; track item.id) {
            <app-timeline-item
              [item]="item"
              [labels]="labels()"
              (view)="viewTask.emit($event)"
              (moved)="taskMoved.emit({ id: item.id, span: $event.span, rowId: $event.rowId })"
              (resized)="taskResized.emit({ id: item.id, span: $event })"
            />
          }
        </app-timeline-row>
      }
    </div>
  `,
})
export class TimelineContent {
  protected readonly scale = inject(TimelineScaleService);

  readonly rows = input.required<TimelineRowData[]>();
  readonly items = input.required<TimelineItemData[]>();
  readonly labels = input<Label[]>([]);
  readonly sprints = input<Sprint[]>([]);
  readonly scrollState = input.required<ScrollState>();
  readonly rowHeightPx = input.required<number>();
  readonly headerHeightPx = input.required<number>();

  readonly viewTask = output<Task>();
  readonly taskMoved = output<{ id: string; span: TimelineSpan; rowId: string | null }>();
  readonly taskResized = output<{ id: string; span: TimelineSpan }>();

  protected readonly itemsByRow = computed(() => {
    const map = new Map<string, TimelineItemData[]>();
    for (const item of this.items()) {
      const list = map.get(item.rowId) ?? [];
      list.push(item);
      map.set(item.rowId, list);
    }
    return map;
  });
}
