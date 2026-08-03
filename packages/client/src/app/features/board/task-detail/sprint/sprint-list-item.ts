import { Component, computed, input, output } from '@angular/core';
import { format } from 'date-fns';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucidePencil, lucideTrash2 } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import type { Sprint } from '../../../../shared/types/board';

@Component({
  selector: 'app-sprint-list-item',
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({ lucideCheck, lucidePencil, lucideTrash2 })],
  template: `
    <div [class]="containerClass()">
      <button
        type="button"
        class="focus-visible:ring-ring flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md text-left transition-colors hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
        (click)="selectDates.emit()"
      >
        @if (highlighted()) {
          <span
            class="flex size-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-white"
            aria-hidden="true"
            data-testid="sprint-overlap-indicator"
          >
            <ng-icon name="lucideCheck" class="text-xs" />
          </span>
        }
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">{{ sprint().name }}</p>
          <p class="text-muted-foreground text-xs">{{ formattedDates() }}</p>
        </div>
      </button>
      <span class="flex shrink-0 gap-1">
        <button hlmBtn variant="ghost" size="icon" aria-label="Edit sprint" (click)="edit.emit()">
          <ng-icon name="lucidePencil" />
        </button>
        <button
          hlmBtn
          variant="ghost"
          size="icon"
          aria-label="Delete sprint"
          [disabled]="deleting()"
          (click)="remove.emit()"
        >
          <ng-icon name="lucideTrash2" />
        </button>
      </span>
    </div>
  `,
})
export class SprintListItem {
  readonly sprint = input.required<Sprint>();
  readonly deleting = input(false);
  readonly highlighted = input(false);
  readonly edit = output<void>();
  readonly remove = output<void>();
  readonly selectDates = output<void>();

  protected readonly formattedDates = computed(() => {
    const s = this.sprint();
    return `${format(s.startDate.toDate(), 'MMM d, yyyy')} - ${format(s.endDate.toDate(), 'MMM d, yyyy')}`;
  });

  protected readonly containerClass = computed(() => {
    const base = 'flex items-center justify-between gap-2 rounded-md border p-2 transition-colors';
    return this.highlighted()
      ? `${base} border-green-500 bg-green-500/10`
      : `${base} bg-background`;
  });
}
