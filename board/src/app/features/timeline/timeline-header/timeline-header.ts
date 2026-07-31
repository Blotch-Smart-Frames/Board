import { Component, computed, inject, input } from '@angular/core';
import { format, isSameDay, startOfDay } from 'date-fns';
import { computeVisibleDates } from '../data/timeline-data';
import { MS_PER_DAY, TimelineScaleService } from '../data/timeline-scale.service';

export type ScrollState = { scrollLeft: number; viewportWidth: number };

@Component({
  selector: 'app-timeline-header',
  host: { class: 'relative block h-10 w-full' },
  template: `
    @for (day of visibleDays(); track day.getTime()) {
      <div
        class="text-primary-foreground absolute inset-y-0 box-border flex items-center overflow-hidden border-e px-2"
        [class.bg-primary]="isToday(day)"
        [style.left.px]="dayLeft(day)"
        [style.width.px]="dayWidth()"
      >
        <span class="truncate text-xs" [class.font-semibold]="isToday(day)" [class.text-foreground]="!isToday(day)">
          {{ dayLabel(day) }}
        </span>
      </div>
    }
  `,
})
export class TimelineHeader {
  protected readonly scale = inject(TimelineScaleService);

  readonly scrollState = input.required<ScrollState>();

  protected readonly dayWidth = computed(() => this.scale.valueToPixels(MS_PER_DAY));

  protected readonly visibleDays = computed(() => {
    const range = this.scale.range();
    const scroll = this.scrollState();
    return computeVisibleDates({
      rangeStart: range.start,
      rangeEnd: range.end,
      scrollLeft: scroll.scrollLeft,
      viewportWidth: scroll.viewportWidth,
      dayWidthPixels: this.dayWidth(),
    });
  });

  protected dayLeft(day: Date): number {
    return this.scale.valueToPixels(day.getTime() - this.scale.range().start);
  }

  protected isToday(day: Date): boolean {
    return isSameDay(day, startOfDay(new Date()));
  }

  protected dayLabel(day: Date): string {
    return this.dayWidth() < 60 ? format(day, 'd') : format(day, 'EEE, MMM d');
  }
}
