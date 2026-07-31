import { Component, inject, input, signal, viewChild } from '@angular/core';
import { form, submit, required, email as emailValidator, FormField } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUserPlus, lucideTrash2, lucideCopy } from '@ng-icons/lucide';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
import { BoardService } from '../../../core/services/board.service';
import { UserService } from '../../../core/services/user.service';
import type { Collaborator } from '../../../shared/types/board';

/**
 * Invite-by-email + collaborator list. Imperatively opened via `open()`,
 * following the same viewChild(HlmDialog)/saveHandler pattern as
 * board-form-dialog and task-dialog. Inject BoardService/UserService directly
 * (rather than routing the invite through the parent) since the flow is
 * self-contained: getUserByEmail → shareBoard → clear the field. The transient
 * success banner uses a plain setTimeout for the 3s auto-dismiss; that's fine
 * for a one-off UI toast and doesn't need signal-interop machinery.
 */
@Component({
  selector: 'app-share-dialog',
  imports: [
    HlmDialogImports,
    HlmButton,
    HlmInput,
    HlmSpinner,
    HlmBadge,
    HlmAlert,
    HlmAlertDescription,
    UserAvatar,
    NgIcon,
    FormField,
  ],
  providers: [provideIcons({ lucideUserPlus, lucideTrash2, lucideCopy })],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content *hlmDialogPortal class="sm:max-w-md">
        <hlm-dialog-header>
          <h3 hlmDialogTitle>Share &quot;{{ boardTitle() }}&quot;</h3>
        </hlm-dialog-header>

        <div class="flex max-h-[70vh] flex-col gap-3 overflow-y-auto py-2">
          @if (error(); as errorMsg) {
            <div hlmAlert variant="destructive">
              <p hlmAlertDescription>{{ errorMsg }}</p>
            </div>
          }
          @if (success(); as successMsg) {
            <div hlmAlert>
              <p hlmAlertDescription>{{ successMsg }}</p>
            </div>
          }

          <form class="flex gap-2" (submit)="$event.preventDefault(); invite()">
            <input
              hlmInput
              class="flex-1"
              placeholder="Enter email address"
              aria-label="Invite by email"
              type="email"
              [formField]="inviteForm.email"
              (keydown.escape)="close()"
            />
            <button
              hlmBtn
              type="button"
              [disabled]="inviteForm().invalid() || inviting() || !model().email.trim()"
              (click)="invite()"
            >
              @if (inviting()) {
                <hlm-spinner class="size-4" />
              } @else {
                <ng-icon name="lucideUserPlus" class="mr-2" />
                Invite
              }
            </button>
          </form>
          @for (err of inviteForm.email().errors(); track err.kind) {
            <p class="text-destructive text-sm">{{ err.message }}</p>
          }

          <button hlmBtn variant="outline" type="button" (click)="copyLink()">
            <ng-icon name="lucideCopy" class="mr-2" />
            Copy board link
          </button>

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
                      (click)="remove(person.id)"
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
        </div>

        <hlm-dialog-footer>
          <button hlmBtn variant="outline" type="button" (click)="close()">Done</button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class ShareDialog {
  private readonly boardService = inject(BoardService);
  private readonly userService = inject(UserService);

  readonly boardId = input.required<string>();
  readonly boardTitle = input.required<string>();
  readonly collaborators = input.required<Collaborator[]>();

  private readonly dialog = viewChild.required<HlmDialog>('dialog');

  protected readonly model = signal({ email: '' });
  protected readonly inviteForm = form(this.model, (path) => {
    required(path.email, { message: 'Enter an email' });
    emailValidator(path.email, { message: 'Enter a valid email' });
  });

  protected readonly inviting = signal(false);
  protected readonly removingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  open(): void {
    this.model.set({ email: '' });
    this.error.set(null);
    this.success.set(null);
    this.dialog().open();
  }

  close(): void {
    this.dialog().close(undefined);
    this.inviting.set(false);
  }

  protected async invite(): Promise<void> {
    await submit(this.inviteForm, async () => {
      const email = this.model().email.trim();
      this.error.set(null);
      this.success.set(null);
      this.inviting.set(true);
      try {
        const user = await this.userService.getUserByEmail(email);
        if (!user) {
          this.error.set(`No user found with email: ${email}`);
          return;
        }
        await this.boardService.shareBoard(this.boardId(), user.id);
        this.showTransientSuccess(`Invitation sent to ${email}`);
        this.model.set({ email: '' });
      } catch (err) {
        console.error('Share failed:', err);
        this.error.set(err instanceof Error ? err.message : 'Failed to send invitation');
      } finally {
        this.inviting.set(false);
      }
    });
  }

  protected async remove(userId: string): Promise<void> {
    this.error.set(null);
    this.removingId.set(userId);
    try {
      await this.boardService.removeCollaborator(this.boardId(), userId);
    } catch (err) {
      console.error('Remove collaborator failed:', err);
      this.error.set(err instanceof Error ? err.message : 'Failed to remove collaborator');
    } finally {
      this.removingId.set(null);
    }
  }

  protected copyLink(): void {
    navigator.clipboard.writeText(window.location.href).then(
      () => this.showTransientSuccess('Link copied to clipboard'),
      () => this.error.set('Could not copy link'),
    );
  }

  private showTransientSuccess(message: string): void {
    this.success.set(message);
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => this.success.set(null), 3000);
  }
}
