import { describe, expect, it } from "vitest";
import { getOrderAtEnd } from "./ordering";

describe("getOrderAtEnd", () => {
  it("returns a mid-range key when the list is empty", () => {
    expect(getOrderAtEnd([])).toBe("a0");
  });

  it("skips items with missing or empty order fields", () => {
    // Both entries are ignored by the filter, so the result matches the empty
    // case.
    expect(getOrderAtEnd([{ order: undefined }, { order: "" }])).toBe("a0");
  });

  it("places the new key after the largest existing order", () => {
    // Regardless of insertion order, the sort inside picks "a1" as the last
    // one and generateKeyBetween produces something that sorts after it.
    const key = getOrderAtEnd([{ order: "a1" }, { order: "a0" }]);
    expect(key > "a1").toBe(true);
  });
});
