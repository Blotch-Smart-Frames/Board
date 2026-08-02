import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { AttachmentSection } from '../attachments/attachment-section';
import { CommentsSection } from '../comments/comments-section';
import { TaskMetadataSidebar } from '../sidebar/task-metadata-sidebar';
import { BoardStore } from '../../data/board.store';
import type { Attachment, Task } from '../../../../shared/types/board';

type DescriptionFormModel = {
  description: string;
};

@Component({
  selector: 'app-task-details-tab',
  imports: [
    HlmFieldImports,
    HlmInput,
    HlmSelectImports,
    FormField,
    AttachmentSection,
    CommentsSection,
    TaskMetadataSidebar,
  ],
  template: `
    <div class="flex flex-col gap-5 sm:flex-row">
      <div class="flex flex-1 flex-col gap-5">
        @if (store.listsWithTasks().length > 0) {
          <div hlmField>
            <label hlmFieldLabel for="detail-list-trigger">List</label>
            <hlm-select
              [value]="task().listId"
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
        [selectedLabelIds]="task().labelIds ?? []"
        [collaborators]="store.collaborators()"
        [assignedUserIds]="task().assignedTo ?? []"
        [creator]="creator()"
        [color]="task().color"
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
      [taskId]="task().id"
      [attachments]="task().attachments ?? []"
      (attachmentsChange)="onAttachmentsChange($event)"
    />

    <hlm-field-separator />

    <app-comments-section
      [boardId]="boardId()"
      [taskId]="task().id"
      [collaborators]="store.collaborators()"
    />
  `,
})
export class TaskDetailsTab {
  protected readonly store = inject(BoardStore);

  readonly task = input.required<Task>();
  readonly boardId = input.required<string>();

  protected readonly creator = computed(() => {
    const id = this.task().createdBy;
    if (!id) return null;
    return this.store.collaborators().find((c) => c.id === id) ?? null;
  });

  // Reset the description model only when a different task is opened; keep
  // in-progress edits intact if the same task is updated from elsewhere.
  protected readonly descriptionModel = linkedSignal<string, DescriptionFormModel>({
    source: () => this.task().id,
    computation: () => ({ description: this.task().description ?? '' }),
  });
  protected readonly descriptionForm = form(this.descriptionModel);

  protected saveDescription(): void {
    const task = this.task();
    const value = this.descriptionModel().description.trim();
    const current = task.description ?? '';
    if (value !== current) {
      this.store.updateTask(task.id, { description: value || undefined });
    }
  }

  protected onLabelsChange(labelIds: string[]): void {
    this.store.updateTask(this.task().id, { labelIds });
  }

  protected onAssigneesChange(userIds: string[]): void {
    this.store.updateTask(this.task().id, { assignedTo: userIds });
  }

  protected handBackToCreator(): void {
    const creator = this.creator();
    if (!creator) return;
    this.store.updateTask(this.task().id, { assignedTo: [creator.id] });
  }

  protected onColorChange(color: string): void {
    this.store.updateTask(this.task().id, { color });
  }

  protected clearColor(): void {
    this.store.updateTask(this.task().id, { color: null });
  }

  protected onAttachmentsChange(attachments: Attachment[]): void {
    this.store.updateTask(this.task().id, { attachments });
  }

  protected onMoveToList(value: unknown): void {
    if (typeof value !== 'string' || !value) return;
    this.store.moveTaskToList(this.task().id, value);
  }

  protected readonly listIdToTitle = (id: string): string =>
    this.store.listsWithTasks().find((l) => l.id === id)?.title ?? '';
}
