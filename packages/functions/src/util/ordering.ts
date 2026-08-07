import { generateKeyBetween } from "fractional-indexing";

/**
 * Generate an order key that places an item at the end of a sorted list. This
 * mirrors the client-side utility of the same name so ordering stays
 * consistent no matter which side writes the key.
 */
export function getOrderAtEnd<T extends { order?: string }>(
  items: T[],
): string {
  const valid = items
    .map((item) => item.order)
    .filter(
      (order): order is string => typeof order === "string" && order.length > 0,
    );

  if (valid.length === 0) {
    return generateKeyBetween(null, null);
  }
  const last = valid.sort()[valid.length - 1] ?? null;
  return generateKeyBetween(last, null);
}
