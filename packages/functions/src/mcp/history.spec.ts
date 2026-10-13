import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));

import { Timestamp } from "../testing/fake-firestore";
import type { Task } from "@blotch/model";
import { fieldChangeEntries } from "./history";

describe("fieldChangeEntries", () => {
  const due = Date.UTC(2026, 9, 20, 12);
  const task = {
    id: "t1",
    title: "Old",
    startDate: null,
    dueDate: Timestamp.fromMillis(due),
    color: null,
  } as unknown as Task;
  const change = (field: string, oldValue: string, newValue: string) => ({
    action: "field_changed",
    field,
    userId: "u1",
    metadata: { oldValue, newValue },
  });

  it("records only the fields that actually change", () => {
    expect(
      fieldChangeEntries(
        task,
        {
          title: "Old",
          description: "<p>New</p>",
          startDate: new Date(Date.UTC(2026, 9, 1, 12)),
          dueDate: new Date(due),
          color: "#3B82F6",
        },
        "u1",
      ),
    ).toEqual([
      change("description", "", "<p>New</p>"),
      change("startDate", "", "10/1/2026"),
      change("color", "", "#3B82F6"),
    ]);
  });

  it("records cleared values", () => {
    const filled = { ...task, description: "<p>x</p>", color: "#000000" } as Task;
    expect(
      fieldChangeEntries(
        filled,
        { title: "New", description: "", dueDate: null, color: null },
        "u1",
      ),
    ).toEqual([
      change("title", "Old", "New"),
      change("description", "<p>x</p>", ""),
      change("dueDate", "10/20/2026", ""),
      change("color", "#000000", ""),
    ]);
  });
});
