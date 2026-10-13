import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));

import { Timestamp } from "../testing/fake-firestore";
import type { HistoryEntry } from "@blotch/model";
import { describeHistory, formatContext, htmlToText, parseDateArg, textToHtml } from "./format";

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
  ] as [Partial<HistoryEntry>, string][])("%j", (overrides, summary) => {
    expect(describeHistory(entry(overrides), ctx)).toEqual({ at: "1970-01-01T00:00:00.000Z", summary });
  });
});
