import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmCard, HlmCardContent } from '@spartan-ng/helm/card';

export type MetricTone = 'primary' | 'success' | 'warning' | 'destructive';

const TONE_CLASSES: Record<MetricTone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  destructive: 'bg-destructive/10 text-destructive',
};

@Component({
  selector: 'app-metric-card',
  imports: [HlmCard, HlmCardContent, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div hlmCard class="h-full overflow-hidden">
      <div hlmCardContent class="flex items-start justify-between gap-3 pt-1">
        <div class="min-w-0 flex-1">
          <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {{ label() }}
          </p>
          <p class="mt-1.5 text-3xl font-semibold tabular-nums">
            {{ value() }}
          </p>
          @if (hint(); as h) {
            <p class="text-muted-foreground mt-1 truncate text-xs">{{ h }}</p>
          }
        </div>
        <span
          class="flex size-11 shrink-0 items-center justify-center rounded-xl text-lg"
          [class]="toneClasses()"
        >
          <ng-icon [name]="icon()" />
        </span>
      </div>
    </div>
  `,
})
export class MetricCard {
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly icon = input.required<string>();
  readonly tone = input<MetricTone>('primary');
  readonly hint = input<string | null>(null);

  protected toneClasses(): string {
    return TONE_CLASSES[this.tone()];
  }
}
