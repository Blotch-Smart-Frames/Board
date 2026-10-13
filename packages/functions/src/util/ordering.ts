import { generateKeyBetween } from "fractional-indexing";

/**
 * Compare two order strings for sorting. Mirrors the client's `compareOrder`:
 * plain lexicographic comparison (fractional-indexing keys are designed for
 * it), with missing keys sorted to the end.
 */
export function compareOrder(
  a: string | undefined | null,
  b: string | undefined | null,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortedOrders<T extends { order?: string }>(items: T[]): string[] {
  return items
    .map((item) => item.order)
    .filter(
      (order): order is string => typeof order === "string" && order.length > 0,
    )
    .sort(compareOrder);
}

/**
 * Generate an order key that places an item at the end of a sorted list. This
 * mirrors the client-side utility of the same name so ordering stays
 * consistent no matter which side writes the key.
 */
export function getOrderAtEnd<T extends { order?: string }>(
  items: T[],
): string {
  const valid = sortedOrders(items);
  return generateKeyBetween(valid[valid.length - 1] ?? null, null);
}

/**
 * Generate an order key that places an item at `index` in a sorted list (before
 * the item currently there). Mirrors the client's `getOrderAtIndex`: an index
 * at or below zero means the top, at or past the end means the bottom.
 */
export function getOrderAtIndex<T extends { order?: string }>(
  items: T[],
  index: number,
): string {
  const valid = sortedOrders(items);
  const at = Math.min(Math.max(index, 0), valid.length);
  return generateKeyBetween(valid[at - 1] ?? null, valid[at] ?? null);
}
