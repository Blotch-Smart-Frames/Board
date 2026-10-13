import type {
  Comment,
  FirestoreTimestamp,
  HistoryEntry,
  Label,
  List,
  Task,
} from "@blotch/model";
import { ToolError, type Member } from "./board-data";

export function toIso(value: FirestoreTimestamp | null | undefined): string | undefined {
  return value ? value.toDate().toISOString() : undefined;
}

export function boardUrl(appUrl: string, boardId: string): string {
  return `${appUrl}/board/${boardId}`;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&amp;": "&",
};

/**
 * Task descriptions are Quill HTML. Turn them into readable plain text for the
 * model: block elements become lines, list items become "- " bullets, and the
 * handful of entities Quill emits are decoded.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|h[1-6]|blockquote|pre|ul|ol)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(nbsp|lt|gt|quot|#39|amp);/g, (entity) => ENTITIES[entity] ?? entity)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(line: string): string {
  return escapeHtml(line)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>',
    );
}

/**
 * Turn the plain text / light Markdown a model writes into the Quill HTML the
 * description editor stores: one `<p>` per line, `-`/`*` and `1.` lines as
 * lists, plus **bold**, *italic*, `code` and [links](https://…).
 */
export function textToHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };

  for (const line of lines) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      const kind = bullet ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inlineMarkdown(item[1] as string)}</li>`);
      continue;
    }
    closeList();
    out.push(line.trim() ? `<p>${inlineMarkdown(line)}</p>` : "<p><br></p>");
  }
  closeList();
  return out.join("").replace(/(<p><br><\/p>){2,}/g, "<p><br></p>");
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a tool date argument. `YYYY-MM-DD` becomes noon UTC that day, which
 * shows as the same calendar date for everyone between UTC−11 and UTC+11 (the
 * server doesn't know the user's timezone). Full ISO date-times are kept as is.
 */
export function parseDateArg(value: string, field: string): Date {
  const dateOnly = DATE_ONLY.exec(value.trim());
  const date = dateOnly
    ? new Date(
        Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12),
      )
    : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ToolError(
      `${field} must be a date like 2026-10-20 or an ISO 8601 date-time, got "${value}".`,
    );
  }
  return date;
}

export type FormatContext = {
  lists: Map<string, List>;
  labels: Map<string, Label>;
  members: Map<string, Member>;
  now: number;
};

export function formatContext(
  lists: List[],
  labels: Label[],
  members: Member[],
  now: number,
): FormatContext {
  return {
    lists: new Map(lists.map((list) => [list.id, list])),
    labels: new Map(labels.map((label) => [label.id, label])),
    members: new Map(members.map((member) => [member.id, member])),
    now,
  };
}

export function labelName(label: Label): string {
  return label.emoji ? `${label.emoji} ${label.name}` : label.name;
}

export function isOverdue(task: Task, now: number): boolean {
  const due = task.dueDate?.toMillis();
  return !task.archive && due !== undefined && due < now;
}

/** Compact, token-friendly view of a task for lists and search results. */
export type TaskSummary = {
  id: string;
  title: string;
  boardId?: string;
  board?: string;
  listId?: string;
  list?: string;
  assignees?: string[];
  labels?: string[];
  startDate?: string;
  dueDate?: string;
  overdue?: true;
  archived?: true;
  comments?: number;
};

/**
 * Summarize a task, leaving out empty fields. `board` adds the board id and
 * title (for cross-board results); `includeList: false` drops the list fields
 * when the task is already shown under its list.
 */
export function summarizeTask(
  task: Task,
  ctx: FormatContext,
  options: { board?: { id: string; title: string }; includeList?: boolean } = {},
): TaskSummary {
  const assignees = (task.assignedTo ?? []).map(
    (id) => ctx.members.get(id)?.name ?? "Former member",
  );
  const labels = (task.labelIds ?? [])
    .map((id) => ctx.labels.get(id))
    .filter((label): label is Label => !!label)
    .map(labelName);
  const summary: TaskSummary = { id: task.id, title: task.title };
  if (options.board) {
    summary.boardId = options.board.id;
    summary.board = options.board.title;
  }
  if (options.includeList !== false) {
    summary.listId = task.listId;
    summary.list = ctx.lists.get(task.listId)?.title ?? "Unknown list";
  }
  if (assignees.length > 0) summary.assignees = assignees;
  if (labels.length > 0) summary.labels = labels;
  const startDate = toIso(task.startDate);
  const dueDate = toIso(task.dueDate);
  if (startDate) summary.startDate = startDate;
  if (dueDate) summary.dueDate = dueDate;
  if (isOverdue(task, ctx.now)) summary.overdue = true;
  if (task.archive) summary.archived = true;
  if (task.commentCount) summary.comments = task.commentCount;
  return summary;
}

export function memberRef(ctx: FormatContext, id: string) {
  const member = ctx.members.get(id);
  return member
    ? { id, name: member.name, email: member.email }
    : { id, name: "Former member" };
}

export function formatComment(comment: Comment, ctx: FormatContext) {
  const created = toIso(comment.createdAt);
  const updated = toIso(comment.updatedAt);
  return {
    id: comment.id,
    author: memberRef(ctx, comment.authorId).name,
    authorId: comment.authorId,
    text: comment.text,
    createdAt: created,
    ...(updated && created && updated !== created ? { editedAt: updated } : {}),
  };
}

const HISTORY_VERBS: Record<HistoryEntry["action"], string> = {
  label_added: "added label",
  label_removed: "removed label",
  assignee_added: "assigned",
  assignee_removed: "unassigned",
  attachment_added: "attached",
  attachment_removed: "removed attachment",
  moved: "moved",
  board_migrated: "moved from another board",
  archived: "archived",
  unarchived: "restored",
  field_changed: "changed",
};

/** One line of activity, e.g. "Alice moved from To Do to Done". */
export function describeHistory(entry: HistoryEntry, ctx: FormatContext) {
  const who = memberRef(ctx, entry.userId).name;
  const meta = entry.metadata ?? {};
  const verb = HISTORY_VERBS[entry.action] ?? entry.action;
  let detail = "";
  switch (entry.action) {
    case "label_added":
    case "label_removed":
      detail = ` ${meta.labelName ?? ""}`;
      break;
    case "assignee_added":
    case "assignee_removed":
      detail = ` ${meta.userName ?? ""}`;
      break;
    case "attachment_added":
    case "attachment_removed":
      detail = ` ${meta.fileName ?? ""}`;
      break;
    case "moved":
    case "archived":
    case "unarchived":
      detail = ` from ${meta.fromListName ?? "?"} to ${meta.toListName ?? "?"}`;
      break;
    case "board_migrated":
      detail = ` (${meta.fromBoardName ?? "?"} → ${meta.toBoardName ?? "?"})`;
      break;
    case "field_changed": {
      const from =
        entry.field === "description" ? htmlToText(meta.oldValue) : meta.oldValue;
      const to =
        entry.field === "description" ? htmlToText(meta.newValue) : meta.newValue;
      detail = ` ${entry.field ?? "a field"} from "${from ?? ""}" to "${to ?? ""}"`;
      break;
    }
  }
  return { at: toIso(entry.createdAt), summary: `${who} ${verb}${detail}` };
}
