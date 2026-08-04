import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendarClock, lucideFlame } from '@ng-icons/lucide';
import {
  HlmCard,
  HlmCardContent,
  HlmCardDescription,
  HlmCardHeader,
  HlmCardTitle,
} from '@spartan-ng/helm/card';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
import { DashboardStore, type EnrichedTask } from '../data/dashboard.store';

type UrgentScope = 'all' | 'mine';

type UrgencyLabel = { text: string; overdue: boolean };

const MS_PER_DAY = 86_400_000;

function urgencyLabel(task: EnrichedTask, now: number): UrgencyLabel {
  const due = task.dueDate?.toDate?.().getTime() ?? 0;
  const diff = due - now;
  if (diff < -MS_PER_DAY) {
    const days = Math.floor(-diff / MS_PER_DAY);
    return { text: `${days}d overdue`, overdue: true };
  }
  if (diff < 0) return { text: 'Overdue today', overdue: true };
  if (diff < MS_PER_DAY) return { text: 'Due today', overdue: false };
  if (diff < 2 * MS_PER_DAY) return { text: 'Due tomorrow', overdue: false };
  const days = Math.ceil(diff / MS_PER_DAY);
  return { text: `Due in ${days}d`, overdue: false };
}

/**
 * Team-wide (and optionally self-only) list of tickets whose due date is either past
 * or lands within the store's urgent window, so the whole team can rally behind them.
 */
@Component({
  selector: 'app-urgent-tickets',
  imports: [
    HlmCard,
    HlmCardContent,
    HlmCardDescription,
    HlmCardHeader,
    HlmCardTitle,
    HlmToggleGroupImports,
    HlmBadge,
    NgIcon,
    UserAvatar,
  ],
  providers: [provideIcons({ lucideCalendarClock, lucideFlame })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div hlmCard class="h-full">
      <div hlmCardHeader>
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="bg-destructive/10 text-destructive flex size-8 items-center justify-center rounded-lg"
          >
            <ng-icon name="lucideFlame" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 hlmCardTitle>Urgent tickets</h2>
            <p hlmCardDescription>Overdue or due within 3 days — chase these first.</p>
          </div>
          <div
            hlmToggleGroup
            type="single"
            size="sm"
            [value]="scope()"
            (valueChange)="onScopeChange($event)"
            aria-label="Filter urgent tickets"
          >
            <button hlmToggleGroupItem value="all" aria-label="All urgent tickets">Team</button>
            <button hlmToggleGroupItem value="mine" aria-label="Only my urgent tickets">
              Mine
            </button>
          </div>
        </div>
      </div>
      <div hlmCardContent class="max-h-104 overflow-y-auto pt-0">
        @if (tickets().length === 0) {
          <div class="flex flex-col items-center gap-2 py-10 text-center">
            <span
              class="bg-emerald-500/10 text-emerald-600 flex size-10 items-center justify-center rounded-full dark:text-emerald-400"
            >
              <ng-icon name="lucideCalendarClock" />
            </span>
            <p class="text-sm font-medium">Nothing urgent right now</p>
            <p class="text-muted-foreground text-xs">
              @if (scope() === 'mine') {
                You're all clear. Take a breath.
              } @else {
                The team is on top of things.
              }
            </p>
          </div>
        } @else {
          <ul class="flex flex-col divide-y">
            @for (row of tickets(); track row.task.id) {
              <li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  class="mt-1 size-2 shrink-0 rounded-full"
                  [class.bg-destructive]="row.urgency.overdue"
                  [class.bg-amber-500]="!row.urgency.overdue"
                ></span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ row.task.title }}</p>
                  <div
                    class="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
                  >
                    <span class="truncate">{{ row.task.boardTitle }}</span>
                    <span aria-hidden="true">·</span>
                    <span class="truncate">{{ row.task.listTitle }}</span>
                  </div>
                </div>
                <div class="flex shrink-0 flex-col items-end gap-1.5">
                  <span hlmBadge [variant]="row.urgency.overdue ? 'destructive' : 'secondary'">
                    {{ row.urgency.text }}
                  </span>
                  @if (row.assignees.length > 0) {
                    <div class="flex items-center -space-x-2">
                      @for (assignee of row.assignees; track assignee.id) {
                        <app-user-avatar
                          class="ring-background rounded-full ring-2"
                          [name]="assignee.name"
                          [photoURL]="assignee.photoURL"
                          size="small"
                        />
                      }
                    </div>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class UrgentTickets {
  private readonly store = inject(DashboardStore);

  protected readonly scope = signal<UrgentScope>('all');

  private readonly source = computed(() =>
    this.scope() === 'mine' ? this.store.myUrgentTickets() : this.store.urgentTickets(),
  );

  protected readonly tickets = computed(() => {
    const now = Date.now();
    const resolve = this.store.userDisplay();
    return this.source()
      .slice(0, 10)
      .map((task) => ({
        task,
        urgency: urgencyLabel(task, now),
        assignees: (task.assignedTo ?? []).slice(0, 3).map(resolve),
      }));
  });

  protected onScopeChange(value: unknown): void {
    if (value === 'all' || value === 'mine') this.scope.set(value);
  }
}
