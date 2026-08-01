import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { format } from 'date-fns';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { HlmCalendarImports } from '@spartan-ng/helm/calendar';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { LabelChip } from '../../../shared/components/label-chip/label-chip';
import { ColorPicker } from '../../../shared/components/color-picker/color-picker';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
import { LabelPicker } from '../label-picker/label-picker';
import { AssigneePicker } from '../assignee-picker/assignee-picker';
import { SprintPicker } from '../../sprints/sprint-picker/sprint-picker';
import { SprintDialog } from '../../sprints/sprint-dialog/sprint-dialog';
import { TaskAssignees } from '../task-assignees/task-assignees';
import { AttachmentSection } from './attachments/attachment-section';
import { CommentsSection } from './comments/comments-section';
import { HistorySection } from './history/history-section';
import { TaskMigrateForm } from './migrate/task-migrate-form';
import { BoardStore } from '../data/board.store';
import { SprintService } from '../../../core/services/sprint.service';
import { compareOrder } from '../../../shared/utils/ordering';
import type { Attachment, CreateSprintInput, Sprint, Task } from '../../../shared/types/board';

type TaskFormModel = {
  title: string;
  description: string;
};

const DEFAULT_SPRINT_DURATION_DAYS = 14;

@Component({
  selector: 'app-task-detail-dialog',
  imports: [
    HlmDialogImports,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmAlert,
    HlmAlertDescription,
    HlmSwitch,
    HlmCalendarImports,
    HlmFieldImports,
    HlmTabsImports,
    HlmSelectImports,
    NgIcon,
    FormField,
    LabelChip,
    ColorPicker,
    UserAvatar,
    LabelPicker,
    AssigneePicker,
    SprintPicker,
    SprintDialog,
    TaskAssignees,
    AttachmentSection,
    CommentsSection,
    HistorySection,
    TaskMigrateForm,
  ],
  providers: [provideIcons({ lucideTrash2, lucidePencil, lucidePlus })],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content
        *hlmDialogPortal
        class="flex max-h-[85vh] flex-col sm:w-[85vw]! sm:max-w-[85vw]!"
      >
        @if (task(); as task) {
          <hlm-dialog-header>
            @if (titleEditing()) {
              <div hlmField>
                <label class="sr-only" hlmFieldLabel for="task-title">Title</label>
                <input
                  #titleInput
                  hlmInput
                  id="task-title"
                  class="text-lg font-medium"
                  autocomplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  [formField]="taskForm.title"
                  (blur)="commitTitle()"
                  (keydown.enter)="onTitleEnter($event)"
                  (keydown.escape)="cancelTitleEdit()"
                />
                @for (err of taskForm.title().errors(); track err.kind) {
                  <hlm-field-error forceShow>{{ err.message }}</hlm-field-error>
                }
              </div>
            } @else {
              <h3
                hlmDialogTitle
                class="hover:bg-accent -mx-2 -my-1 cursor-text rounded px-2 py-1 pr-6 text-lg wrap-break-word"
                tabindex="0"
                (click)="startEditingTitle()"
                (keydown.enter)="startEditingTitle()"
              >
                {{ task.title }}
              </h3>
            }
          </hlm-dialog-header>

          <hlm-tabs
            [tab]="activeTab()"
            (tabActivated)="activeTab.set($any($event))"
            class="flex min-h-0 flex-1 flex-col"
          >
            <hlm-tabs-list class="w-fit">
              <button hlmTabsTrigger="details">Details</button>
              <button hlmTabsTrigger="sprint">Sprint</button>
              <button hlmTabsTrigger="history">History</button>
              <button hlmTabsTrigger="advanced">Advanced</button>
            </hlm-tabs-list>

            <div hlmTabsContent="details" class="flex flex-col gap-5 overflow-y-auto py-3">
              <div class="flex flex-col gap-5 sm:flex-row">
                <div class="flex flex-1 flex-col gap-5">
                  @if (store.listsWithTasks().length > 0) {
                    <div hlmField>
                      <label hlmFieldLabel for="detail-list-trigger">List</label>
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

                  <div hlmField>
                    <label hlmFieldLabel for="task-description">Description</label>
                    <textarea
                      hlmInput
                      id="task-description"
                      class="min-h-20 resize-y"
                      placeholder="Add a description…"
                      autocomplete="off"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                      data-form-type="other"
                      [formField]="taskForm.description"
                      (blur)="saveDescription()"
                    ></textarea>
                  </div>
                </div>

                <div class="flex flex-col gap-5 sm:w-64">
                  <div hlmField>
                    <button
                      type="button"
                      class="text-muted-foreground hover:text-foreground w-fit text-left text-sm font-medium"
                      (click)="toggleLabels()"
                    >
                      Labels
                    </button>
                    @if (labelsExpanded()) {
                      <app-label-picker
                        [boardId]="boardId()"
                        [labels]="store.labels() ?? []"
                        [selectedLabelIds]="task.labelIds ?? []"
                        (selectedLabelIdsChange)="onLabelsChange($event)"
                      />
                    } @else if (taskLabels().length > 0) {
                      <div class="flex flex-wrap gap-1">
                        @for (label of taskLabels(); track label.id) {
                          <app-label-chip [label]="label" />
                        }
                      </div>
                    } @else {
                      <p class="text-muted-foreground text-sm">No labels</p>
                    }
                  </div>

                  <div class="flex flex-row gap-4">
                    <div hlmField class="flex-1">
                      <button
                        type="button"
                        class="text-muted-foreground hover:text-foreground w-fit text-left text-sm font-medium"
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

                    <div hlmField class="flex-1">
                      <span class="text-muted-foreground w-fit text-left text-sm font-medium">
                        Creator
                      </span>
                      @if (creator(); as creator) {
                        <div class="flex items-center gap-2">
                          <app-user-avatar
                            [name]="creator.name"
                            [photoURL]="creator.photoURL"
                            size="small"
                          />
                          <button
                            hlmBtn
                            variant="outline"
                            size="sm"
                            type="button"
                            (click)="handBackToCreator()"
                          >
                            Hand back
                          </button>
                        </div>
                      } @else {
                        <p class="text-muted-foreground text-sm">Unknown</p>
                      }
                    </div>
                  </div>

                  <div hlmField>
                    <div class="flex items-center justify-between">
                      <span hlmFieldLabel>Card color</span>
                      @if (task.color) {
                        <button
                          hlmBtn
                          variant="ghost"
                          size="sm"
                          type="button"
                          (click)="clearColor()"
                        >
                          Clear
                        </button>
                      }
                    </div>
                    <app-color-picker
                      [value]="task.color ?? ''"
                      (valueChange)="onColorChange($event)"
                    />
                  </div>
                </div>
              </div>

              <hlm-field-separator />

              <app-attachment-section
                [boardId]="boardId()"
                [taskId]="task.id"
                [attachments]="task.attachments ?? []"
                (attachmentsChange)="onAttachmentsChange($event)"
              />

              <hlm-field-separator />

              <app-comments-section
                [boardId]="boardId()"
                [taskId]="task.id"
                [collaborators]="store.collaborators()"
              />
            </div>

            <div hlmTabsContent="sprint" class="flex flex-col gap-5 overflow-y-auto py-3">
              <div hlmField>
                <div class="flex items-center justify-between">
                  <span hlmFieldLabel>Start &amp; due date</span>
                  @if (task.startDate || task.dueDate) {
                    <button hlmBtn variant="ghost" size="sm" type="button" (click)="clearDates()">
                      Clear
                    </button>
                  }
                </div>

                <div class="flex gap-2">
                  <hlm-calendar-range
                    class="mx-auto"
                    [startDate]="taskStartDate()"
                    [endDate]="taskDueDate()"
                    (startDateChange)="onStartDateChange($event)"
                    (endDateChange)="onEndDateChange($event)"
                  />

                  <div class="flex min-w-0 flex-1 flex-col gap-4">
                    <div>
                      <span hlmLabel>Default sprint duration</span>
                      <div class="mt-1 flex items-center gap-2">
                        <input
                          hlmInput
                          type="number"
                          min="1"
                          max="365"
                          class="w-24"
                          aria-label="Default sprint duration in days"
                          [value]="sprintDurationDays()"
                          (input)="sprintDurationDays.set($any($event.target).value)"
                        />
                        <span class="text-sm">days</span>
                        <button
                          hlmBtn
                          variant="outline"
                          size="sm"
                          [disabled]="savingSprintConfig() || sprintConfigUnchanged()"
                          (click)="saveSprintConfig()"
                        >
                          {{ savingSprintConfig() ? 'Saving...' : 'Save' }}
                        </button>
                      </div>
                      <p class="text-muted-foreground mt-1 text-xs">
                        Used when auto-calculating dates for new sprints
                      </p>
                    </div>

                    <hr class="border-border" />

                    <div>
                      <div class="mb-2 flex items-center justify-between">
                        <span class="text-muted-foreground text-sm">Sprints</span>
                        <button
                          hlmBtn
                          variant="ghost"
                          size="sm"
                          type="button"
                          (click)="openCreateSprint()"
                        >
                          <ng-icon name="lucidePlus" class="mr-2" />
                          Create Sprint
                        </button>
                      </div>

                      @if (sprintDeleteError()) {
                        <div hlmAlert variant="destructive" class="mb-2">
                          <p hlmAlertDescription>{{ sprintDeleteError() }}</p>
                        </div>
                      }

                      @if (sortedSprints().length === 0) {
                        <p class="text-muted-foreground text-sm">No sprints created yet</p>
                      } @else {
                        <div class="flex flex-col gap-2">
                          @for (sprint of sortedSprints(); track sprint.id) {
                            <div
                              class="flex items-center justify-between gap-2 rounded-md border p-2"
                            >
                              <div class="min-w-0">
                                <p class="truncate text-sm font-medium">{{ sprint.name }}</p>
                                <p class="text-muted-foreground text-xs">
                                  {{ formatSprintDates(sprint) }}
                                </p>
                              </div>
                              <span class="flex shrink-0 gap-1">
                                <button
                                  hlmBtn
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Edit sprint"
                                  (click)="openEditSprint(sprint)"
                                >
                                  <ng-icon name="lucidePencil" />
                                </button>
                                <button
                                  hlmBtn
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Delete sprint"
                                  [disabled]="deletingSprintId() === sprint.id"
                                  (click)="removeSprint(sprint)"
                                >
                                  <ng-icon name="lucideTrash2" />
                                </button>
                              </span>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div hlmField orientation="horizontal">
                <hlm-switch
                  inputId="task-calendar-sync"
                  [checked]="task.calendarSyncEnabled"
                  [disabled]="!task.dueDate"
                  (checkedChange)="onCalendarSyncChange($event)"
                />
                <div hlmFieldContent>
                  <label hlmFieldLabel for="task-calendar-sync">Sync with Google Calendar</label>
                  @if (!task.dueDate) {
                    <p hlmFieldDescription>Set a due date to enable calendar sync</p>
                  }
                </div>
              </div>

              <app-sprint-picker
                [boardId]="boardId()"
                [sprints]="store.sprints() ?? []"
                [selectedSprintId]="task.sprintId ?? null"
                (selectedSprintIdChange)="onSprintChange($event)"
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

            <div hlmTabsContent="advanced" class="overflow-y-auto py-2">
              @if (activeTab() === 'advanced') {
                <app-task-migrate-form
                  [taskId]="task.id"
                  [sourceBoardId]="boardId()"
                  (migrated)="close()"
                />
              }
            </div>
          </hlm-tabs>

          <hlm-dialog-footer class="justify-between">
            <button hlmBtn variant="destructive" type="button" (click)="deleteTask()">
              <ng-icon name="lucideTrash2" class="mr-2" />
              Delete
            </button>
            <button hlmBtn variant="outline" type="button" (click)="close()">Close</button>
          </hlm-dialog-footer>
        }
      </hlm-dialog-content>
    </hlm-dialog>

    <app-sprint-dialog #sprintDialog [boardId]="boardId()" [saveHandler]="saveSprintHandler" />
  `,
})
export class TaskDetailDialog {
  protected readonly store = inject(BoardStore);
  private readonly sprintService = inject(SprintService);

  private readonly dialog = viewChild.required<HlmDialog>('dialog');
  private readonly sprintDialog = viewChild.required<SprintDialog>('sprintDialog');
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  private readonly taskId = signal<string | null>(null);
  protected readonly activeTab = signal<'details' | 'sprint' | 'history' | 'advanced'>('details');
  protected readonly titleEditing = signal(false);
  protected readonly assigneesExpanded = signal(false);
  protected readonly labelsExpanded = signal(false);

  protected readonly sprintDurationDays = signal(String(DEFAULT_SPRINT_DURATION_DAYS));
  protected readonly savingSprintConfig = signal(false);
  protected readonly deletingSprintId = signal<string | null>(null);
  protected readonly sprintDeleteError = signal<string | null>(null);
  private readonly editingSprint = signal<Sprint | null>(null);

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

  protected readonly creator = computed(() => {
    const id = this.task()?.createdBy;
    if (!id) return null;
    return this.store.collaborators().find((c) => c.id === id) ?? null;
  });

  protected readonly model = signal<TaskFormModel>({
    title: '',
    description: '',
  });

  protected readonly taskForm = form(this.model, (path) => {
    required(path.title, { message: 'A title is required' });
  });

  protected readonly taskStartDate = computed(() => this.task()?.startDate?.toDate());
  protected readonly taskDueDate = computed(() => this.task()?.dueDate?.toDate());

  protected readonly sortedSprints = computed(() =>
    [...(this.store.sprints() ?? [])].sort((a, b) => compareOrder(a.order, b.order)),
  );

  protected readonly sprintConfigUnchanged = computed(
    () =>
      this.sprintDurationDays() ===
      String(this.store.board()?.sprintConfig?.durationDays ?? DEFAULT_SPRINT_DURATION_DAYS),
  );

  open(task: Task): void {
    this.taskId.set(task.id);
    this.activeTab.set('details');
    this.titleEditing.set(false);
    this.assigneesExpanded.set(false);
    this.labelsExpanded.set(false);
    this.sprintDeleteError.set(null);
    this.editingSprint.set(null);
    this.sprintDurationDays.set(
      String(this.store.board()?.sprintConfig?.durationDays ?? DEFAULT_SPRINT_DURATION_DAYS),
    );
    this.model.set({
      title: task.title,
      description: task.description ?? '',
    });
    this.dialog().open();
  }

  close(): void {
    this.dialog().close(undefined);
  }

  protected toggleAssignees(): void {
    this.assigneesExpanded.update((expanded) => !expanded);
  }

  protected toggleLabels(): void {
    this.labelsExpanded.update((expanded) => !expanded);
  }

  protected startEditingTitle(): void {
    this.titleEditing.set(true);
    requestAnimationFrame(() => {
      const el = this.titleInput()?.nativeElement;
      el?.focus();
      el?.select();
    });
  }

  protected commitTitle(): void {
    const task = this.task();
    if (!task) return;
    const value = this.model().title.trim();
    if (this.taskForm.title().invalid() || !value) {
      // Empty title is invalid; revert to the current stored title.
      this.model.update((m) => ({ ...m, title: task.title }));
    } else if (value !== task.title) {
      this.store.updateTask(task.id, { title: value });
    }
    this.titleEditing.set(false);
  }

  protected cancelTitleEdit(): void {
    const task = this.task();
    if (task) this.model.update((m) => ({ ...m, title: task.title }));
    this.titleEditing.set(false);
  }

  protected onTitleEnter(event: Event): void {
    event.preventDefault();
    (event.target as HTMLInputElement).blur();
  }

  protected saveDescription(): void {
    const task = this.task();
    if (!task) return;
    const value = this.model().description.trim();
    const current = task.description ?? '';
    if (value !== current) {
      this.store.updateTask(task.id, { description: value || undefined });
    }
  }

  protected onStartDateChange(date: Date | undefined): void {
    const task = this.task();
    if (!task) return;
    const current = task.startDate?.toDate().getTime();
    if (date?.getTime() !== current) {
      this.store.updateTask(task.id, { startDate: date ?? null });
    }
  }

  protected onEndDateChange(date: Date | undefined): void {
    const task = this.task();
    if (!task) return;
    const current = task.dueDate?.toDate().getTime();
    if (date?.getTime() !== current) {
      this.store.updateTask(task.id, { dueDate: date ?? null });
    }
  }

  protected clearDates(): void {
    const task = this.task();
    if (!task) return;
    this.store.updateTask(task.id, { startDate: null, dueDate: null });
  }

  protected onLabelsChange(labelIds: string[]): void {
    const task = this.task();
    if (task) this.store.updateTask(task.id, { labelIds });
  }

  protected onAssigneesChange(userIds: string[]): void {
    const task = this.task();
    if (task) this.store.updateTask(task.id, { assignedTo: userIds });
  }

  protected handBackToCreator(): void {
    const task = this.task();
    const creator = this.creator();
    if (!task || !creator) return;
    this.store.updateTask(task.id, { assignedTo: [creator.id] });
  }

  protected onSprintChange(sprintId: string | null): void {
    const task = this.task();
    if (task) this.store.updateTask(task.id, { sprintId });
  }

  protected onColorChange(color: string): void {
    const task = this.task();
    if (task) this.store.updateTask(task.id, { color });
  }

  protected clearColor(): void {
    const task = this.task();
    if (task) this.store.updateTask(task.id, { color: null });
  }

  protected onCalendarSyncChange(enabled: boolean): void {
    const task = this.task();
    if (task) this.store.updateTask(task.id, { calendarSyncEnabled: enabled });
  }

  protected onAttachmentsChange(attachments: Attachment[]): void {
    const task = this.task();
    if (task) this.store.updateTask(task.id, { attachments });
  }

  protected onMoveToList(value: unknown): void {
    const task = this.task();
    if (!task || typeof value !== 'string' || !value) return;
    this.store.moveTaskToList(task.id, value);
  }

  protected async deleteTask(): Promise<void> {
    const task = this.task();
    if (!task) return;
    try {
      await this.store.deleteTask(task.id);
      this.close();
    } catch (err) {
      console.error('Task delete failed:', err);
    }
  }

  protected readonly listIdToTitle = (id: string): string =>
    this.store.listsWithTasks().find((l) => l.id === id)?.title ?? '';

  protected saveSprintConfig(): void {
    const days = parseInt(this.sprintDurationDays(), 10);
    if (isNaN(days) || days < 1) return;
    this.savingSprintConfig.set(true);
    this.sprintService
      .updateSprintConfig(this.boardId(), { durationDays: days })
      .catch((err) => console.error('Failed to save sprint config:', err))
      .finally(() => this.savingSprintConfig.set(false));
  }

  protected openCreateSprint(): void {
    this.editingSprint.set(null);
    this.sprintDialog().open(null);
  }

  protected openEditSprint(sprint: Sprint): void {
    this.editingSprint.set(sprint);
    this.sprintDialog().open(sprint);
  }

  protected readonly saveSprintHandler = (data: CreateSprintInput): Promise<void> => {
    const editing = this.editingSprint();
    return editing
      ? this.sprintService.updateSprint(this.boardId(), editing.id, data)
      : this.sprintService.createSprint(this.boardId(), data).then(() => {});
  };

  protected async removeSprint(sprint: Sprint): Promise<void> {
    this.sprintDeleteError.set(null);
    this.deletingSprintId.set(sprint.id);
    try {
      const { canDelete, taskCount } = await this.sprintService.canDeleteSprint(
        this.boardId(),
        sprint.id,
      );
      if (!canDelete) {
        const noun = taskCount === 1 ? 'task is' : 'tasks are';
        this.sprintDeleteError.set(
          `Cannot delete: ${taskCount} ${noun} assigned to this sprint. Remove tasks from the sprint first.`,
        );
        return;
      }
      await this.sprintService.deleteSprint(this.boardId(), sprint.id);
    } catch (err) {
      this.sprintDeleteError.set(err instanceof Error ? err.message : 'Failed to delete sprint');
    } finally {
      this.deletingSprintId.set(null);
    }
  }

  protected formatSprintDates(sprint: Sprint): string {
    return `${format(sprint.startDate.toDate(), 'MMM d, yyyy')} - ${format(sprint.endDate.toDate(), 'MMM d, yyyy')}`;
  }
}
