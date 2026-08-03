import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisibleDates } from './useVisibleDates';
import { startOfDay, addDays } from 'date-fns';

describe('useVisibleDates', () => {
  const baseDate = startOfDay(new Date('2024-06-01'));
  const rangeStart = baseDate.getTime();
  const rangeEnd = addDays(baseDate, 30).getTime();

  it('returns empty array for invalid range', () => {
    const { result } = renderHook(() =>
      useVisibleDates({
        rangeStart: rangeEnd,
        rangeEnd: rangeStart, // reversed
        scrollLeft: 0,
        viewportWidth: 800,
        dayWidthPixels: 80,
      }),
    );

    expect(result.current).toEqual([]);
  });

  it('returns all days when dayWidthPixels is 0', () => {
    const { result } = renderHook(() =>
      useVisibleDates({
        rangeStart,
        rangeEnd,
        scrollLeft: 0,
        viewportWidth: 800,
        dayWidthPixels: 0,
      }),
    );

    expect(result.current.length).toBe(31); // 30 days + 1
  });

  it('returns all days when viewportWidth is 0', () => {
    const { result } = renderHook(() =>
      useVisibleDates({
        rangeStart,
        rangeEnd,
        scrollLeft: 0,
        viewportWidth: 0,
        dayWidthPixels: 80,
      }),
    );

    expect(result.current.length).toBe(31);
  });

  it('returns subset of days based on scroll position', () => {
    const { result } = renderHook(() =>
      useVisibleDates({
        rangeStart,
        rangeEnd,
        scrollLeft: 400, // 5 days in at 80px/day
        viewportWidth: 800, // shows 10 days
        dayWidthPixels: 80,
        buffer: 2,
      }),
    );

    // Should return ~10 visible + 2 buffer each side = ~14 days
    expect(result.current.length).toBeGreaterThan(10);
    expect(result.current.length).toBeLessThan(31);
  });

  it('clamps to range boundaries', () => {
    const { result } = renderHook(() =>
      useVisibleDates({
        rangeStart,
        rangeEnd,
        scrollLeft: 0,
        viewportWidth: 800,
        dayWidthPixels: 80,
        buffer: 100, // huge buffer
      }),
    );

    // Should not exceed total days
    expect(result.current.length).toBeLessThanOrEqual(31);
  });

  it('uses default buffer of 3', () => {
    const { result } = renderHook(() =>
      useVisibleDates({
        rangeStart,
        rangeEnd,
        scrollLeft: 800, // 10 days in
        viewportWidth: 400, // 5 visible
        dayWidthPixels: 80,
      }),
    );

    // 5 visible + ceil(400/80)+1 + 3 buffer each side
    expect(result.current.length).toBeGreaterThan(5);
  });
});
