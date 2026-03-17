import type {
  Task,
  UpdateTaskInput,
  HistoryEntry,
  Label,
  Sprint,
} from '../types/board';
import type { Collaborator } from '../hooks/useCollaboratorsQuery';

type DiffContext = {
  userId: string;
  labels: Label[];
  collaborators: Collaborator[];
  lists: { id: string; title: string }[];
  sprints: Sprint[];
};

type HistoryEntryInput = Omit<HistoryEntry, 'id' | 'createdAt'>;

export const diffTaskChanges = (
  oldTask: Task,
  updates: UpdateTaskInput,
  context: DiffContext,
): HistoryEntryInput[] => {
  const entries: HistoryEntryInput[] = [];
  const { userId, labels, collaborators, sprints } = context;

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

  // Completion status
  if (updates.completedAt !== undefined) {
    if (updates.completedAt && !oldTask.completedAt) {
      entries.push({ action: 'completed', userId });
    } else if (!updates.completedAt && oldTask.completedAt) {
      entries.push({ action: 'reopened', userId });
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
      format: (val) =>
        val instanceof Date ? val.toLocaleDateString() : String(val ?? ''),
    },
    {
      key: 'dueDate',
      field: 'dueDate',
      format: (val) =>
        val instanceof Date ? val.toLocaleDateString() : String(val ?? ''),
    },
    { key: 'color', field: 'color' },
    {
      key: 'sprintId',
      field: 'sprint',
      format: (val) => {
        if (!val) return 'None';
        const sprint = sprints.find((s) => s.id === val);
        return sprint?.name ?? String(val);
      },
    },
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
