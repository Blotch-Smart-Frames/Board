import { Component, computed, input, output } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragHandle, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGripVertical } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmScrollAreaImports } from '@spartan-ng/helm/scroll-area';
import { NgScrollbar } from 'ngx-scrollbar';
import { AddTaskForm } from './add-task-form/add-task-form';
import { ListHeader } from '../list-header/list-header';
import { TaskCard } from '../task-card/task-card';
import { MAX_TASKS_PER_LIST } from '../list-limit';
import type { List, Task, Label } from '../../../shared/types/board';

export type ListWithTasks = List & { tasks: Task[] };

@Component({
  selector: 'app-list-column',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    NgIcon,
    HlmButton,
    HlmScrollAreaImports,
    NgScrollbar,
    AddTaskForm,
    ListHeader,
    TaskCard,
  ],
  providers: [provideIcons({ lucideGripVertical })],
  template: `
    <div class="bg-muted/60 flex max-h-[calc(100dvh-160px)] w-72 shrink-0 flex-col rounded-lg">
      <div class="flex items-center">
        @if (!dragDisabled()) {
          <button
            hlmBtn
            variant="ghost"
            size="icon-sm"
            cdkDragHandle
            class="ml-1 cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder list"
          >
            <ng-icon name="lucideGripVertical" />
          </button>
        }
        <div class="min-w-0 flex-1">
          <app-list-header
            [title]="list().title"
            [taskCount]="taskCount()"
            [isArchival]="isArchival()"
            [canMoveLeft]="canMoveLeft()"
            [canMoveRight]="canMoveRight()"
            (updateTitle)="updateTitle.emit($event)"
            (deleteList)="deleteList.emit()"
            (moveLeft)="moveLeft.emit()"
            (moveRight)="moveRight.emit()"
          />
        </div>
      </div>

      @if (!isArchival()) {
        <ng-scrollbar
          hlm
          class="min-h-0 flex-1 scroll-fade"
          appearance="compact"
          orientation="vertical"
          style="--_scrollbar-content-width: 100%"
        >
          <div
            class="space-y-2 p-2"
            scrollViewport
            cdkDropList
            [id]="list().id"
            [cdkDropListData]="tasks()"
            [cdkDropListConnectedTo]="connectedListIds()"
            [cdkDropListDisabled]="dragDisabled()"
            [cdkDropListEnterPredicate]="canEnter"
            (cdkDropListDropped)="taskDropped.emit($event)"
          >
            @for (task of tasks(); track task.id) {
              <div cdkDrag [cdkDragData]="task" [cdkDragDisabled]="dragDisabled()">
                <app-task-card [task]="task" [labels]="labels()" (view)="viewTask.emit($event)" />
              </div>
            } @empty {
              <p class="text-muted-foreground py-4 text-center text-sm">No tasks yet</p>
            }
          </div>
        </ng-scrollbar>
      }

      <!--
        Archival lists show a bounded, faded peek at their most-recently-archived
        tasks. The bottom gradient mask hints "there could be more" without
        loading the full archive. The container is still a cdkDropList so tasks
        dragged in from other columns get archived, and preview cards stay
        draggable so dragging one back to a non-archival list un-archives it.
      -->
      @if (isArchival()) {
        <div
          class="min-h-0 flex-1 space-y-2 overflow-y-auto p-2"
          style="mask-image: linear-gradient(to bottom, black 55%, transparent); -webkit-mask-image: linear-gradient(to bottom, black 55%, transparent)"
          cdkDropList
          [id]="list().id"
          [cdkDropListData]="archivedPreview()"
          [cdkDropListConnectedTo]="connectedListIds()"
          [cdkDropListDisabled]="dragDisabled()"
          (cdkDropListDropped)="taskDropped.emit($event)"
        >
          @for (task of archivedPreview(); track task.id) {
            <div cdkDrag [cdkDragData]="task" [cdkDragDisabled]="dragDisabled()" class="opacity-65">
              <app-task-card [task]="task" [labels]="labels()" (view)="viewTask.emit($event)" />
            </div>
          } @empty {
            <p class="text-muted-foreground py-4 text-center text-sm">No tasks yet</p>
          }
        </div>
      }

      @if (!isArchival()) {
        @if (isFull()) {
          <p class="text-muted-foreground p-4 text-center text-sm" role="status">
            List is full. Finish or move a task before adding more.
          </p>
        } @else {
          <app-add-task-form (addTask)="addTask.emit($event)" />
        }
      }
    </div>
  `,
})
export class ListColumn {
  readonly list = input.required<ListWithTasks>();
  readonly labels = input<Label[]>([]);
  readonly connectedListIds = input<string[]>([]);
  // When this list is configured as an archive, `archivedPreview` holds its last
  // few archived tasks to render as a faded peek beneath the active tasks.
  readonly isArchival = input(false);
  readonly archivedPreview = input<Task[]>([]);
  // Active task count ignoring board filters (hidden cards still use a slot).
  // Falls back to the visible task count when the parent doesn't supply one.
  readonly totalTaskCount = input<number>();
  readonly canMoveLeft = input(false);
  readonly canMoveRight = input(false);
  // Parent (KanbanBoard) flips this on mobile/touch to suppress task drag-drop
  // and hide the grip handle so it doesn't fight native touch scrolling.
  readonly dragDisabled = input(false);

  readonly updateTitle = output<string>();
  readonly deleteList = output<void>();
  readonly addTask = output<string>();
  readonly viewTask = output<Task>();
  readonly taskDropped = output<CdkDragDrop<Task[]>>();
  readonly moveLeft = output<void>();
  readonly moveRight = output<void>();

  protected readonly tasks = computed(() => this.list().tasks);
  protected readonly taskCount = computed(() => this.totalTaskCount() ?? this.tasks().length);
  protected readonly isFull = computed(
    () => !this.isArchival() && this.taskCount() >= MAX_TASKS_PER_LIST,
  );

  /** Blocks dragging new tasks into a full list; reordering tasks already in it still works. */
  protected readonly canEnter = (drag: CdkDrag<Task>): boolean =>
    !this.isFull() || drag.data.listId === this.list().id;
}
