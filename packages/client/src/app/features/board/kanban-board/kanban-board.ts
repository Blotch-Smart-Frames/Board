import { Component, computed, inject, viewChild } from '@angular/core';
import { CdkDropList, CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKanbanSquare } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmScrollAreaImports } from '@spartan-ng/helm/scroll-area';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { NgScrollbar } from 'ngx-scrollbar';
import { BoardBackground } from '../board-background/board-background';
import { ListColumn } from '../list-column/list-column';
import { AddListButton } from '../add-list-button/add-list-button';
import { TaskDetailDialog } from '../task-detail/task-detail-dialog';
import { LabelFilter } from '../label-filter/label-filter';
import { AssigneeFilter } from '../assignee-filter/assignee-filter';
import { BoardStore } from '../data/board.store';
import { isTouchOrMobileSignal } from '../../../core/interop/breakpoint-signal';
import { celebrateAt } from '../../../shared/utils/confetti';
import type { Task } from '../../../shared/types/board';

// WheelEvent.deltaMode units. Pixels are the default, but some browsers
// (notably Firefox with a physical mouse) report scroll amounts in lines/pages.
const WHEEL_DELTA_LINE = 1;
const WHEEL_DELTA_PAGE = 2;
// Rough px-per-line used to normalise line-mode wheel deltas into pixels.
const LINE_HEIGHT_PX = 16;

@Component({
  selector: 'app-kanban-board',
  imports: [
    CdkDropList,
    CdkDrag,
    NgIcon,
    HlmButton,
    HlmEmptyImports,
    HlmScrollAreaImports,
    HlmSpinner,
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

      <ng-scrollbar
        #boardScrollbar
        hlm
        class="min-h-0 flex-1"
        appearance="compact"
        orientation="horizontal"
        (wheel)="onWheel($event)"
      >
        <div class="h-full p-4">
          @if (store.isLoadingLists()) {
            <div class="flex h-full items-center justify-center">
              <hlm-spinner />
            </div>
          } @else if (store.listsWithTasks().length === 0) {
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
                      [isArchival]="store.archivalListIds().includes(list.id)"
                      [archivedPreview]="archivedPreviewFor(list.id)"
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
  private readonly boardScrollbar = viewChild.required<NgScrollbar>('boardScrollbar');

  // Suppress drag-and-drop on mobile viewports and touch-primary devices where
  // CDK drag intercepts native touch scrolling of the board.
  protected readonly dragDisabled = isTouchOrMobileSignal();

  protected readonly listIds = computed(() => this.store.listsWithTasks().map((l) => l.id));
  /* v8 ignore next -- defensive: labels() is seeded to an array before this template reads it @preserve */
  protected readonly labels = computed(() => this.store.labels() ?? []);

  protected archivedPreviewFor(listId: string): Task[] {
    return this.store.archivedPreviewByListId().get(listId) ?? [];
  }

  protected openDetail(task: Task): void {
    this.detailDialog().open(task);
  }

  /**
   * Pan the board horizontally with a plain vertical mouse wheel — the board
   * only scrolls on its x-axis, so a normal wheel would otherwise do nothing.
   *
   * Nested vertical scrolling still takes priority: while the pointer is over a
   * vertically-scrollable list we leave the event alone and let the browser
   * scroll that list (Trello-style). Crucially, a scrollable list keeps owning
   * the wheel even once it hits its top/bottom edge — we don't translate the
   * leftover scroll into horizontal panning, so reaching the end of a list no
   * longer "hijacks" the wheel and jerks the board sideways.
   */
  protected onWheel(event: WheelEvent): void {
    // Horizontal-dominant input (trackpad swipe, Shift+wheel) already scrolls
    // the viewport on its x-axis natively — don't double-apply it.
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

    const viewport = this.boardScrollbar().adapter.viewportElement;

    // Defer to an inner vertically-scrollable list — even at its edge.
    if (this.consumedByInnerList(event.target, viewport)) return;

    // Nothing to pan if every list fits within the viewport width.
    if (viewport.scrollWidth <= viewport.clientWidth) return;

    viewport.scrollLeft += this.wheelDeltaToPixels(event, viewport.clientWidth);
    event.preventDefault();
  }

  /**
   * Walk up from the wheel target to the board viewport, returning true if any
   * ancestor is a vertically-scrollable list — i.e. that element should own the
   * wheel instead of the board. We deliberately ignore whether the list is at
   * its scroll edge: a list that owns the wheel keeps it there, so scrolling
   * past the top or bottom never leaks into horizontal panning of the board.
   */
  private consumedByInnerList(target: EventTarget | null, viewport: HTMLElement): boolean {
    // Start from any Element (SVG icons are SVGElement, not HTMLElement) so the
    // walk still finds a scrollable ancestor when the pointer is over an icon.
    let el: Element | null = target instanceof Element ? target : null;
    while (el && el !== viewport) {
      const overflowY = getComputedStyle(el).overflowY;
      const scrolls = overflowY === 'auto' || overflowY === 'scroll';
      if (scrolls && el.scrollHeight > el.clientHeight) return true;
      el = el.parentElement;
    }
    return false;
  }

  /** Normalise a wheel delta to pixels, accounting for line/page delta modes. */
  private wheelDeltaToPixels(event: WheelEvent, pageSize: number): number {
    if (event.deltaMode === WHEEL_DELTA_LINE) return event.deltaY * LINE_HEIGHT_PX;
    if (event.deltaMode === WHEEL_DELTA_PAGE) return event.deltaY * pageSize;
    return event.deltaY;
  }

  protected onTaskDrop(event: CdkDragDrop<Task[]>): void {
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }
    const task = event.item.data as Task;
    if (this.entersArchive(event.previousContainer.id, event.container.id)) {
      /* v8 ignore next -- fire-and-forget celebration; failure shouldn't block the move @preserve */
      celebrateAt(event.dropPoint).catch(() => {});
    }
    this.store.moveTaskToIndex(task.id, event.container.id, event.currentIndex);
  }

  /** True when a task moves from a non-archival list into an archival one — the actual "archive" transition. */
  private entersArchive(fromListId: string, toListId: string): boolean {
    const archivalListIds = this.store.archivalListIds();
    return archivalListIds.includes(toListId) && !archivalListIds.includes(fromListId);
  }

  protected onListDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    const listId = event.item.data as string;
    this.store.reorderListToIndex(listId, event.currentIndex);
  }
}
