import { useMemo } from 'react';
import { startOfDay, addDays, differenceInDays } from 'date-fns';

type UseVisibleDatesOptions = {
  rangeStart: number;
  rangeEnd: number;
  scrollLeft: number;
  viewportWidth: number;
  dayWidthPixels: number;
  buffer?: number;
};

export function useVisibleDates({
  rangeStart,
  rangeEnd,
  scrollLeft,
  viewportWidth,
  dayWidthPixels,
  buffer = 3,
}: UseVisibleDatesOptions): Date[] {
  return useMemo(() => {
    const startDate = startOfDay(new Date(rangeStart));
    const endDate = startOfDay(new Date(rangeEnd));
    const totalDays = differenceInDays(endDate, startDate) + 1;

    // Safety check: if range is invalid, return empty array
    if (totalDays <= 0) {
      return [];
    }

    if (dayWidthPixels <= 0 || viewportWidth <= 0) {
      // Fallback: return all days if dimensions aren't ready
      return Array.from({ length: totalDays }, (_, i) => addDays(startDate, i));
    }

    // Calculate which day indices are visible
    const firstVisibleDayIndex = Math.floor(scrollLeft / dayWidthPixels);
    const visibleDaysCount = Math.ceil(viewportWidth / dayWidthPixels) + 1;

    // Add buffer on each side
    const startIndex = Math.max(0, firstVisibleDayIndex - buffer);
    const endIndex = Math.min(
      totalDays - 1,
      firstVisibleDayIndex + visibleDaysCount + buffer
    );

    const visibleDays: Date[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      visibleDays.push(addDays(startDate, i));
    }

    return visibleDays;
  }, [rangeStart, rangeEnd, scrollLeft, viewportWidth, dayWidthPixels, buffer]);
}
