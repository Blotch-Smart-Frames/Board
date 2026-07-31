import { Component, computed, inject, signal, viewChild, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar } from '@ng-icons/lucide';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { LabelChip } from '../../../shared/components/label-chip/label-chip';
import { TaskAssignees } from '../task-assignees/task-assignees';
import { AssigneePicker } from '../assignee-picker/assignee-picker';
import { AttachmentSection } from './attachments/attachment-section';
import { CommentsSection } from './comments/comments-section';
import { HistorySection } from './history/history-section';
import { BoardStore } from '../data/board.store';
import type { Task, Attachment } from '../../../shared/types/board';
import type { Timestamp } from 'firebase/firestore';

function formatDate(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

@Component({
  selector: 'app-task-detail-dialog',
  imports: [
    HlmDialogImports,
    HlmButton,
    HlmBadge,
    HlmLabel,
    HlmTabsImports,
    HlmSelectImports,
    NgIcon,
    LabelChip,
    TaskAssignees,
    AssigneePicker,
    AttachmentSection,
    CommentsSection,
    HistorySection,
  ],
  providers: [provideIcons({ lucideCalendar })],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content *hlmDialogPortal class="flex max-h-[85vh] flex-col sm:max-w-lg">
        @if (task(); as task) {
          <hlm-dialog-header>
            <h3 hlmDialogTitle class="pr-6 break-words">{{ task.title }}</h3>
          </hlm-dialog-header>

          <hlm-tabs
            [tab]="activeTab()"
            (tabActivated)="activeTab.set($any($event))"
            class="flex min-h-0 flex-1 flex-col"
          >
            <hlm-tabs-list class="w-fit">
              <button hlmTabsTrigger="details">Details</button>
              <button hlmTabsTrigger="history">History</button>
            </hlm-tabs-list>

            <div hlmTabsContent="details" class="flex flex-col gap-4 overflow-y-auto py-2">
              @if (store.listsWithTasks().length > 0) {
                <div>
                  <label hlmLabel for="detail-list-trigger">List</label>
                  <hlm-select
                    [value]="task.listId"
                    [itemToString]="listIdToTitle"
                    (valueChange)="onMoveToList($event)"
                  >
                    <hlm-select-trigger [buttonId]="'detail-list-trigger'" class="w-full">
                      <hlm-select-value />
                    </hlm-select-trigger>
                    <hlm-select-content *hlmSelectPortal>
                      @for (list of store.listsWithTasks(); track list.id) {
                        <hlm-select-item [value]="list.id">{{ list.title }}</hlm-select-item>
                      }
                    </hlm-select-content>
                  </hlm-select>
                </div>
              }

              @if (task.description) {
                <div>
                  <h4 class="text-muted-foreground mb-1 text-sm font-medium">Description</h4>
                  <p class="text-sm whitespace-pre-wrap">{{ task.description }}</p>
                </div>
              }

              @if (taskLabels().length > 0) {
                <div>
                  <h4 class="text-muted-foreground mb-1 text-sm font-medium">Labels</h4>
                  <div class="flex flex-wrap gap-1">
                    @for (label of taskLabels(); track label.id) {
                      <app-label-chip [label]="label" />
                    }
                  </div>
                </div>
              }

              <div>
                <button
                  type="button"
                  class="text-muted-foreground mb-1 text-sm font-medium"
                  (click)="toggleAssignees()"
                >
                  Assignees
                </button>
                @if (assigneesExpanded()) {
                  <app-assignee-picker
                    [collaborators]="store.collaborators()"
                    [selectedUserIds]="task.assignedTo ?? []"
                    (selectedUserIdsChange)="onAssigneesChange($event)"
                  />
                } @else if (assignedUsers().length > 0) {
                  <app-task-assignees [assignedUsers]="assignedUsers()" />
                } @else {
                  <p class="text-muted-foreground text-sm">No assignees</p>
                }
              </div>

              @if (task.startDate || task.dueDate) {
                <div>
                  <h4 class="text-muted-foreground mb-1 text-sm font-medium">Dates</h4>
                  <div class="flex flex-wrap gap-2">
                    @if (task.startDate) {
                      <span hlmBadge variant="outline">
                        <ng-icon name="lucideCalendar" class="mr-1" />
                        Start: {{ formatDate(task.startDate) }}
                      </span>
                    }
                    @if (task.dueDate) {
                      <span hlmBadge [variant]="task.calendarSyncEnabled ? 'default' : 'outline'">
                        <ng-icon name="lucideCalendar" class="mr-1" />
                        Due: {{ formatDate(task.dueDate) }}
                      </span>
                    }
                  </div>
                </div>
              }

              <app-attachment-section
                [boardId]="boardId()"
                [taskId]="task.id"
                [attachments]="task.attachments ?? []"
                (attachmentsChange)="onAttachmentsChange($event)"
              />

              <hr class="border-border" />

              <app-comments-section
                [boardId]="boardId()"
                [taskId]="task.id"
                [collaborators]="store.collaborators()"
              />
            </div>

            <div hlmTabsContent="history" class="overflow-y-auto py-2">
              @if (activeTab() === 'history') {
                <app-history-section
                  [boardId]="boardId()"
                  [taskId]="task.id"
                  [collaborators]="store.collaborators()"
                  [createdBy]="task.createdBy"
                  [createdAt]="task.createdAt"
                />
              }
            </div>
          </hlm-tabs>

          <hlm-dialog-footer>
            <button hlmBtn variant="outline" type="button" (click)="close()">Close</button>
            <button hlmBtn type="button" (click)="onEdit()">Edit</button>
          </hlm-dialog-footer>
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class TaskDetailDialog {
  protected readonly store = inject(BoardStore);

  readonly edit = output<Task>();

  private readonly dialog = viewChild.required<HlmDialog>('dialog');

  private readonly taskId = signal<string | null>(null);
  protected readonly activeTab = signal<'details' | 'history'>('details');
  protected readonly assigneesExpanded = signal(false);

  protected readonly task = computed(() =>
    (this.store.tasks() ?? []).find((t) => t.id === this.taskId()),
  );
  protected readonly boardId = computed(() => this.store.boardId() ?? '');

  protected readonly taskLabels = computed(() => {
    const ids = this.task()?.labelIds ?? [];
    return (this.store.labels() ?? []).filter((label) => ids.includes(label.id));
  });

  protected readonly assignedUsers = computed(() => {
    const ids = this.task()?.assignedTo ?? [];
    return this.store.collaborators().filter((c) => ids.includes(c.id));
  });

  protected readonly formatDate = formatDate;

  open(task: Task): void {
    this.taskId.set(task.id);
    this.activeTab.set('details');
    this.assigneesExpanded.set(false);
    this.dialog().open();
  }

  close(): void {
    this.dialog().close(undefined);
  }

  protected toggleAssignees(): void {
    this.assigneesExpanded.update((expanded) => !expanded);
  }

  protected onEdit(): void {
    const task = this.task();
    if (!task) return;
    this.close();
    this.edit.emit(task);
  }

  protected onAttachmentsChange(attachments: Attachment[]): void {
    const task = this.task();
    if (!task) return;
    this.store.updateTask(task.id, { attachments });
  }

  protected onAssigneesChange(userIds: string[]): void {
    const task = this.task();
    if (!task) return;
    this.store.updateTask(task.id, { assignedTo: userIds });
  }

  protected onMoveToList(value: unknown): void {
    const task = this.task();
    if (!task || typeof value !== 'string' || !value) return;
    this.store.moveTaskToList(task.id, value);
  }

  protected readonly listIdToTitle = (id: string): string =>
    this.store.listsWithTasks().find((l) => l.id === id)?.title ?? '';
}
