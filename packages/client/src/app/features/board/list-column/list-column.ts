import { Component, computed, input, output } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragHandle, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGripVertical } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { AddTaskForm } from './add-task-form/add-task-form';
import { ListHeader } from '../list-header/list-header';
import { TaskCard } from '../task-card/task-card';
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
    AddTaskForm,
    ListHeader,
    TaskCard,
  ],
  providers: [provideIcons({ lucideGripVertical })],
  template: `
    <div class="bg-muted/60 flex max-h-[calc(100dvh-160px)] w-72 shrink-0 flex-col rounded-lg">
      <div class="flex items-center">
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
        <div class="flex-1">
          <app-list-header
            [title]="list().title"
            [taskCount]="activeTasks().length"
            [canMoveLeft]="canMoveLeft()"
            [canMoveRight]="canMoveRight()"
            (updateTitle)="updateTitle.emit($event)"
            (deleteList)="deleteList.emit()"
            (moveLeft)="moveLeft.emit()"
            (moveRight)="moveRight.emit()"
          />
        </div>
      </div>

      <div
        class="flex-1 space-y-2 overflow-y-auto p-2"
        cdkDropList
        [id]="list().id"
        [cdkDropListData]="activeTasks()"
        [cdkDropListConnectedTo]="connectedListIds()"
        (cdkDropListDropped)="taskDropped.emit($event)"
      >
        @for (task of activeTasks(); track task.id) {
          <div cdkDrag [cdkDragData]="task">
            <app-task-card [task]="task" [labels]="labels()" (view)="viewTask.emit($event)" />
          </div>
        } @empty {
          <p class="text-muted-foreground py-4 text-center text-sm">No tasks yet</p>
        }
      </div>

      @if (completedTasks().length > 0) {
        <details class="px-2 pb-2">
          <summary class="text-muted-foreground cursor-pointer px-1 py-1 text-sm">
            Completed ({{ completedTasks().length }})
          </summary>
          <div class="mt-2 space-y-2">
            @for (task of completedTasks(); track task.id) {
              <app-task-card [task]="task" [labels]="labels()" (view)="viewTask.emit($event)" />
            }
          </div>
        </details>
      }

      <app-add-task-form (addTask)="addTask.emit($event)" />
    </div>
  `,
})
export class ListColumn {
  readonly list = input.required<ListWithTasks>();
  readonly labels = input<Label[]>([]);
  readonly connectedListIds = input<string[]>([]);
  readonly canMoveLeft = input(false);
  readonly canMoveRight = input(false);

  readonly updateTitle = output<string>();
  readonly deleteList = output<void>();
  readonly addTask = output<string>();
  readonly viewTask = output<Task>();
  readonly taskDropped = output<CdkDragDrop<Task[]>>();
  readonly moveLeft = output<void>();
  readonly moveRight = output<void>();

  protected readonly activeTasks = computed(() => this.list().tasks.filter((t) => !t.completedAt));
  protected readonly completedTasks = computed(() =>
    this.list().tasks.filter((t) => t.completedAt),
  );
}
