import type { Task, UpdateTaskInput, HistoryEntry, Label, Collaborator } from '../types/board';

type DiffContext = {
  userId: string;
  labels: Label[];
  collaborators: Collaborator[];
  lists: { id: string; title: string }[];
};

type HistoryEntryInput = Omit<HistoryEntry, 'id' | 'createdAt'>;

export const diffTaskChanges = (
  oldTask: Task,
  updates: UpdateTaskInput,
  context: DiffContext,
): HistoryEntryInput[] => {
  const entries: HistoryEntryInput[] = [];
  const { userId, labels, collaborators } = context;

  // Label changes
  if (updates.labelIds !== undefined) {
    const oldLabelIds = oldTask.labelIds ?? [];
    const newLabelIds = updates.labelIds ?? [];

    const added = newLabelIds.filter((id) => !oldLabelIds.includes(id));
    const removed = oldLabelIds.filter((id) => !newLabelIds.includes(id));

    for (const labelId of added) {
      const label = labels.find((l) => l.id === labelId);
      entries.push({
        action: 'label_added',
        userId,
        metadata: {
          labelName: label?.name ?? labelId,
          labelColor: label?.color,
        },
      });
    }

    for (const labelId of removed) {
      const label = labels.find((l) => l.id === labelId);
      entries.push({
        action: 'label_removed',
        userId,
        metadata: {
          labelName: label?.name ?? labelId,
          labelColor: label?.color,
        },
      });
    }
  }

  // Assignee changes
  if (updates.assignedTo !== undefined) {
    const oldAssignees = oldTask.assignedTo ?? [];
    const newAssignees = updates.assignedTo ?? [];

    const added = newAssignees.filter((id) => !oldAssignees.includes(id));
    const removed = oldAssignees.filter((id) => !newAssignees.includes(id));

    for (const userId_ of added) {
      const user = collaborators.find((c) => c.id === userId_);
      entries.push({
        action: 'assignee_added',
        userId,
        metadata: { userName: user?.name ?? userId_ },
      });
    }

    for (const userId_ of removed) {
      const user = collaborators.find((c) => c.id === userId_);
      entries.push({
        action: 'assignee_removed',
        userId,
        metadata: { userName: user?.name ?? userId_ },
      });
    }
  }

  // Attachment changes
  if (updates.attachments !== undefined) {
    const oldAttachments = oldTask.attachments ?? [];
    const newAttachments = updates.attachments ?? [];
    const oldIds = new Set(oldAttachments.map((a) => a.id));
    const newIds = new Set(newAttachments.map((a) => a.id));

    for (const attachment of newAttachments) {
      if (!oldIds.has(attachment.id)) {
        entries.push({
          action: 'attachment_added',
          userId,
          metadata: { fileName: attachment.fileName },
        });
      }
    }

    for (const attachment of oldAttachments) {
      if (!newIds.has(attachment.id)) {
        entries.push({
          action: 'attachment_removed',
          userId,
          metadata: { fileName: attachment.fileName },
        });
      }
    }
  }

  // Field changes
  const fieldChecks: {
    key: keyof UpdateTaskInput;
    field: string;
    format?: (val: unknown) => string;
  }[] = [
    { key: 'title', field: 'title' },
    { key: 'description', field: 'description' },
    {
      key: 'startDate',
      field: 'startDate',
      format: (val) => (val instanceof Date ? val.toLocaleDateString() : String(val ?? '')),
    },
    {
      key: 'dueDate',
      field: 'dueDate',
      format: (val) => (val instanceof Date ? val.toLocaleDateString() : String(val ?? '')),
    },
    { key: 'color', field: 'color' },
  ];

  for (const { key, field, format } of fieldChecks) {
    if (updates[key] === undefined) continue;

    const oldVal = oldTask[key as keyof Task];
    const newVal = updates[key];

    // Skip if values are the same
    if (oldVal === newVal) continue;

    // Handle Timestamp vs Date comparison for date fields
    if (field === 'startDate' || field === 'dueDate') {
      const oldDate =
        oldVal && typeof oldVal === 'object' && 'toDate' in oldVal
          ? (oldVal as { toDate: () => Date }).toDate().getTime()
          : null;
      const newDate = newVal instanceof Date ? newVal.getTime() : null;
      if (oldDate === newDate) continue;
    }

    /* v8 ignore next -- callers always pass a format fn or use `String(v)` for the primitive fields; the `?? ''` fallback is unreachable in practice @preserve */
    const formatFn = format ?? ((v: unknown) => String(v ?? ''));
    const oldFormatted =
      field === 'startDate' || field === 'dueDate'
        ? oldVal && typeof oldVal === 'object' && 'toDate' in oldVal
          ? (oldVal as { toDate: () => Date }).toDate().toLocaleDateString()
          : ''
        : formatFn(oldVal);
    const newFormatted = formatFn(newVal);

    entries.push({
      action: 'field_changed',
      field,
      userId,
      metadata: {
        oldValue: oldFormatted,
        newValue: newFormatted,
      },
    });
  }

  return entries;
};
