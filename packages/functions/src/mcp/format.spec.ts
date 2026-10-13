import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));

import { Timestamp } from "../testing/fake-firestore";
import type { Comment, HistoryEntry, Label, List, Task } from "@blotch/model";
import {
  describeHistory,
  formatComment,
  formatContext,
  htmlToText,
  parseDateArg,
  summarizeTask,
  textToHtml,
} from "./format";

describe("htmlToText", () => {
  it("turns Quill HTML into readable lines", () => {
    expect(
      htmlToText(
        '<h2>Plan</h2><p>Fix &amp; ship&nbsp;it</p><ol><li data-list="bullet">one</li><li data-list="bullet">two</li></ol><p><br></p><p><br></p><p>&lt;done&gt; &quot;ok&quot; it&#39;s</p>',
      ),
    ).toBe("Plan\nFix & ship it\n\n- one\n- two\n\n<done> \"ok\" it's");
    expect(htmlToText(undefined)).toBe("");
  });
});

describe("textToHtml", () => {
  it("builds paragraphs, lists and inline formatting", () => {
    expect(
      textToHtml(
        "Intro with **bold**, *italic*, `code` and [docs](https://example.com)\n\n\n\n- a\n* b\n1. first\n2) second\nEnd <script>",
      ),
    ).toBe(
      '<p>Intro with <strong>bold</strong>, <em>italic</em>, <code>code</code> and <a href="https://example.com" rel="noopener noreferrer" target="_blank">docs</a></p>' +
        "<p><br></p>" +
        "<ul><li>a</li><li>b</li></ul><ol><li>first</li><li>second</li></ol><p>End &lt;script&gt;</p>",
    );
  });

  it("doesn't link non-http URLs", () => {
    expect(textToHtml("[x](javascript:alert(1))")).toBe("<p>[x](javascript:alert(1))</p>");
  });

  it("round-trips through htmlToText", () => {
    const text = "Steps:\n- build\n- deploy";
    expect(htmlToText(textToHtml(text))).toBe("Steps:\n\n- build\n- deploy");
  });
});

describe("parseDateArg", () => {
  it("reads plain dates as noon UTC so the day is stable across timezones", () => {
    expect(parseDateArg("2026-10-20", "dueDate").toISOString()).toBe("2026-10-20T12:00:00.000Z");
  });

  it("keeps full date-times", () => {
    expect(parseDateArg("2026-10-20T17:30:00+01:00", "dueDate").toISOString()).toBe(
      "2026-10-20T16:30:00.000Z",
    );
  });

  it("explains invalid input", () => {
    expect(() => parseDateArg("soon", "dueDate")).toThrow(/dueDate must be a date/);
  });
});

describe("summarizeTask", () => {
  const ctx = formatContext(
    [{ id: "l1", title: "To Do" } as List],
    [{ id: "lb1", name: "Bug", emoji: "🐛", color: "#EF4444" } as Label],
    [{ id: "u1", name: "Ana", email: "ana@example.com", role: "owner" }],
    Date.UTC(2026, 0, 10),
  );

  it("names assignees, labels and the list, flagging overdue tasks", () => {
    const task = {
      id: "t1",
      title: "Ship",
      listId: "l1",
      assignedTo: ["u1", "gone"],
      labelIds: ["lb1", "deleted"],
      startDate: Timestamp.fromMillis(Date.UTC(2026, 0, 1)),
      dueDate: Timestamp.fromMillis(Date.UTC(2026, 0, 5)),
      archive: false,
      commentCount: 2,
    } as unknown as Task;
    expect(summarizeTask(task, ctx, { board: { id: "b1", title: "Product" } })).toEqual({
      id: "t1",
      title: "Ship",
      boardId: "b1",
      board: "Product",
      listId: "l1",
      list: "To Do",
      assignees: ["Ana", "Former member"],
      labels: ["🐛 Bug"],
      startDate: "2026-01-01T00:00:00.000Z",
      dueDate: "2026-01-05T00:00:00.000Z",
      overdue: true,
      comments: 2,
    });
  });

  it("leaves out empty fields and copes with unknown lists", () => {
    const task = { id: "t2", title: "Bare", listId: "nope", archive: true } as unknown as Task;
    expect(summarizeTask(task, ctx)).toEqual({
      id: "t2",
      title: "Bare",
      listId: "nope",
      list: "Unknown list",
      archived: true,
    });
    expect(summarizeTask(task, ctx, { includeList: false })).toEqual({
      id: "t2",
      title: "Bare",
      archived: true,
    });
  });
});

