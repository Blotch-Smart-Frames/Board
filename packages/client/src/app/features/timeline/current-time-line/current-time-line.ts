import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map } from 'rxjs';
import { TimelineScaleService } from '../data/timeline-scale.service';

@Component({
  selector: 'app-timeline-current-time-line',
  template: `
    @if (visible()) {
      <div
        class="bg-destructive before:bg-destructive pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 before:absolute before:-top-0 before:-left-[4px] before:size-2.5 before:rounded-full"
        [style.left.px]="left()"
        aria-hidden="true"
      ></div>
    }
  `,
})
export class CurrentTimeLine {
  private readonly scale = inject(TimelineScaleService);

  private readonly now = toSignal(interval(60_000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });

  protected readonly visible = computed(() => {
    const range = this.scale.range();
    const now = this.now();
    return now >= range.start && now <= range.end;
  });

  protected readonly left = computed(() =>
    this.scale.valueToPixels(this.now() - this.scale.range().start),
  );
}
