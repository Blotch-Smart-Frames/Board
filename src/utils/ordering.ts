import { generateKeyBetween } from 'fractional-indexing';

/**
 * Compare two order strings for sorting.
 * Uses simple lexicographic comparison (not locale-aware) for fractional indexing.
 * Items with undefined/null order are sorted to the end.
 */
export const compareOrder = (
  a: string | undefined,
  b: string | undefined,
): number => {
  // Handle undefined values - sort them to the end
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

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
export const getOrderAtEnd = <T extends { order?: string }>(
  items: T[],
): string => {
  // Filter to only items with valid order keys
  const validItems = items.filter(
    (item): item is T & { order: string } =>
      typeof item.order === 'string' && item.order.length > 0,
  );

  if (validItems.length === 0) {
    return generateKeyBetween(null, null);
  }
  const sorted = [...validItems].sort((a, b) => compareOrder(a.order, b.order));
  const lastOrder = sorted[sorted.length - 1].order;
  return generateKeyBetween(lastOrder, null);
};

/**
 * Generate an order key to place an item at a specific index in a sorted list.
 * The item will be placed before the item currently at that index.
 */
export const getOrderAtIndex = <T extends { order?: string }>(
  items: T[],
  index: number,
): string => {
  // Filter to only items with valid order keys
  const validItems = items.filter(
    (item): item is T & { order: string } =>
      typeof item.order === 'string' && item.order.length > 0,
  );

  const sorted = [...validItems].sort((a, b) => compareOrder(a.order, b.order));

  if (sorted.length === 0 || index <= 0) {
    // Place at beginning
    const first = sorted[0]?.order ?? null;
    return generateKeyBetween(null, first);
  }

  if (index >= sorted.length) {
    // Place at end
    const last = sorted[sorted.length - 1].order;
    return generateKeyBetween(last, null);
  }

  // Place between items at index-1 and index
  const before = sorted[index - 1].order;
  const after = sorted[index].order;
  return generateKeyBetween(before, after);
};
