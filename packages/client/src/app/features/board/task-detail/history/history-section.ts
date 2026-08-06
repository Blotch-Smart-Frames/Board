import { Component, computed, inject, input } from '@angular/core';
import { FIRESTORE_DB } from '../../../../core/firebase/firebase.config';
import { taskHistoryQuery } from '../../../../core/firebase/firestore-refs';
import { collectionSignal } from '../../../../core/interop/signal-interop';
import type {
  HistoryEntry,
  Collaborator,
  FirestoreTimestamp,
} from '../../../../shared/types/board';

type Row = { id: string; description: string; when: string };

function formatRelativeTime(timestamp: FirestoreTimestamp | undefined): string {
  if (!timestamp?.toDate) return '';
  const date = timestamp.toDate();
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function describe(entry: HistoryEntry, collaborators: Collaborator[]): string {
  const user = collaborators.find((c) => c.id === entry.userId)?.name ?? 'Someone';
  const meta = entry.metadata;
  switch (entry.action) {
    case 'label_added':
      return `${user} added label ${meta?.labelName ?? ''}`;
    case 'label_removed':
      return `${user} removed label ${meta?.labelName ?? ''}`;
    case 'assignee_added':
      return `${user} assigned ${meta?.userName ?? ''}`;
    case 'assignee_removed':
      return `${user} unassigned ${meta?.userName ?? ''}`;
    case 'attachment_added':
      return `${user} added attachment ${meta?.fileName ?? ''}`;
    case 'attachment_removed':
      return `${user} removed attachment ${meta?.fileName ?? ''}`;
    case 'moved':
      return `${user} moved from ${meta?.fromListName ?? ''} to ${meta?.toListName ?? ''}`;
    case 'board_migrated':
      return `${user} migrated this task from ${meta?.fromBoardName ?? ''} to ${meta?.toBoardName ?? ''}`;
    case 'completed':
      return `${user} marked as complete`;
    case 'reopened':
      return `${user} reopened`;
    case 'field_changed':
      return `${user} changed ${entry.field ?? 'a field'}`;
    default:
      return `${user} made a change`;
  }
}

@Component({
  selector: 'app-history-section',
  imports: [],
  template: `
    @if (rows().length === 0) {
      <p class="text-muted-foreground text-sm">No activity yet</p>
    } @else {
      <div class="flex flex-col gap-2">
        @for (row of rows(); track row.id) {
          <div class="flex items-start gap-2">
            <span class="bg-muted-foreground/60 mt-1.5 size-2 shrink-0 rounded-full"></span>
            <div class="min-w-0 flex-1">
              <p class="text-sm break-words">{{ row.description }}</p>
              <p class="text-muted-foreground text-xs">{{ row.when }}</p>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class HistorySection {
  private readonly db = inject(FIRESTORE_DB);

  readonly boardId = input.required<string>();
  readonly taskId = input.required<string>();
  readonly collaborators = input<Collaborator[]>([]);
  readonly createdBy = input<string | undefined>(undefined);
  readonly createdAt = input<FirestoreTimestamp | undefined>(undefined);

  private readonly history = collectionSignal<HistoryEntry>(() =>
    taskHistoryQuery(this.db, this.boardId(), this.taskId()),
  );

  protected readonly rows = computed<Row[]>(() => {
    const collaborators = this.collaborators();
    const rows: Row[] = (this.history() ?? []).map((entry) => ({
      id: entry.id,
      description: describe(entry, collaborators),
      when: formatRelativeTime(entry.createdAt),
    }));

    const createdAt = this.createdAt();
    if (createdAt) {
      const creator = collaborators.find((c) => c.id === this.createdBy())?.name ?? 'Someone';
      rows.push({
        id: '__created__',
        description: `${creator} created this task`,
        when: formatRelativeTime(createdAt),
      });
    }
    return rows;
  });
}
