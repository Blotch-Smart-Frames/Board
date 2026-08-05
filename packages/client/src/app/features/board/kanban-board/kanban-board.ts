import { Component, computed, inject, viewChild } from '@angular/core';
import { CdkDropList, CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKanbanSquare } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmScrollAreaImports } from '@spartan-ng/helm/scroll-area';
import { NgScrollbar } from 'ngx-scrollbar';
import { BoardBackground } from '../board-background/board-background';
import { ListColumn } from '../list-column/list-column';
import { AddListButton } from '../add-list-button/add-list-button';
import { TaskDetailDialog } from '../task-detail/task-detail-dialog';
import { LabelFilter } from '../label-filter/label-filter';
import { AssigneeFilter } from '../assignee-filter/assignee-filter';
import { BoardStore } from '../data/board.store';
import { isTouchOrMobileSignal } from '../../../core/interop/breakpoint-signal';
import type { Task } from '../../../shared/types/board';

@Component({
  selector: 'app-kanban-board',
  imports: [
    CdkDropList,
    CdkDrag,
    NgIcon,
    HlmButton,
    HlmEmptyImports,
    HlmScrollAreaImports,
    NgScrollbar,
    BoardBackground,
    ListColumn,
    AddListButton,
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
          [selectedAssigneeIds]="store.assigneeFilter()"
          (selectedAssigneeIdsChange)="store.assigneeFilter.set($event)"
        />
      </div>

      <ng-scrollbar hlm class="min-h-0 flex-1" appearance="compact" orientation="horizontal">
        <div class="h-full p-4">
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
                [cdkDropListDisabled]="dragDisabled()"
                (cdkDropListDropped)="onListDrop($event)"
              >
                @for (
                  list of store.listsWithTasks();
                  track list.id;
                  let i = $index, count = $count
                ) {
                  <div cdkDrag [cdkDragData]="list.id" [cdkDragDisabled]="dragDisabled()">
                    <app-list-column
                      [list]="list"
                      [labels]="labels()"
                      [connectedListIds]="listIds()"
                      [canMoveLeft]="i > 0"
                      [canMoveRight]="i < count - 1"
                      [dragDisabled]="dragDisabled()"
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
      </ng-scrollbar>
    </app-board-background>

    <app-task-detail-dialog #detailDialog />
  `,
})
export class KanbanBoard {
  protected readonly store = inject(BoardStore);
  private readonly detailDialog = viewChild.required<TaskDetailDialog>('detailDialog');

  // Suppress drag-and-drop on mobile viewports and touch-primary devices where
  // CDK drag intercepts native touch scrolling of the board.
  protected readonly dragDisabled = isTouchOrMobileSignal();

  protected readonly listIds = computed(() => this.store.listsWithTasks().map((l) => l.id));
  /* v8 ignore next -- defensive: labels() is seeded to an array before this template reads it @preserve */
  protected readonly labels = computed(() => this.store.labels() ?? []);

  protected openDetail(task: Task): void {
    this.detailDialog().open(task);
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
