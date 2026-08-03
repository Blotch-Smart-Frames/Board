import { Component, computed, inject, input } from '@angular/core';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { AttachmentSection } from '../attachments/attachment-section';
import { CommentsSection } from '../comments/comments-section';
import { TaskMetadataSidebar } from '../sidebar/task-metadata-sidebar';
import { TaskDescriptionEditor } from './task-description-editor/task-description-editor';
import { TaskListSelect } from './task-list-select/task-list-select';
import { BoardStore } from '../../data/board.store';
import type { Attachment, Task } from '../../../../shared/types/board';

@Component({
  selector: 'app-task-details-tab',
  imports: [
    HlmFieldImports,
    AttachmentSection,
    CommentsSection,
    TaskDescriptionEditor,
    TaskListSelect,
    TaskMetadataSidebar,
  ],
  template: `
    <div class="flex flex-col gap-5 sm:flex-row">
      <div class="flex flex-1 flex-col gap-5">
        @if (store.listsWithTasks().length > 0) {
          <app-task-list-select
            [value]="task().listId"
            [lists]="store.listsWithTasks()"
            (listMove)="onMoveToList($event)"
          />
        }

        <app-task-description-editor
          [taskKey]="task().id"
          [initialDescription]="task().description ?? ''"
          (descriptionChange)="onDescriptionChange($event)"
        />
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

  protected onDescriptionChange(description: string | undefined): void {
    this.store.updateTask(this.task().id, { description });
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

  protected onMoveToList(listId: string): void {
    this.store.moveTaskToList(this.task().id, listId);
  }
}
