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

      <ng-scrollbar
        hlm
        class="min-h-0 flex-1"
        appearance="compact"
        orientation="vertical"
        style="--_scrollbar-content-width: 100%"
      >
        <div
          class="space-y-2 p-2"
          scrollViewport
          cdkDropList
          [id]="list().id"
          [cdkDropListData]="activeTasks()"
          [cdkDropListConnectedTo]="connectedListIds()"
          [cdkDropListDisabled]="dragDisabled()"
          (cdkDropListDropped)="taskDropped.emit($event)"
        >
          @for (task of activeTasks(); track task.id) {
            <div cdkDrag [cdkDragData]="task" [cdkDragDisabled]="dragDisabled()">
              <app-task-card [task]="task" [labels]="labels()" (view)="viewTask.emit($event)" />
            </div>
          } @empty {
            <p class="text-muted-foreground py-4 text-center text-sm">No tasks yet</p>
          }
        </div>
      </ng-scrollbar>

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

      <!--
        Archival lists show a bounded, faded peek at their most-recently-archived
        tasks. The bottom gradient mask hints "there could be more" without
        loading the full archive. Cards stay clickable so a task can be opened
        (and moved back out of the archive, which un-archives it).
      -->
      @if (isArchival() && archivedPreview().length > 0) {
        <div class="px-2 pb-2">
          <p class="text-muted-foreground px-1 py-1 text-xs font-medium">Archived</p>
          <div
            class="space-y-2 opacity-65"
            style="mask-image: linear-gradient(to bottom, black 55%, transparent); -webkit-mask-image: linear-gradient(to bottom, black 55%, transparent)"
          >
            @for (task of archivedPreview(); track task.id) {
              <app-task-card [task]="task" [labels]="labels()" (view)="viewTask.emit($event)" />
            }
          </div>
        </div>
      }

      <app-add-task-form (addTask)="addTask.emit($event)" />
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

  protected readonly activeTasks = computed(() => this.list().tasks.filter((t) => !t.completedAt));
  protected readonly completedTasks = computed(() =>
    this.list().tasks.filter((t) => t.completedAt),
  );
}
