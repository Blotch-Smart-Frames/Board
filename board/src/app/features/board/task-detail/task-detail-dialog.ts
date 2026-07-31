import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { LabelChip } from '../../../shared/components/label-chip/label-chip';
import { ColorPicker } from '../../../shared/components/color-picker/color-picker';
import { LabelPicker } from '../label-picker/label-picker';
import { AssigneePicker } from '../assignee-picker/assignee-picker';
import { SprintPicker } from '../../sprints/sprint-picker/sprint-picker';
import { TaskAssignees } from '../task-assignees/task-assignees';
import { AttachmentSection } from './attachments/attachment-section';
import { CommentsSection } from './comments/comments-section';
import { HistorySection } from './history/history-section';
import { BoardStore } from '../data/board.store';
import { parseDateInput, toDateInputValue } from '../../../shared/utils/date-input';
import type { Attachment, Task } from '../../../shared/types/board';

type TaskFormModel = {
  title: string;
  description: string;
  startDate: string;
  dueDate: string;
};

@Component({
  selector: 'app-task-detail-dialog',
  imports: [
    HlmDialogImports,
    HlmButton,
    HlmInput,
    HlmSwitch,
    HlmFieldImports,
    HlmTabsImports,
    HlmSelectImports,
    NgIcon,
    FormField,
    LabelChip,
    ColorPicker,
    LabelPicker,
    AssigneePicker,
    SprintPicker,
    TaskAssignees,
    AttachmentSection,
    CommentsSection,
    HistorySection,
  ],
  providers: [provideIcons({ lucideTrash2 })],
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

                  <div hlmField>
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
              <div hlmFieldGroup class="grid grid-cols-2 gap-4">
                <div hlmField>
                  <label hlmFieldLabel for="task-start">Start date</label>
                  <input
                    hlmInput
                    id="task-start"
                    type="date"
                    autocomplete="off"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    [formField]="taskForm.startDate"
                    (blur)="saveStartDate()"
                  />
                </div>
                <div hlmField>
                  <label hlmFieldLabel for="task-due">Due date</label>
                  <input
                    hlmInput
                    id="task-due"
                    type="date"
                    autocomplete="off"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    [formField]="taskForm.dueDate"
                    (blur)="saveDueDate()"
                  />
                  @for (err of taskForm.dueDate().errors(); track err.kind) {
                    <hlm-field-error forceShow>{{ err.message }}</hlm-field-error>
                  }
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
                [board]="store.board() ?? null"
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
  `,
})
export class TaskDetailDialog {
  protected readonly store = inject(BoardStore);

  private readonly dialog = viewChild.required<HlmDialog>('dialog');
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  private readonly taskId = signal<string | null>(null);
  protected readonly activeTab = signal<'details' | 'sprint' | 'history'>('details');
  protected readonly titleEditing = signal(false);
  protected readonly assigneesExpanded = signal(false);
  protected readonly labelsExpanded = signal(false);

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

  protected readonly model = signal<TaskFormModel>({
    title: '',
    description: '',
    startDate: '',
    dueDate: '',
  });

  protected readonly taskForm = form(this.model, (path) => {
    required(path.title, { message: 'A title is required' });
    validate(path.dueDate, ({ value, valueOf }) => {
      const start = valueOf(path.startDate);
      if (value() && start && value() < start) {
        return { kind: 'dateOrder', message: 'Due date must be on or after the start date' };
      }
      return undefined;
    });
  });

  open(task: Task): void {
    this.taskId.set(task.id);
    this.activeTab.set('details');
    this.titleEditing.set(false);
    this.assigneesExpanded.set(false);
    this.labelsExpanded.set(false);
    this.model.set({
      title: task.title,
      description: task.description ?? '',
      startDate: task.startDate ? toDateInputValue(task.startDate.toDate()) : '',
      dueDate: task.dueDate ? toDateInputValue(task.dueDate.toDate()) : '',
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

  protected saveStartDate(): void {
    const task = this.task();
    if (!task || this.taskForm.dueDate().invalid()) return;
    const value = this.model().startDate;
    const current = task.startDate ? toDateInputValue(task.startDate.toDate()) : '';
    if (value !== current) {
      this.store.updateTask(task.id, { startDate: parseDateInput(value) });
    }
  }

  protected saveDueDate(): void {
    const task = this.task();
    if (!task || this.taskForm.dueDate().invalid()) return;
    const value = this.model().dueDate;
    const current = task.dueDate ? toDateInputValue(task.dueDate.toDate()) : '';
    if (value !== current) {
      this.store.updateTask(task.id, { dueDate: parseDateInput(value) });
    }
  }

  protected onLabelsChange(labelIds: string[]): void {
    const task = this.task();
    if (task) this.store.updateTask(task.id, { labelIds });
  }

  protected onAssigneesChange(userIds: string[]): void {
    const task = this.task();
    if (task) this.store.updateTask(task.id, { assignedTo: userIds });
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
}
