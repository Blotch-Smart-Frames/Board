import { Component, computed, input, output } from '@angular/core';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
import type { Collaborator } from '../../../shared/types/board';

@Component({
  selector: 'app-assignee-picker',
  imports: [HlmCheckbox, UserAvatar],
  template: `
    @if (collaborators().length > 0) {
      <div class="flex flex-col gap-1">
        @for (collaborator of sorted(); track collaborator.id) {
          <button
            type="button"
            class="hover:bg-accent flex items-center gap-2 rounded px-1 py-1 text-left transition-opacity"
            [class.opacity-60]="!isSelected(collaborator.id)"
            (click)="toggle(collaborator.id)"
          >
            <hlm-checkbox
              [checked]="isSelected(collaborator.id)"
              class="pointer-events-none"
              [aria-label]="'Assign ' + collaborator.name"
            />
            <app-user-avatar
              [name]="collaborator.name"
              [photoURL]="collaborator.photoURL"
              size="small"
              [showTooltip]="false"
            />
            <span class="text-sm">{{ collaborator.name }}</span>
          </button>
        }
      </div>
    }
  `,
})
export class AssigneePicker {
  readonly collaborators = input.required<Collaborator[]>();
  readonly selectedUserIds = input<string[]>([]);
  readonly selectedUserIdsChange = output<string[]>();

  protected readonly sorted = computed(() =>
    [...this.collaborators()].sort((a, b) => {
      // V8's sort may invoke this comparator with (a,b) in either order for a
      // given pair, so only one of the ternary branches is deterministically hit.
      /* v8 ignore next -- @preserve */
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      return a.name.localeCompare(b.name);
    }),
  );

  protected isSelected(userId: string): boolean {
    return this.selectedUserIds().includes(userId);
  }

  protected toggle(userId: string): void {
    const current = this.selectedUserIds();
    this.selectedUserIdsChange.emit(
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }
}
