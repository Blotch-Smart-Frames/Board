import { Component, computed, input } from '@angular/core';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
import type { Collaborator } from '../../../shared/types/board';

const MAX_VISIBLE = 3;

@Component({
  selector: 'app-task-assignees',
  imports: [UserAvatar],
  template: `
    @if (assignedUsers().length > 0) {
      <div class="flex items-center -space-x-2">
        @for (user of visible(); track user.id) {
          <app-user-avatar
            class="ring-background rounded-full ring-2"
            [name]="user.name"
            [photoURL]="user.photoURL"
            size="small"
          />
        }
        @if (overflow() > 0) {
          <span
            class="bg-muted text-muted-foreground ring-background flex size-6 items-center justify-center rounded-full text-[10px] font-medium ring-2"
            [attr.aria-label]="overflow() + ' more assignees'"
          >
            +{{ overflow() }}
          </span>
        }
      </div>
    }
  `,
})
export class TaskAssignees {
  readonly assignedUsers = input.required<Collaborator[]>();

  protected readonly visible = computed(() => this.assignedUsers().slice(0, MAX_VISIBLE));
  protected readonly overflow = computed(() =>
    Math.max(0, this.assignedUsers().length - MAX_VISIBLE),
  );
}
