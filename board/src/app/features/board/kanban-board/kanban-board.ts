import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { CdkDropList, CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKanbanSquare } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { BoardBackground } from '../board-background/board-background';
import { ListColumn } from '../list-column/list-column';
import { AddListButton } from '../add-list-button/add-list-button';
import { TaskDialog } from '../task-dialog/task-dialog';
import { TaskDetailDialog } from '../task-detail/task-detail-dialog';
import { LabelFilter } from '../label-filter/label-filter';
import { AssigneeFilter } from '../assignee-filter/assignee-filter';
import { BoardStore } from '../data/board.store';
import type { Task, UpdateTaskInput } from '../../../shared/types/board';

@Component({
  selector: 'app-kanban-board',
  imports: [
    CdkDropList,
    CdkDrag,
    NgIcon,
    HlmButton,
    HlmEmptyImports,
    BoardBackground,
    ListColumn,
    AddListButton,
    TaskDialog,
    TaskDetailDialog,
    LabelFilter,
    AssigneeFilter,
  ],
  providers: [provideIcons({ lucideKanbanSquare })],
  template: `
    <app-board-background [imageUrl]="store.board()?.backgroundImageUrl">
      <div class="flex flex-wrap items-center gap-2 px-4 py-2">
        <app-label-filter
          [labels]="store.labels() ?? []"
          [selectedLabelIds]="store.labelFilter()"
          (selectedLabelIdsChange)="store.labelFilter.set($event)"
        />
        <app-assignee-filter
          [collaborators]="store.collaborators()"
          [selectedAssigneeId]="store.assigneeFilter()"
          (selectedAssigneeIdChange)="store.assigneeFilter.set($event)"
        />
      </div>

      <div class="flex-1 overflow-x-auto overflow-y-hidden p-4">
        @if (store.listsWithTasks().length === 0) {
          <div class="flex h-full items-center justify-center">
            <hlm-empty class="w-96">
              <hlm-empty-header>
                <hlm-empty-media variant="icon">
                  <ng-icon name="lucideKanbanSquare" />
                </hlm-empty-media>
                <div hlmEmptyTitle>No lists yet</div>
                <div hlmEmptyDescription>
                  Get started by creating your first list to organize tasks on this board.
                </div>
              </hlm-empty-header>
              <hlm-empty-content>
                <button hlmBtn (click)="store.addList({ title: 'New list' })">Create list</button>
              </hlm-empty-content>
            </hlm-empty>
          </div>
        } @else {
          <div class="flex h-full items-start gap-4">
            <div
              class="flex h-full items-start gap-4"
              cdkDropList
              cdkDropListOrientation="horizontal"
              (cdkDropListDropped)="onListDrop($event)"
            >
              @for (list of store.listsWithTasks(); track list.id; let i = $index, count = $count) {
                <div cdkDrag [cdkDragData]="list.id">
                  <app-list-column
                    [list]="list"
                    [labels]="store.labels() ?? []"
                    [connectedListIds]="listIds()"
                    [canMoveLeft]="i > 0"
                    [canMoveRight]="i < count - 1"
                    (updateTitle)="store.updateListTitle(list.id, { title: $event })"
                    (deleteList)="store.deleteList(list.id)"
                    (addTask)="store.addTask(list.id, { title: $event })"
                    (viewTask)="openDetail($event)"
                    (taskDropped)="onTaskDrop($event)"
                    (moveLeft)="store.reorderListToIndex(list.id, i - 1)"
                    (moveRight)="store.reorderListToIndex(list.id, i + 1)"
                  />
                </div>
              }
            </div>
            <app-add-list-button (listAdded)="store.addList({ title: $event })" />
          </div>
        }
      </div>
    </app-board-background>

    <app-task-dialog
      #taskDialog
      [saveHandler]="saveHandler"
      [deleteHandler]="deleteHandler"
      [boardId]="store.boardId() ?? ''"
      [labels]="store.labels() ?? []"
      [collaborators]="store.collaborators()"
      [board]="store.board() ?? null"
      [sprints]="store.sprints() ?? []"
    />
    <app-task-detail-dialog #detailDialog (edit)="openEdit($event)" />
  `,
})
export class KanbanBoard {
  protected readonly store = inject(BoardStore);
  private readonly taskDialog = viewChild.required<TaskDialog>('taskDialog');
  private readonly detailDialog = viewChild.required<TaskDetailDialog>('detailDialog');
  private readonly editingTask = signal<Task | null>(null);

  protected readonly listIds = computed(() => this.store.listsWithTasks().map((l) => l.id));

  protected readonly saveHandler = async (data: UpdateTaskInput): Promise<void> => {
    const task = this.editingTask();
    if (task) await this.store.updateTask(task.id, data);
  };

  protected readonly deleteHandler = async (): Promise<void> => {
    const task = this.editingTask();
    if (task) await this.store.deleteTask(task.id);
  };

  protected openDetail(task: Task): void {
    this.detailDialog().open(task);
  }

  protected openEdit(task: Task): void {
    this.editingTask.set(task);
    this.taskDialog().open(task);
  }

  protected onTaskDrop(event: CdkDragDrop<Task[]>): void {
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }
    const task = event.item.data as Task;
    this.store.moveTaskToIndex(task.id, event.container.id, event.currentIndex);
  }

  protected onListDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    const listId = event.item.data as string;
    this.store.reorderListToIndex(listId, event.currentIndex);
  }
}
