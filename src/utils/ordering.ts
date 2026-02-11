import { generateKeyBetween } from 'fractional-indexing';

/**
 * Generate an order key between two existing keys.
 * Use null for before to place at the beginning.
 * Use null for after to place at the end.
 */
export const getOrderBetween = (
  before: string | null,
  after: string | null,
): string => {
  return generateKeyBetween(before, after);
};

/**
 * Generate an order key to place an item at the end of a sorted list.
 */
export const getOrderAtEnd = <T extends { order: string }>(items: T[]): string => {
  if (items.length === 0) {
    return generateKeyBetween(null, null);
  }
  const sorted = [...items].sort((a, b) => a.order.localeCompare(b.order));
  const lastOrder = sorted[sorted.length - 1].order;
  return generateKeyBetween(lastOrder, null);
};

/**
 * Generate an order key to place an item at a specific index in a sorted list.
 * The item will be placed before the item currently at that index.
 */
export const getOrderAtIndex = <T extends { order: string }>(
  items: T[],
  index: number,
): string => {
  const sorted = [...items].sort((a, b) => a.order.localeCompare(b.order));

  if (index <= 0) {
    // Place at beginning
    const first = sorted[0]?.order ?? null;
    return generateKeyBetween(null, first);
  }

  if (index >= sorted.length) {
    // Place at end
    const last = sorted[sorted.length - 1]?.order ?? null;
    return generateKeyBetween(last, null);
  }

  // Place between items at index-1 and index
  const before = sorted[index - 1].order;
  const after = sorted[index].order;
  return generateKeyBetween(before, after);
};

/**
 * Compare two order strings for sorting.
 */
export const compareOrder = (a: string, b: string): number => {
  return a.localeCompare(b);
};
