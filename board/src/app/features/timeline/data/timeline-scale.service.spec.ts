import { MS_PER_DAY, TimelineScaleService } from './timeline-scale.service';

describe('TimelineScaleService', () => {
  let service: TimelineScaleService;

  beforeEach(() => {
    service = new TimelineScaleService();
  });

  describe('range', () => {
    it('defaults to roughly 3 days ago through 14 days from now', () => {
      const { start, end } = service.range();

      expect(end).toBeGreaterThan(start);

      const spanDays = (end - start) / MS_PER_DAY;
      expect(spanDays).toBeGreaterThanOrEqual(16);
      expect(spanDays).toBeLessThanOrEqual(18);
    });
  });

  describe('dayWidthPx', () => {
    it('defaults to 120', () => {
      expect(service.dayWidthPx()).toBe(120);
    });
  });

  describe('valueToPixels', () => {
    it('converts one day of milliseconds to a full day width', () => {
      service.dayWidthPx.set(100);

      expect(service.valueToPixels(MS_PER_DAY)).toBe(100);
    });

    it('converts half a day of milliseconds to half the day width', () => {
      service.dayWidthPx.set(100);

      expect(service.valueToPixels(MS_PER_DAY / 2)).toBe(50);
    });
  });

  describe('pixelsToValue', () => {
    it('is the inverse of valueToPixels', () => {
      service.dayWidthPx.set(100);

      expect(service.pixelsToValue(100)).toBe(MS_PER_DAY);
    });
  });

  describe('totalWidthPx', () => {
    it('scales the range span by the day width', () => {
      service.range.set({ start: 0, end: 5 * MS_PER_DAY });
      service.dayWidthPx.set(100);

      expect(service.totalWidthPx()).toBe(500);
    });
  });

  describe('expandPast', () => {
    it('decreases range().start by the given number of days, leaving end unchanged', () => {
      service.range.set({ start: 10 * MS_PER_DAY, end: 20 * MS_PER_DAY });

      service.expandPast(7);

      expect(service.range().start).toBe(10 * MS_PER_DAY - 7 * MS_PER_DAY);
      expect(service.range().end).toBe(20 * MS_PER_DAY);
    });

    it('defaults to expanding by 7 days when called with no argument', () => {
      service.range.set({ start: 10 * MS_PER_DAY, end: 20 * MS_PER_DAY });

      service.expandPast();

      expect(service.range().start).toBe(10 * MS_PER_DAY - 7 * MS_PER_DAY);
      expect(service.range().end).toBe(20 * MS_PER_DAY);
    });
  });

  describe('expandFuture', () => {
    it('increases range().end by the given number of days, leaving start unchanged', () => {
      service.range.set({ start: 10 * MS_PER_DAY, end: 20 * MS_PER_DAY });

      service.expandFuture(7);

      expect(service.range().start).toBe(10 * MS_PER_DAY);

      const expectedDay = new Date(20 * MS_PER_DAY);
      expectedDay.setDate(expectedDay.getDate() + 7);
      const newEnd = new Date(service.range().end);
      expect(newEnd.getFullYear()).toBe(expectedDay.getFullYear());
      expect(newEnd.getMonth()).toBe(expectedDay.getMonth());
      expect(newEnd.getDate()).toBe(expectedDay.getDate());
    });

    it('rounds the new end to the last millisecond of the target local day', () => {
      service.range.set({ start: 10 * MS_PER_DAY, end: 20 * MS_PER_DAY });

      service.expandFuture(7);

      const newEnd = new Date(service.range().end);
      expect(newEnd.getHours()).toBe(23);
      expect(newEnd.getMinutes()).toBe(59);
      expect(newEnd.getSeconds()).toBe(59);
      expect(newEnd.getMilliseconds()).toBe(999);
    });

    it('defaults to expanding by 7 days when called with no argument', () => {
      service.range.set({ start: 10 * MS_PER_DAY, end: 20 * MS_PER_DAY });

      service.expandFuture();

      const expectedDay = new Date(20 * MS_PER_DAY);
      expectedDay.setDate(expectedDay.getDate() + 7);
      const newEnd = new Date(service.range().end);
      expect(newEnd.getFullYear()).toBe(expectedDay.getFullYear());
      expect(newEnd.getMonth()).toBe(expectedDay.getMonth());
      expect(newEnd.getDate()).toBe(expectedDay.getDate());
      expect(newEnd.getHours()).toBe(23);
      expect(newEnd.getMinutes()).toBe(59);
      expect(newEnd.getSeconds()).toBe(59);
    });
  });
});
