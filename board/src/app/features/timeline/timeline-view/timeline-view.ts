import { Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { TimelineScaleService } from '../data/timeline-scale.service';
import { computeTimelineItems, computeTimelineRows, type TimelineSpan } from '../data/timeline-data';
import { TimelineGrid } from '../timeline-grid/timeline-grid';
import { TaskDialog } from '../../board/task-dialog/task-dialog';
import { BoardStore } from '../../board/data/board.store';
import type { Task, UpdateTaskInput } from '../../../shared/types/board';

type MovedEvent = { id: string; span: TimelineSpan; rowId: string | null };
type ResizedEvent = { id: string; span: TimelineSpan };

/**
 * Top-level Gantt view, swapped in for KanbanBoard by BoardWorkspace's viewMode
 * toggle. Owns its own TaskDialog (source wires the timeline bar's click
 * straight to edit, unlike the Kanban card's click-to-detail-view-first flow —
 * that's an intentional source difference between the two views, not an
 * inconsistency introduced here).
 */
@Component({
  selector: 'app-timeline-view',
  providers: [TimelineScaleService],
  imports: [HlmAlert, HlmAlertDescription, HlmBadge, TimelineGrid, TaskDialog],
  template: `
    <div class="flex h-full flex-col overflow-hidden">
      @if (rows().length === 0) {
        <div class="flex h-full items-center justify-center p-4">
          <p class="text-muted-foreground">No lists in this board. Add a list to start using the timeline.</p>
        </div>
      } @else {
        @if (hiddenCount() > 0) {
          <div hlmAlert class="mx-4 mt-4 mb-0">
            <p hlmAlertDescription class="flex flex-wrap items-center gap-2">
              <span>{{ hiddenCount() }} task{{ hiddenCount() === 1 ? '' : 's' }} hidden.</span>
              <span hlmBadge variant="outline">Tasks need both start and due dates to appear</span>
            </p>
          </div>
        }

        @if (items().length === 0) {
          <div class="flex h-full items-center justify-center p-4">
            <p class="text-muted-foreground">
              @if (hiddenCount() > 0) {
                Set start and due dates on tasks to see them in the timeline.
              } @else {
                No tasks in this board yet.
              }
            </p>
          </div>
        } @else {
          <app-timeline-grid
            [rows]="rows()"
            [items]="items()"
            [labels]="store.labels() ?? []"
            [sprints]="store.sprints() ?? []"
            (viewTask)="openEdit($event)"
            (taskMoved)="onTaskMoved($event)"
            (taskResized)="onTaskResized($event)"
          />
        }
      }
    </div>

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
  `,
})
export class TimelineView {
  protected readonly store = inject(BoardStore);

  private readonly taskDialog = viewChild.required<TaskDialog>('taskDialog');
  private readonly editingTask = signal<Task | null>(null);

  protected readonly rows = computed(() => computeTimelineRows(this.store.lists() ?? []));
  private readonly rawItems = computed(() => computeTimelineItems(this.store.tasks() ?? []));
  protected readonly hiddenCount = computed(() => this.rawItems().hiddenCount);

  // Optimistic overrides on top of the live Firestore data, kept separate from
  // BoardStore's own Kanban-facing overrides since this view reads store.tasks()
  // directly rather than the pre-grouped listsWithTasks(). Same auto-clear-on-
  // server-echo linkedSignal pattern used everywhere else in the port.
  private readonly spanOverrides = linkedSignal<Task[] | undefined, Map<string, TimelineSpan>>({
    source: this.store.tasks,
    computation: () => new Map(),
  });
  private readonly rowOverrides = linkedSignal<Task[] | undefined, Map<string, string>>({
    source: this.store.tasks,
    computation: () => new Map(),
  });

  protected readonly items = computed(() => {
    const serverItems = this.rawItems().items;
    const spanOverrides = this.spanOverrides();
    const rowOverrides = this.rowOverrides();
    if (spanOverrides.size === 0 && rowOverrides.size === 0) return serverItems;

    return serverItems.map((item) => {
      const span = spanOverrides.get(item.id);
      const rowId = rowOverrides.get(item.id);
      if (!span && !rowId) return item;
      return { ...item, ...(span && { span }), ...(rowId && { rowId }) };
    });
  });

  protected readonly saveHandler = async (data: UpdateTaskInput): Promise<void> => {
    const task = this.editingTask();
    if (task) await this.store.updateTask(task.id, data);
  };

  protected readonly deleteHandler = async (): Promise<void> => {
    const task = this.editingTask();
    if (task) await this.store.deleteTask(task.id);
  };

  protected openEdit(task: Task): void {
    this.editingTask.set(task);
    this.taskDialog().open(task);
  }

  protected onTaskMoved({ id, span, rowId }: MovedEvent): void {
    this.spanOverrides.update((m) => new Map(m).set(id, span));
    if (rowId) {
      this.rowOverrides.update((m) => new Map(m).set(id, rowId));
      this.persistMove(id, rowId, span);
    } else {
      this.store.updateTask(id, { startDate: new Date(span.start), dueDate: new Date(span.end) });
    }
  }

  protected onTaskResized({ id, span }: ResizedEvent): void {
    this.spanOverrides.update((m) => new Map(m).set(id, span));
    this.store.updateTask(id, { startDate: new Date(span.start), dueDate: new Date(span.end) });
  }

  /** List-move then date-update, sequential — matches source, avoids a write race. */
  private async persistMove(id: string, rowId: string, span: TimelineSpan): Promise<void> {
    await this.store.moveTaskToList(id, rowId);
    await this.store.updateTask(id, { startDate: new Date(span.start), dueDate: new Date(span.end) });
  }
}
