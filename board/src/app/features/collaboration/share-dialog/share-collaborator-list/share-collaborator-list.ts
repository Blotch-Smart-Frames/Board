import { Component, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar';
import type { Collaborator } from '../../../../shared/types/board';

/**
 * Renders the collaborators list. Removal is delegated back to the parent
 * via `removeHandler` (matching the invite-form pattern) so the parent
 * dialog owns the surrounding error banner; the child only owns the
 * transient per-row spinner. Errors thrown by the handler are re-emitted
 * so the parent can display them.
 */
@Component({
  selector: 'app-share-collaborator-list',
  imports: [HlmButton, HlmBadge, HlmSpinner, NgIcon, UserAvatar],
  providers: [provideIcons({ lucideTrash2 })],
  template: `
    <div>
      <p class="text-muted-foreground mb-2 text-sm font-medium">People with access</p>
      <ul class="flex flex-col gap-2">
        @for (person of collaborators(); track person.id) {
          <li class="flex items-center gap-3">
            <app-user-avatar
              [name]="person.name"
              [photoURL]="person.photoURL"
              size="medium"
              [showTooltip]="false"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-medium">{{ person.name }}</span>
                @if (person.isOwner) {
                  <span hlmBadge>Owner</span>
                }
              </div>
              <p class="text-muted-foreground truncate text-xs">{{ person.email }}</p>
            </div>
            @if (!person.isOwner) {
              <button
                hlmBtn
                variant="ghost"
                size="icon"
                type="button"
                [attr.aria-label]="'Remove ' + person.name"
                [disabled]="removingId() === person.id"
                (click)="onRemove(person.id)"
              >
                @if (removingId() === person.id) {
                  <hlm-spinner class="size-4" />
                } @else {
                  <ng-icon name="lucideTrash2" />
                }
              </button>
            }
          </li>
        }
      </ul>
    </div>
  `,
})
export class ShareCollaboratorList {
  readonly collaborators = input.required<Collaborator[]>();
  readonly removeHandler = input.required<(userId: string) => Promise<void>>();
  readonly error = output<string>();

  protected readonly removingId = signal<string | null>(null);

  protected async onRemove(userId: string): Promise<void> {
    this.removingId.set(userId);
    try {
      await this.removeHandler()(userId);
    } catch (err) {
      this.error.emit(err instanceof Error ? err.message : 'Failed to remove collaborator');
    } finally {
      this.removingId.set(null);
    }
  }
}
