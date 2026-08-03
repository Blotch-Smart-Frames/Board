import { Component, computed, inject, input } from '@angular/core';
import { format } from 'date-fns';
import { TimelineScaleService } from '../data/timeline-scale.service';
import { compareOrder } from '../../../shared/utils/ordering';
import type { Sprint } from '../../../shared/types/board';

// Approximates MUI's blue/orange/green/purple [500] swatches used in source — cosmetic only.
const SPRINT_BAND_COLORS = ['#2196f3', '#ff9800', '#4caf50', '#9c27b0'];

type SprintBand = {
  id: string;
  name: string;
  left: number;
  width: number;
  color: string;
  dateLabel: string;
};

@Component({
  selector: 'app-sprint-overlays',
  template: `
    @for (band of bands(); track band.id) {
      <div
        class="pointer-events-none absolute top-0 flex flex-col overflow-hidden border-x-2"
        [style.left.px]="band.left"
        [style.width.px]="band.width"
        [style.height.px]="totalHeightPx()"
        [style.background-color]="band.color + '33'"
        [style.border-color]="band.color + '80'"
      >
        <div class="sticky top-0 px-1.5 py-1" [style.background-color]="band.color + '59'">
          <p class="truncate text-xs font-semibold">{{ band.name }}</p>
          <p class="text-muted-foreground text-[10px]">{{ band.dateLabel }}</p>
        </div>
      </div>
    }
  `,
})
export class SprintOverlays {
  private readonly scale = inject(TimelineScaleService);

  readonly sprints = input<Sprint[]>([]);
  readonly rowCount = input(0);
  readonly rowHeightPx = input(48);
  readonly headerHeightPx = input(40);

  protected readonly totalHeightPx = computed(() => this.headerHeightPx() + this.rowCount() * this.rowHeightPx());

  protected readonly bands = computed<SprintBand[]>(() => {
    const range = this.scale.range();
    const sorted = [...this.sprints()].sort((a, b) => compareOrder(a.order, b.order));

    return sorted
      .map((sprint, index) => ({
        sprint,
        index,
        start: sprint.startDate.toDate().getTime(),
        end: sprint.endDate.toDate().getTime(),
      }))
      .filter(({ start, end }) => end >= range.start && start <= range.end)
      .map(({ sprint, index, start, end }) => {
        const visibleStart = Math.max(start, range.start);
        const visibleEnd = Math.min(end, range.end);
        return {
          id: sprint.id,
          name: sprint.name,
          left: this.scale.valueToPixels(visibleStart - range.start),
          width: this.scale.valueToPixels(visibleEnd - visibleStart),
          color: SPRINT_BAND_COLORS[index % SPRINT_BAND_COLORS.length],
          dateLabel: `${format(sprint.startDate.toDate(), 'MMM d')} - ${format(sprint.endDate.toDate(), 'MMM d')}`,
        };
      });
  });
}
