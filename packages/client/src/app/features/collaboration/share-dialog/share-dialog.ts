import { Component, inject, input, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCopy } from '@ng-icons/lucide';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { BoardService } from '../../../core/services/board.service';
import { UserService } from '../../../core/services/user.service';
import { ShareInviteForm } from './share-invite-form/share-invite-form';
import { ShareCollaboratorList } from './share-collaborator-list/share-collaborator-list';
import type { Collaborator } from '../../../shared/types/board';

/**
 * Invite-by-email + collaborator list. Imperatively opened via `open()`,
 * following the same viewChild(HlmDialog)/saveHandler pattern as
 * board-form-dialog. Inject BoardService/UserService directly (rather than
 * routing through the parent) since the flow is self-contained. The
 * transient success banner uses a plain setTimeout for the 3s auto-dismiss;
 * that's fine for a one-off UI toast and doesn't need signal-interop.
 */
@Component({
  selector: 'app-share-dialog',
  imports: [
    HlmDialogImports,
    HlmButton,
    HlmAlert,
    HlmAlertDescription,
    NgIcon,
    ShareInviteForm,
    ShareCollaboratorList,
  ],
  providers: [provideIcons({ lucideCopy })],
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

          <app-share-invite-form
            [inviteHandler]="inviteHandler"
            (success)="showTransientSuccess($event)"
            (error)="error.set($event)"
            (escape)="close()"
          />

          <button hlmBtn variant="outline" type="button" (click)="copyLink()">
            <ng-icon name="lucideCopy" class="mr-2" />
            Copy board link
          </button>

          <app-share-collaborator-list
            [collaborators]="collaborators()"
            [removeHandler]="removeHandler"
            (error)="error.set($event)"
          />
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

  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  open(): void {
    this.error.set(null);
    this.success.set(null);
    this.dialog().open();
  }

  close(): void {
    this.dialog().close(undefined);
  }

  protected readonly inviteHandler = async (email: string): Promise<string> => {
    const user = await this.userService.getUserByEmail(email);
    if (!user) throw new Error(`No user found with email: ${email}`);
    await this.boardService.shareBoard(this.boardId(), user.id);
    return `Invitation sent to ${email}`;
  };

  protected readonly removeHandler = (userId: string): Promise<void> =>
    this.boardService.removeCollaborator(this.boardId(), userId);

  protected copyLink(): void {
    navigator.clipboard.writeText(window.location.href).then(
      () => this.showTransientSuccess('Link copied to clipboard'),
      () => this.error.set('Could not copy link'),
    );
  }

  protected showTransientSuccess(message: string): void {
    this.error.set(null);
    this.success.set(message);
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => this.success.set(null), 3000);
  }
}
