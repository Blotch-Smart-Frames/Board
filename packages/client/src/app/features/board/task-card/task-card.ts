import { Component, computed, inject, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar, lucidePaperclip, lucideMessageSquare } from '@ng-icons/lucide';
import { HlmCard } from '@spartan-ng/helm/card';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { LabelChip } from '../../../shared/components/label-chip/label-chip';
import { stripHtml } from '../../../shared/utils/html-text';
import { TaskAssignees } from '../task-assignees/task-assignees';
import { BoardStore } from '../data/board.store';
import type { Task, Label } from '../../../shared/types/board';

@Component({
  selector: 'app-task-card',
  imports: [NgIcon, HlmCard, HlmBadge, LabelChip, TaskAssignees],
  providers: [provideIcons({ lucideCalendar, lucidePaperclip, lucideMessageSquare })],
  host: { class: 'block' },
  template: `
    <div
      hlmCard
      class="hover:ring-primary/40 cursor-pointer gap-0 p-3 transition-shadow hover:shadow-md"
      [style.background-color]="task().color ? task().color + '15' : null"
      (click)="view.emit(task())"
      (keydown.enter)="view.emit(task())"
      tabindex="0"
      role="button"
      [attr.aria-label]="'Open task ' + task().title"
    >
      <div class="min-w-0">
        <h3 class="text-sm font-medium break-words">
          {{ task().title }}
        </h3>

        @if (descriptionPreview()) {
          <p class="text-muted-foreground mt-1 line-clamp-2 text-xs">
            {{ descriptionPreview() }}
          </p>
        }

        @if (taskLabels().length > 0) {
          <div class="mt-2 flex flex-wrap gap-1">
            @for (label of taskLabels(); track label.id) {
              <app-label-chip [label]="label" />
            }
          </div>
        }

        <div class="mt-2 flex flex-wrap items-center gap-2">
          @if (dueDateLabel(); as due) {
            <span hlmBadge variant="outline" [attr.data-synced]="task().calendarSyncEnabled">
              <ng-icon name="lucideCalendar" />
              {{ due }}
            </span>
          }

          <app-task-assignees [assignedUsers]="assignedUsers()" />

          @if (task().attachments?.length) {
            <span hlmBadge variant="outline">
              <ng-icon name="lucidePaperclip" />
              {{ task().attachments!.length }}
            </span>
          }

          @if (task().commentCount) {
            <span hlmBadge variant="outline">
              <ng-icon name="lucideMessageSquare" />
              {{ task().commentCount }}
            </span>
          }
        </div>
      </div>
    </div>
  `,
})
export class TaskCard {
  private readonly store = inject(BoardStore);

  readonly task = input.required<Task>();
  readonly labels = input<Label[]>([]);
  readonly view = output<Task>();

  protected readonly taskLabels = computed(() => {
    const ids = this.task().labelIds ?? [];
    return this.labels().filter((label) => ids.includes(label.id));
  });

  // Rich-text descriptions are stored as HTML; the card preview is plain text
  // with `line-clamp-2`, so strip tags/entities to a single readable line —
  // otherwise legacy plain-text descriptions still round-trip untouched.
  protected readonly descriptionPreview = computed(() => stripHtml(this.task().description));

  protected readonly assignedUsers = computed(() => {
    const ids = this.task().assignedTo ?? [];
    return this.store.collaborators().filter((c) => ids.includes(c.id));
  });

  protected readonly dueDateLabel = computed(() => {
    const dueDate = this.task().dueDate;
    if (!dueDate) return null;
    return dueDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
}