describe("describeHistory", () => {
  const ctx = formatContext(
    [],
    [],
    [{ id: "u1", name: "Ana", email: "ana@example.com", role: "owner" }],
    0,
  );
  const entry = (overrides: Partial<HistoryEntry>): HistoryEntry => ({
    id: "h",
    action: "moved",
    userId: "u1",
    createdAt: Timestamp.fromMillis(0),
    ...overrides,
  });

  it.each([
    [{ action: "label_added", metadata: { labelName: "Bug" } }, "Ana added label Bug"],
    [{ action: "attachment_removed", metadata: { fileName: "a.png" } }, "Ana removed attachment a.png"],
    [{ action: "archived", metadata: { fromListName: "Done", toListName: "Archive" } }, "Ana archived from Done to Archive"],
    [{ action: "board_migrated", metadata: { fromBoardName: "A", toBoardName: "B" } }, "Ana moved from another board (A → B)"],
    [
      { action: "field_changed", field: "description", metadata: { oldValue: "<p>a</p>", newValue: "<p>b</p>" } },
      'Ana changed description from "a" to "b"',
    ],
    [{ action: "unarchived", userId: "gone" }, "Former member restored from ? to ?"],
    [{ action: "moved", metadata: { fromListName: "To Do", toListName: "Done" } }, "Ana moved from To Do to Done"],
    [{ action: "label_removed" }, "Ana removed label "],
    [{ action: "assignee_added", metadata: { userName: "Bo" } }, "Ana assigned Bo"],
    [{ action: "assignee_removed" }, "Ana unassigned "],
    [{ action: "attachment_added" }, "Ana attached "],
    [{ action: "board_migrated" }, "Ana moved from another board (? → ?)"],
    [
      { action: "field_changed", field: "title", metadata: { oldValue: "A", newValue: "B" } },
      'Ana changed title from "A" to "B"',
    ],
    [{ action: "field_changed" }, 'Ana changed a field from "" to ""'],
    [{ action: "renamed" as HistoryEntry["action"] }, "Ana renamed"],
  ] as [Partial<HistoryEntry>, string][])("%j", (overrides, summary) => {
    expect(describeHistory(entry(overrides), ctx)).toEqual({ at: "1970-01-01T00:00:00.000Z", summary });
  });
});

describe("formatComment", () => {
  const ctx = formatContext(
    [],
    [],
    [{ id: "u1", name: "Ana", email: "ana@example.com", role: "owner" }],
    Date.UTC(2026, 0, 10),
  );
  const comment = (updatedAt: number) =>
    ({
      id: "c1",
      text: "Looks good",
      authorId: "u1",
      createdAt: Timestamp.fromMillis(Date.UTC(2026, 0, 5)),
      updatedAt: Timestamp.fromMillis(updatedAt),
    }) as unknown as Comment;

  it("leaves out editedAt for an untouched comment", () => {
    expect(formatComment(comment(Date.UTC(2026, 0, 5)), ctx)).toEqual({
      id: "c1",
      author: "Ana",
      authorId: "u1",
      text: "Looks good",
      createdAt: "2026-01-05T00:00:00.000Z",
    });
  });

  it("adds editedAt once the comment changes", () => {
    expect(formatComment(comment(Date.UTC(2026, 0, 6)), ctx)).toMatchObject({
      createdAt: "2026-01-05T00:00:00.000Z",
      editedAt: "2026-01-06T00:00:00.000Z",
    });
  });
});
