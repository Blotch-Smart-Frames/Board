import { Injectable, computed, signal } from '@angular/core';
import { addDays, endOfDay, startOfDay } from 'date-fns';

export const MS_PER_DAY = 86_400_000;

const DEFAULT_RANGE_PAST_DAYS = 3;
const DEFAULT_RANGE_FUTURE_DAYS = 14;
const DEFAULT_EXPANSION_DAYS = 7;
const DEFAULT_DAY_WIDTH_PX = 120;

export type TimeRange = { start: number; end: number };

function defaultRange(): TimeRange {
  const today = startOfDay(new Date());
  return {
    start: addDays(today, -DEFAULT_RANGE_PAST_DAYS).getTime(),
    end: endOfDay(addDays(today, DEFAULT_RANGE_FUTURE_DAYS)).getTime(),
  };
}

/**
 * Component-scoped (provided per TimelineView, not root) pixel<->time scale for
 * the Gantt view. Uses a fixed px-per-day rather than stretching the range to
 * fit the container's width, since the timeline area is meant to be wider than
 * its scroll viewport (that's what makes near-edge-scroll expansion possible).
 */
@Injectable()
export class TimelineScaleService {
  readonly range = signal<TimeRange>(defaultRange());
  readonly dayWidthPx = signal(DEFAULT_DAY_WIDTH_PX);

  readonly totalWidthPx = computed(() => {
    const { start, end } = this.range();
    return this.valueToPixels(end - start);
  });

  valueToPixels(ms: number): number {
    return (ms / MS_PER_DAY) * this.dayWidthPx();
  }

  pixelsToValue(px: number): number {
    return (px / this.dayWidthPx()) * MS_PER_DAY;
  }

  expandPast(days = DEFAULT_EXPANSION_DAYS): void {
    this.range.update((r) => ({ ...r, start: addDays(new Date(r.start), -days).getTime() }));
  }

  expandFuture(days = DEFAULT_EXPANSION_DAYS): void {
    this.range.update((r) => ({ ...r, end: endOfDay(addDays(new Date(r.end), days)).getTime() }));
  }
}
