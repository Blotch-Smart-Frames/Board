import { compareOrder, getOrderAtEnd, getOrderAtIndex, getOrderBetween } from './ordering';

describe('compareOrder', () => {
  it('sorts lexicographically for two defined keys', () => {
    expect(compareOrder('a0', 'a1')).toBe(-1);
    expect(compareOrder('a1', 'a0')).toBe(1);
    expect(compareOrder('a0', 'a0')).toBe(0);
  });

  it('sends undefined/empty orders to the end', () => {
    expect(compareOrder(undefined, 'a0')).toBe(1);
    expect(compareOrder('a0', undefined)).toBe(-1);
    expect(compareOrder('', 'a0')).toBe(1);
    expect(compareOrder('a0', '')).toBe(-1);
  });

  it('treats two missing keys as equal', () => {
    expect(compareOrder(undefined, undefined)).toBe(0);
    expect(compareOrder('', '')).toBe(0);
  });
});

describe('getOrderBetween', () => {
  it('produces a key that sorts between the given bounds', () => {
    const key = getOrderBetween('a0', 'a2');
    expect(compareOrder('a0', key)).toBe(-1);
    expect(compareOrder(key, 'a2')).toBe(-1);
  });

  it('produces a key before an existing one when before is null', () => {
    const key = getOrderBetween(null, 'a2');
    expect(compareOrder(key, 'a2')).toBe(-1);
  });

  it('produces a key after an existing one when after is null', () => {
    const key = getOrderBetween('a2', null);
    expect(compareOrder('a2', key)).toBe(-1);
  });
});

describe('getOrderAtEnd', () => {
  it('returns a base key when the list is empty', () => {
    expect(getOrderAtEnd([])).toBe(getOrderBetween(null, null));
  });

  it('places the new key strictly after every existing order', () => {
    const items = [{ order: 'a1' }, { order: 'a0' }, { order: 'a3' }];
    const key = getOrderAtEnd(items);
    for (const item of items) {
      expect(compareOrder(item.order, key)).toBe(-1);
    }
  });

  it('ignores items without an order string', () => {
    const items = [{ order: undefined }, { order: '' }, { order: 'a5' }];
    const key = getOrderAtEnd(items);
    expect(compareOrder('a5', key)).toBe(-1);
  });
});

describe('getOrderAtIndex', () => {
  const items = [{ order: 'a0' }, { order: 'a1' }, { order: 'a2' }];

  it('places at the beginning for index 0', () => {
    const key = getOrderAtIndex(items, 0);
    expect(compareOrder(key, 'a0')).toBe(-1);
  });

  it('places at the beginning for a negative index', () => {
    const key = getOrderAtIndex(items, -5);
    expect(compareOrder(key, 'a0')).toBe(-1);
  });

  it('places at the end when the index is past the last item', () => {
    const key = getOrderAtIndex(items, items.length);
    expect(compareOrder('a2', key)).toBe(-1);
  });

  it('places between neighbors for an interior index', () => {
    const key = getOrderAtIndex(items, 1);
    expect(compareOrder('a0', key)).toBe(-1);
    expect(compareOrder(key, 'a1')).toBe(-1);
  });

  it('handles an empty list by returning the base key', () => {
    expect(getOrderAtIndex([], 3)).toBe(getOrderBetween(null, null));
  });

  it('sorts items before choosing neighbors so input order does not matter', () => {
    const shuffled = [{ order: 'a2' }, { order: 'a0' }, { order: 'a1' }];
    const key = getOrderAtIndex(shuffled, 1);
    expect(compareOrder('a0', key)).toBe(-1);
    expect(compareOrder(key, 'a1')).toBe(-1);
  });
});
