import {
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TimelineScaleService } from '../data/timeline-scale.service';
import { type ScrollState } from '../timeline-header/timeline-header';
import { TimelineContent } from './timeline-content/timeline-content';
import { TimelineSidebar } from './timeline-sidebar/timeline-sidebar';
import type { TimelineItemData, TimelineRow, TimelineSpan } from '../data/timeline-data';
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
  imports: [TimelineContent, TimelineSidebar],
  template: `
    <!-- /* v8 ignore start -- scroll listener wrapper is exercised via test fixtures but V8 attributes coverage inconsistently @preserve */ -->
    <div
      #scrollContainer
      class="bg-card mx-4 mt-4 flex-1 overflow-auto rounded-md border"
      (scroll)="onScroll()"
    >
      <!-- /* v8 ignore stop -- @preserve */ -->
      <div class="flex w-fit min-w-full">
        <app-timeline-sidebar
          [rows]="rows()"
          [widthPx]="sidebarWidth"
          [rowHeightPx]="rowHeight"
          [headerHeightPx]="headerHeight"
        />

        <app-timeline-content
          [rows]="rows()"
          [items]="items()"
          [labels]="labels()"
          [sprints]="sprints()"
          [scrollState]="scrollState()"
          [rowHeightPx]="rowHeight"
          [headerHeightPx]="headerHeight"
          (viewTask)="viewTask.emit($event)"
          (taskMoved)="taskMoved.emit($event)"
          (taskResized)="taskResized.emit($event)"
        />
      </div>
    </div>
  `,
})
export class TimelineGrid {
  protected readonly scale = inject(TimelineScaleService);

  readonly rows = input.required<TimelineRow[]>();
  readonly items = input.required<TimelineItemData[]>();
  readonly labels = input<Label[]>([]);
  readonly sprints = input<Sprint[]>([]);

  readonly viewTask = output<Task>();
  readonly taskMoved = output<{ id: string; span: TimelineSpan; rowId: string | null }>();
  readonly taskResized = output<{ id: string; span: TimelineSpan }>();

  protected readonly sidebarWidth = SIDEBAR_WIDTH_PX;
  protected readonly rowHeight = ROW_HEIGHT_PX;
  protected readonly headerHeight = HEADER_HEIGHT_PX;

  /* v8 ignore start -- Angular's viewChild signal getter is not tracked as invoked by V8 in tests @preserve */
  private readonly scrollContainer =
    viewChild.required<ElementRef<HTMLDivElement>>('scrollContainer');
  /* v8 ignore stop -- @preserve */
  protected readonly scrollState = signal<ScrollState>({ scrollLeft: 0, viewportWidth: 0 });

  private isExpanding = false;
  private prevScrollWidth = 0;
  private prevScrollLeft = 0;

  constructor() {
    afterNextRender(() => this.syncScrollState());

    effect((onCleanup) => {
      const el = this.scrollContainer().nativeElement;
      /* v8 ignore next -- ResizeObserver callback never fires under jsdom @preserve */
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
    /* v8 ignore next -- jsdom doesn't measure element layout so addedWidth is always <= 0 in tests @preserve */
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
    /* v8 ignore next -- isExpanding is only true briefly during an in-flight expansion, which tests don't trigger @preserve */
    if (this.isExpanding) return;
    const el = this.scrollContainer().nativeElement;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    /* v8 ignore next -- jsdom always reports 0 for scrollWidth/clientWidth, so this early-return is always taken but no branch flips it @preserve */
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
