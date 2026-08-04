import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCircleCheckBig, lucideCircleDot, lucideFlame, lucideTicket } from '@ng-icons/lucide';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { AuthStore } from '../../core/auth/auth.store';
import { UserAvatar } from '../../shared/components/user-avatar/user-avatar';
import { ActivityTimeline } from './activity-timeline/activity-timeline';
import { DashboardStore } from './data/dashboard.store';
import { MetricCard } from './metric-card/metric-card';
import { StatusBreakdown } from './status-breakdown/status-breakdown';
import { UrgentTickets } from './urgent-tickets/urgent-tickets';

// NgIcon isn't listed in imports because the metric icons are passed by name to <app-metric-card>,
// which owns the NgIcon rendering. provideIcons here just registers them for those children.

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

@Component({
  selector: 'app-dashboard-page',
  imports: [HlmSpinner, MetricCard, StatusBreakdown, UrgentTickets, ActivityTimeline, UserAvatar],
  providers: [
    DashboardStore,
    provideIcons({ lucideCircleCheckBig, lucideCircleDot, lucideFlame, lucideTicket }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full overflow-y-auto">
      <div class="mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <!-- Hero header -->
        <header
          class="from-primary/10 via-primary/5 relative overflow-hidden rounded-2xl border bg-linear-to-br to-transparent p-6"
        >
          <div class="flex flex-wrap items-center gap-4">
            <app-user-avatar
              [name]="userName()"
              [photoURL]="userPhoto()"
              size="large"
              [showTooltip]="false"
            />
            <div class="min-w-0 flex-1">
              <p class="text-muted-foreground text-sm font-medium">
                {{ greeting() }}
              </p>
              <h1 class="mt-0.5 truncate text-2xl font-semibold sm:text-3xl">
                {{ firstName() }}
              </h1>
              <p class="text-muted-foreground mt-1 text-sm">
                Here's what's happening across
                <span class="text-foreground font-medium">{{ boardCount() }}</span>
                {{ boardCount() === 1 ? 'board' : 'boards' }}.
              </p>
            </div>
          </div>
        </header>

        @if (isLoading()) {
          <div class="flex items-center justify-center py-16">
            <hlm-spinner />
          </div>
        } @else {
          <!-- Metric grid -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <app-metric-card
              label="Total tickets"
              [value]="store.totalCount()"
              icon="lucideTicket"
              tone="primary"
              [hint]="totalHint()"
            />
            <app-metric-card
              label="Open"
              [value]="store.openCount()"
              icon="lucideCircleDot"
              tone="warning"
              hint="In progress or waiting"
            />
            <app-metric-card
              label="Answered"
              [value]="store.answeredCount()"
              icon="lucideCircleCheckBig"
              tone="success"
              hint="Completed by you"
            />
            <app-metric-card
              label="Urgent"
              [value]="store.urgentCount()"
              icon="lucideFlame"
              tone="destructive"
              hint="Overdue or due soon"
            />
          </div>

          <!-- Breakdown + Urgent -->
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <app-status-breakdown />
            <app-urgent-tickets />
          </div>

          <!-- Activity timeline -->
          <app-activity-timeline />
        }
      </div>
    </section>
  `,
})
export class DashboardPage {
  private readonly authStore = inject(AuthStore);
  protected readonly store = inject(DashboardStore);

  protected readonly greeting = computed(() => greeting(new Date()));
  protected readonly userName = computed(() => {
    const user = this.authStore.user();
    return user?.displayName || user?.email || 'there';
  });
  protected readonly firstName = computed(() => {
    const name = this.userName();
    return name.split(/[ @]/)[0] || name;
  });
  protected readonly userPhoto = computed(() => this.authStore.user()?.photoURL ?? null);
  protected readonly boardCount = computed(() => this.store.boards().length);
  protected readonly isLoading = computed(() => this.store.isLoadingBoards());
  protected readonly totalHint = computed(() => {
    const open = this.store.openCount();
    return `${open} still open`;
  });
}
