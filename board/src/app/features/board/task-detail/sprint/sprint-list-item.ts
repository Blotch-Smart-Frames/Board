import { Component, computed, input, output } from '@angular/core';
import { format } from 'date-fns';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucideTrash2 } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import type { Sprint } from '../../../../shared/types/board';

@Component({
  selector: 'app-sprint-list-item',
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({ lucidePencil, lucideTrash2 })],
  template: `
    <div class="flex items-center justify-between gap-2 rounded-md border p-2 bg-background">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium">{{ sprint().name }}</p>
        <p class="text-muted-foreground text-xs">{{ formattedDates() }}</p>
      </div>
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
  readonly edit = output<void>();
  readonly remove = output<void>();

  protected readonly formattedDates = computed(() => {
    const s = this.sprint();
    return `${format(s.startDate.toDate(), 'MMM d, yyyy')} - ${format(s.endDate.toDate(), 'MMM d, yyyy')}`;
  });
}
