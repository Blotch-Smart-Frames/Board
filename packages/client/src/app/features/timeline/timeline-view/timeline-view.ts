import { Component, computed, inject, linkedSignal, viewChild } from '@angular/core';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { TimelineScaleService } from '../data/timeline-scale.service';
import {
  computeTimelineItems,
  computeTimelineRows,
  type TimelineSpan,
} from '../data/timeline-data';
import { TimelineGrid } from '../timeline-grid/timeline-grid';
import { TaskDetailDialog } from '../../board/task-detail/task-detail-dialog';
import { BoardStore } from '../../board/data/board.store';
import type { Task } from '../../../shared/types/board';

type MovedEvent = { id: string; span: TimelineSpan; rowId: string | null };
type ResizedEvent = { id: string; span: TimelineSpan };

/**
 * Top-level Gantt view, swapped in for KanbanBoard by BoardWorkspace's viewMode
 * toggle. Clicking a timeline bar opens the merged task detail/edit dialog —
 * same target as the Kanban card, since the merged dialog handles both viewing
 * and inline editing in one place.
 */
@Component({
  selector: 'app-timeline-view',
  providers: [TimelineScaleService],
  imports: [HlmAlert, HlmAlertDescription, HlmBadge, TimelineGrid, TaskDetailDialog],
  template: `
    <div class="flex h-full flex-col overflow-hidden">
      @if (rows().length === 0) {
        <div class="flex h-full items-center justify-center p-4">
          <p class="text-muted-foreground">
            No lists in this board. Add a list to start using the timeline.
          </p>
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
            [labels]="labels()"
            [sprints]="sprints()"
            (viewTask)="openDetail($event)"
            (taskMoved)="onTaskMoved($event)"
            (taskResized)="onTaskResized($event)"
          />
        }
      }
    </div>

    <app-task-detail-dialog #detailDialog />
  `,
})
export class TimelineView {
  protected readonly store = inject(BoardStore);

  private readonly detailDialog = viewChild.required<TaskDetailDialog>('detailDialog');

  protected readonly rows = computed(() => computeTimelineRows(this.store.lists() ?? []));
  /* v8 ignore start -- defensive: signals are seeded to arrays before render @preserve */
  private readonly rawItems = computed(() => computeTimelineItems(this.store.tasks() ?? []));
  protected readonly hiddenCount = computed(() => this.rawItems().hiddenCount);
  protected readonly labels = computed(() => this.store.labels() ?? []);
  protected readonly sprints = computed(() => this.store.sprints() ?? []);
  /* v8 ignore stop -- @preserve */

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
      // Either override is always set here (we early-returned on both empty above), so the short-circuits are unreachable.
      /* v8 ignore start -- @preserve */
      if (!span && !rowId) return item;
      return { ...item, ...(span && { span }), ...(rowId && { rowId }) };
      /* v8 ignore stop -- @preserve */
    });
  });

  protected openDetail(task: Task): void {
    this.detailDialog().open(task);
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
    await this.store.updateTask(id, {
      startDate: new Date(span.start),
      dueDate: new Date(span.end),
    });
  }
}
