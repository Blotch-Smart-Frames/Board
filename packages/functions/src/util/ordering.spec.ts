import { describe, expect, it } from "vitest";
import { compareOrder, getOrderAtEnd, getOrderAtIndex } from "./ordering";

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

describe("compareOrder", () => {
  it("sorts lexicographically with missing keys last", () => {
    const keys = ["a2", null, "a0", "", "a1"];
    expect([...keys].sort(compareOrder)).toEqual([
      "a0",
      "a1",
      "a2",
      null,
      "",
    ]);
    expect(compareOrder(null, undefined)).toBe(0);
    expect(compareOrder("a0", "a0")).toBe(0);
  });
});

describe("getOrderAtIndex", () => {
  const items = [{ order: "a2" }, { order: "a0" }, { order: "a1" }];

  it("places at the top for index 0 or below", () => {
    expect(getOrderAtIndex(items, 0) < "a0").toBe(true);
    expect(getOrderAtIndex(items, -3) < "a0").toBe(true);
  });

  it("places between neighbors for an inner index", () => {
    const key = getOrderAtIndex(items, 2);
    expect(key > "a1" && key < "a2").toBe(true);
  });

  it("places at the bottom for an index at or past the end", () => {
    expect(getOrderAtIndex(items, 3) > "a2").toBe(true);
    expect(getOrderAtIndex(items, 99) > "a2").toBe(true);
  });

  it("returns a fresh key for an empty list", () => {
    expect(getOrderAtIndex([], 5)).toBe("a0");
  });
});
