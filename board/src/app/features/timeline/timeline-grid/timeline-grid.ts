import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TimelineScaleService } from '../data/timeline-scale.service';
import { TimelineHeader, type ScrollState } from '../timeline-header/timeline-header';
import { TimelineRow } from '../timeline-row/timeline-row';
import { TimelineItem } from '../timeline-item/timeline-item';
import { CurrentTimeLine } from '../current-time-line/current-time-line';
import { SprintOverlays } from '../sprint-overlays/sprint-overlays';
import type {
  TimelineItemData,
  TimelineRow as TimelineRowData,
  TimelineSpan,
} from '../data/timeline-data';
import type { Label, Sprint, Task } from '../../../shared/types/board';

const ROW_HEIGHT_PX = 48;
const HEADER_HEIGHT_PX = 40;
const SIDEBAR_WIDTH_PX = 200;
const EDGE_THRESHOLD_PX = 200;

/**
 * The scrollable grid: a fixed row-title sidebar plus the (much wider) time
 * axis, with near-edge scroll detection that grows the visible date range.
 * Scrolling the sidebar out of view on horizontal scroll matches source's own
 * layout (its row-label column is a plain flex sibling inside the same
 * scrollable element, not sticky) rather than being an oversight here.
 */
@Component({
  selector: 'app-timeline-grid',
  imports: [TimelineHeader, TimelineRow, TimelineItem, CurrentTimeLine, SprintOverlays],
  template: `
    <div
      #scrollContainer
      class="bg-card mx-4 mt-4 flex-1 overflow-auto rounded-md border"
      (scroll)="onScroll()"
    >
      <div class="flex w-fit min-w-full">
        <div class="shrink-0" [style.width.px]="sidebarWidth">
          <div
            class="bg-muted flex items-center border-e border-b px-4"
            [style.height.px]="headerHeight"
          >
            <span class="text-sm font-semibold">Lists</span>
          </div>
          @for (row of rows(); track row.id) {
            <div
              class="border-border flex items-center border-e border-b px-4"
              [style.height.px]="rowHeight"
            >
              <span class="truncate text-sm font-medium">{{ row.title }}</span>
            </div>
          }
        </div>

        <div class="relative flex-1" [style.width.px]="scale.totalWidthPx()">
          <app-sprint-overlays
            [sprints]="sprints()"
            [rowCount]="rows().length"
            [rowHeightPx]="rowHeight"
            [headerHeightPx]="headerHeight"
          />
          <app-timeline-current-time-line />

          <div class="bg-muted border-border border-b-2" [style.height.px]="headerHeight">
            <app-timeline-header [scrollState]="scrollState()" />
          </div>

          @for (row of rows(); track row.id) {
            <app-timeline-row [row]="row">
              @for (item of itemsByRow().get(row.id) ?? []; track item.id) {
                <app-timeline-item
                  [item]="item"
                  [labels]="labels()"
                  (view)="viewTask.emit($event)"
                  (moved)="taskMoved.emit({ id: item.id, span: $event.span, rowId: $event.rowId })"
                  (resized)="taskResized.emit({ id: item.id, span: $event })"
                />
              }
            </app-timeline-row>
          }
        </div>
      </div>
    </div>
  `,
})
export class TimelineGrid {
  protected readonly scale = inject(TimelineScaleService);

  readonly rows = input.required<TimelineRowData[]>();
  readonly items = input.required<TimelineItemData[]>();
  readonly labels = input<Label[]>([]);
  readonly sprints = input<Sprint[]>([]);

  readonly viewTask = output<Task>();
  readonly taskMoved = output<{ id: string; span: TimelineSpan; rowId: string | null }>();
  readonly taskResized = output<{ id: string; span: TimelineSpan }>();

  protected readonly sidebarWidth = SIDEBAR_WIDTH_PX;
  protected readonly rowHeight = ROW_HEIGHT_PX;
  protected readonly headerHeight = HEADER_HEIGHT_PX;

  protected readonly itemsByRow = computed(() => {
    const map = new Map<string, TimelineItemData[]>();
    for (const item of this.items()) {
      const list = map.get(item.rowId) ?? [];
      list.push(item);
      map.set(item.rowId, list);
    }
    return map;
  });

  private readonly scrollContainer =
    viewChild.required<ElementRef<HTMLDivElement>>('scrollContainer');
  protected readonly scrollState = signal<ScrollState>({ scrollLeft: 0, viewportWidth: 0 });

  private isExpanding = false;
  private prevScrollWidth = 0;
  private prevScrollLeft = 0;

  constructor() {
    afterNextRender(() => this.syncScrollState());

    effect((onCleanup) => {
      const el = this.scrollContainer().nativeElement;
      const observer = new ResizeObserver(() => this.syncScrollState());
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });

    // Preserve the user's visual scroll position when a past-expansion
    // prepends days (which otherwise shifts everything to the right). The
    // scrollWidth compensation is deferred with queueMicrotask because the
    // freshly added day cells only inflate scrollWidth once the template has
    // re-rendered — reading it synchronously in the effect would see the old
    // value and no-op. queueMicrotask (rather than afterNextRender) is used
    // because it interleaves cleanly with the test harness's whenStable /
    // detectChanges cycle without requiring a rAF flush.
    let prevRangeStart = this.scale.range().start;
    effect(() => {
      const rangeStart = this.scale.range().start;
      const changed = rangeStart !== prevRangeStart;
      prevRangeStart = rangeStart;
      if (!changed || !this.isExpanding) return;

      queueMicrotask(() => this.compensateScrollAfterExpansion());
    });
  }

  private compensateScrollAfterExpansion(): void {
    const el = this.scrollContainer().nativeElement;
    const addedWidth = el.scrollWidth - this.prevScrollWidth;
    if (addedWidth > 0) el.scrollLeft = this.prevScrollLeft + addedWidth;
    this.isExpanding = false;
  }

  protected onScroll(): void {
    this.syncScrollState();
    this.maybeExpand();
  }

  private syncScrollState(): void {
    const el = this.scrollContainer().nativeElement;
    this.scrollState.set({ scrollLeft: el.scrollLeft, viewportWidth: el.clientWidth });
  }

  private maybeExpand(): void {
    if (this.isExpanding) return;
    const el = this.scrollContainer().nativeElement;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    if (scrollWidth <= clientWidth) return;

    const distanceFromLeft = scrollLeft;
    const distanceFromRight = scrollWidth - scrollLeft - clientWidth;

    if (distanceFromLeft < EDGE_THRESHOLD_PX && distanceFromLeft > 0) {
      this.isExpanding = true;
      this.prevScrollWidth = scrollWidth;
      this.prevScrollLeft = scrollLeft;
      this.scale.expandPast();
    } else if (distanceFromRight < EDGE_THRESHOLD_PX) {
      this.isExpanding = true;
      this.scale.expandFuture();
    }
  }
}
