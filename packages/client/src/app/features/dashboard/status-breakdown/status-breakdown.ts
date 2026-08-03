import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLayoutList } from '@ng-icons/lucide';
import {
  HlmCard,
  HlmCardContent,
  HlmCardDescription,
  HlmCardHeader,
  HlmCardTitle,
} from '@spartan-ng/helm/card';
import { DashboardStore } from '../data/dashboard.store';

/**
 * Renders one row per list status across every board the user belongs to, with a
 * horizontal bar showing what proportion of that status's tickets are assigned
 * to the current user vs. the whole team.
 */
@Component({
  selector: 'app-status-breakdown',
  imports: [HlmCard, HlmCardContent, HlmCardDescription, HlmCardHeader, HlmCardTitle, NgIcon],
  providers: [provideIcons({ lucideLayoutList })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div hlmCard class="h-full">
      <div hlmCardHeader>
        <div class="flex items-center gap-2">
          <span
            class="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg"
          >
            <ng-icon name="lucideLayoutList" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 hlmCardTitle>Tickets by status</h2>
            <p hlmCardDescription>Your share of the workload per column, across all boards.</p>
          </div>
        </div>
      </div>
      <div hlmCardContent class="flex flex-col gap-4">
        @if (rows().length === 0) {
          <p class="text-muted-foreground py-8 text-center text-sm">
            No tickets on any of your boards yet.
          </p>
        } @else {
          @for (row of rows(); track row.title) {
            <div class="flex flex-col gap-1.5">
              <div class="flex items-baseline justify-between gap-2">
                <span class="truncate text-sm font-medium">{{ row.title }}</span>
                <span class="text-muted-foreground shrink-0 text-xs tabular-nums">
                  <span class="text-foreground font-medium">{{ row.mine }}</span>
                  / {{ row.total }}
                </span>
              </div>
              <div class="bg-muted relative h-2 overflow-hidden rounded-full">
                <div
                  class="from-primary to-primary/70 absolute inset-y-0 start-0 rounded-full bg-linear-to-r transition-[width] duration-500"
                  [style.width.%]="row.share"
                  [attr.aria-label]="row.mine + ' of ' + row.total + ' assigned to you'"
                ></div>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class StatusBreakdown {
  private readonly store = inject(DashboardStore);
  protected readonly rows = computed(() => this.store.statusBreakdown());
}
