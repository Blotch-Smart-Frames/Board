import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCalendarImports } from '@spartan-ng/helm/calendar';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { FormField, form } from '@angular/forms/signals';
import { SprintPicker } from '../../sprints/sprint-picker/sprint-picker';
import { AttachmentSection } from './attachments/attachment-section';
import { CommentsSection } from './comments/comments-section';
import { HistorySection } from './history/history-section';
import { TaskMigrateForm } from './migrate/task-migrate-form';
import { TaskMetadataSidebar } from './sidebar/task-metadata-sidebar';
import { SprintManagement } from './sprint/sprint-management';
import { TaskTitleEditor } from './title/task-title-editor';
import { BoardStore } from '../data/board.store';
import type { Attachment, Task } from '../../../shared/types/board';

type DescriptionFormModel = {
  description: string;
};

@Component({
  selector: 'app-task-detail-dialog',
  imports: [
    HlmDialogImports,
    HlmButton,
    HlmInput,
    HlmSwitch,
    HlmCalendarImports,
    HlmFieldImports,
    HlmTabsImports,
    HlmSelectImports,
    NgIcon,
    FormField,
    SprintPicker,
    AttachmentSection,
    CommentsSection,
    HistorySection,
    TaskMigrateForm,
    TaskTitleEditor,
    TaskMetadataSidebar,
    SprintManagement,
  ],
  providers: [provideIcons({ lucideTrash2 })],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content
        *hlmDialogPortal
        class="flex h-[85vh] flex-col sm:w-[85vw]! sm:max-w-[85vw]!"
      >
        @if (task(); as task) {
          <hlm-dialog-header>
            <app-task-title-editor [title]="task.title" (titleChange)="onTitleChange($event)" />
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
                      [formField]="descriptionForm.description"
                      (blur)="saveDescription()"
                    ></textarea>
                  </div>
                </div>

                <app-task-metadata-sidebar
                  [boardId]="boardId()"
                  [labels]="store.labels() ?? []"
                  [selectedLabelIds]="task.labelIds ?? []"
                  [collaborators]="store.collaborators()"
                  [assignedUserIds]="task.assignedTo ?? []"
                  [creator]="creator()"
                  [color]="task.color"
                  (selectedLabelIdsChange)="onLabelsChange($event)"
                  (assignedUserIdsChange)="onAssigneesChange($event)"
                  (handBack)="handBackToCreator()"
                  (colorChange)="onColorChange($event)"
                  (colorClear)="clearColor()"
                />
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

                  <app-sprint-management
                    class="flex-1"
                    [boardId]="boardId()"
                    [sprints]="store.sprints() ?? []"
                    [configuredDurationDays]="store.board()?.sprintConfig?.durationDays"
                  />
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
  `,
})
export class TaskDetailDialog {
  protected readonly store = inject(BoardStore);

  private readonly dialog = viewChild.required<HlmDialog>('dialog');

  private readonly taskId = signal<string | null>(null);
  protected readonly activeTab = signal<'details' | 'sprint' | 'history' | 'advanced'>('details');

  protected readonly task = computed(() =>
    (this.store.tasks() ?? []).find((t) => t.id === this.taskId()),
  );
  protected readonly boardId = computed(() => this.store.boardId() ?? '');

  protected readonly creator = computed(() => {
    const id = this.task()?.createdBy;
    if (!id) return null;
    return this.store.collaborators().find((c) => c.id === id) ?? null;
  });

  protected readonly descriptionModel = signal<DescriptionFormModel>({ description: '' });
  protected readonly descriptionForm = form(this.descriptionModel);

  protected readonly taskStartDate = computed(() => this.task()?.startDate?.toDate());
  protected readonly taskDueDate = computed(() => this.task()?.dueDate?.toDate());

  open(task: Task): void {
    this.taskId.set(task.id);
    this.activeTab.set('details');
    this.descriptionModel.set({ description: task.description ?? '' });
    this.dialog().open();
  }

  close(): void {
    this.dialog().close(undefined);
  }

  protected onTitleChange(title: string): void {
    const task = this.task();
    if (task) this.store.updateTask(task.id, { title });
  }

  protected saveDescription(): void {
    const task = this.task();
    if (!task) return;
    const value = this.descriptionModel().description.trim();
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
}
