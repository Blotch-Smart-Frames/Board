import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideActivity, lucideCirclePlus } from '@ng-icons/lucide';
import {
  HlmCard,
  HlmCardContent,
  HlmCardDescription,
  HlmCardHeader,
  HlmCardTitle,
} from '@spartan-ng/helm/card';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
import { DashboardStore } from '../data/dashboard.store';

function relativeTime(date: Date, now: number): string {
  const diff = now - date.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Vertical activity feed showing recent task creation events merged across every
 * board the user belongs to. Sourced from task doc timestamps rather than the
 * /history subcollections to keep read cost bounded.
 */
@Component({
  selector: 'app-activity-timeline',
  imports: [
    HlmCard,
    HlmCardContent,
    HlmCardDescription,
    HlmCardHeader,
    HlmCardTitle,
    NgIcon,
    UserAvatar,
  ],
  providers: [provideIcons({ lucideActivity, lucideCirclePlus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div hlmCard class="h-full">
      <div hlmCardHeader>
        <div class="flex items-center gap-2">
          <span
            class="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg"
          >
            <ng-icon name="lucideActivity" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 hlmCardTitle>Recent activity</h2>
            <p hlmCardDescription>Latest task activity from every board you belong to.</p>
          </div>
        </div>
      </div>
      <div hlmCardContent>
        @if (events().length === 0) {
          <p class="text-muted-foreground py-8 text-center text-sm">
            No activity yet — create a ticket to get things moving.
          </p>
        } @else {
          <ol class="relative flex flex-col gap-4 ps-8">
            <span aria-hidden="true" class="bg-border absolute inset-y-1 start-3.5 w-px"></span>
            @for (event of events(); track event.id) {
              <li class="relative flex items-start gap-3">
                <span
                  class="bg-primary text-primary-foreground ring-background absolute -start-8 top-0 flex size-7 items-center justify-center rounded-full ring-4"
                >
                  <ng-icon name="lucideCirclePlus" />
                </span>
                <div class="min-w-0 flex-1 pl-1">
                  <p class="text-sm">
                    <span class="font-medium">{{ event.actorName }}</span>
                    <span class="text-muted-foreground"> created </span>
                    <span class="font-medium">{{ event.title }}</span>
                  </p>
                  <p
                    class="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs"
                  >
                    <span>{{ event.boardTitle }}</span>
                    <span aria-hidden="true">·</span>
                    <span>{{ event.listTitle }}</span>
                    <span aria-hidden="true">·</span>
                    <span>{{ event.when }}</span>
                  </p>
                </div>
                <app-user-avatar
                  class="shrink-0"
                  [name]="event.actorName"
                  [photoURL]="event.actorPhoto"
                  size="small"
                />
              </li>
            }
          </ol>
        }
      </div>
    </div>
  `,
})
export class ActivityTimeline {
  private readonly store = inject(DashboardStore);

  protected readonly events = computed(() => {
    const now = Date.now();
    const resolve = this.store.userDisplay();
    return this.store.recentActivity().map((event) => {
      const actor = resolve(event.actorId);
      return {
        id: event.id,
        title: event.task.title,
        boardTitle: event.task.boardTitle,
        listTitle: event.task.listTitle,
        when: relativeTime(event.timestamp, now),
        actorName: actor.name,
        actorPhoto: actor.photoURL,
      };
    });
  });
}
