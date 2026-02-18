import { describe, it, expect } from 'vitest';
import { compareOrder, getOrderBetween, getOrderAtEnd, getOrderAtIndex } from './ordering';

describe('compareOrder', () => {
  it('returns 0 when both are undefined', () => {
    expect(compareOrder(undefined, undefined)).toBe(0);
  });

  it('sorts undefined to end (a undefined)', () => {
    expect(compareOrder(undefined, 'a0')).toBe(1);
  });

  it('sorts undefined to end (b undefined)', () => {
    expect(compareOrder('a0', undefined)).toBe(-1);
  });

  it('returns -1 when a < b', () => {
    expect(compareOrder('a0', 'a1')).toBe(-1);
  });

  it('returns 1 when a > b', () => {
    expect(compareOrder('a1', 'a0')).toBe(1);
  });

  it('returns 0 when equal', () => {
    expect(compareOrder('a0', 'a0')).toBe(0);
  });
});

describe('getOrderBetween', () => {
  it('generates a key between null and null', () => {
    const key = getOrderBetween(null, null);
    expect(key).toBeTruthy();
  });

  it('generates a key before an existing key', () => {
    const existing = getOrderBetween(null, null);
    const before = getOrderBetween(null, existing);
    expect(before < existing).toBe(true);
  });

  it('generates a key after an existing key', () => {
    const existing = getOrderBetween(null, null);
    const after = getOrderBetween(existing, null);
    expect(after > existing).toBe(true);
  });

  it('generates a key between two existing keys', () => {
    const first = getOrderBetween(null, null);
    const third = getOrderBetween(first, null);
    const second = getOrderBetween(first, third);
    expect(second > first).toBe(true);
    expect(second < third).toBe(true);
  });
});

describe('getOrderAtEnd', () => {
  it('returns a key for an empty list', () => {
    const key = getOrderAtEnd([]);
    expect(key).toBeTruthy();
  });

  it('returns a key after the last item', () => {
    const items = [
      { order: 'a0' },
      { order: 'a1' },
    ];
    const key = getOrderAtEnd(items);
    expect(key > 'a1').toBe(true);
  });

  it('ignores items without valid order', () => {
    const items = [
      { order: 'a0' },
      { order: undefined },
      { order: '' },
    ];
    const key = getOrderAtEnd(items as { order?: string }[]);
    expect(key > 'a0').toBe(true);
  });
});

describe('getOrderAtIndex', () => {
  const items = [
    { order: 'a0' },
    { order: 'a1' },
    { order: 'a2' },
  ];

  it('returns a key before all items for index 0', () => {
    const key = getOrderAtIndex(items, 0);
    expect(key < 'a0').toBe(true);
  });

  it('returns a key between items for middle index', () => {
    const key = getOrderAtIndex(items, 1);
    expect(key > 'a0').toBe(true);
    expect(key < 'a1').toBe(true);
  });

  it('returns a key after all items for index >= length', () => {
    const key = getOrderAtIndex(items, 5);
    expect(key > 'a2').toBe(true);
  });

  it('handles empty list', () => {
    const key = getOrderAtIndex([], 0);
    expect(key).toBeTruthy();
  });

  it('handles negative index as beginning', () => {
    const key = getOrderAtIndex(items, -1);
    expect(key < 'a0').toBe(true);
  });
});
