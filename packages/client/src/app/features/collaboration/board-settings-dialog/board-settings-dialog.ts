import { Component, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCopy } from '@ng-icons/lucide';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { BoardService } from '../../../core/services/board.service';
import { UserService } from '../../../core/services/user.service';
import { ShareInviteForm } from './share-invite-form/share-invite-form';
import { ShareCollaboratorList } from './share-collaborator-list/share-collaborator-list';
import { ArchivalListsField } from './archival-lists-field/archival-lists-field';
import type { Collaborator, List } from '../../../shared/types/board';

/**
 * Per-board settings: sharing (invite-by-email + collaborator list) plus
 * archival-list configuration. Imperatively opened via `open()`, following the
 * same viewChild(HlmDialog) pattern as board-form-dialog. Injects
 * BoardService/UserService directly since the flows are self-contained. The
 * transient success banner uses a plain setTimeout for the 3s auto-dismiss.
 */
@Component({
  selector: 'app-board-settings-dialog',
  imports: [
    HlmDialogImports,
    HlmButton,
    HlmAlert,
    HlmAlertDescription,
    NgIcon,
    ShareInviteForm,
    ShareCollaboratorList,
    ArchivalListsField,
  ],
  providers: [provideIcons({ lucideCopy })],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content *hlmDialogPortal class="sm:max-w-md">
        <hlm-dialog-header>
          <h3 hlmDialogTitle>Board settings</h3>
          <p hlmDialogDescription class="truncate">{{ boardTitle() }}</p>
        </hlm-dialog-header>

        <div class="flex max-h-[70vh] flex-col gap-5 overflow-y-auto py-2">
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

          <section class="flex flex-col gap-3">
            <h4 class="text-sm font-medium">Sharing</h4>

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
          </section>

          <section class="flex flex-col gap-2">
            <h4 class="text-sm font-medium">Archived lists</h4>
            <p class="text-muted-foreground text-xs">
              Dragging a task into one of these lists archives it. Archived tasks are hidden from the
              board (only a few recent ones show, faded) to keep large boards fast and cheap to load.
            </p>
            <app-archival-lists-field
              [lists]="lists()"
              [selectedListIds]="localArchivalListIds()"
              (selectedListIdsChange)="onArchivalListIdsChange($event)"
            />
          </section>
        </div>

        <hlm-dialog-footer>
          <button hlmBtn variant="outline" type="button" (click)="close()">Done</button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class BoardSettingsDialog {
  private readonly boardService = inject(BoardService);
  private readonly userService = inject(UserService);

  readonly boardId = input.required<string>();
  readonly boardTitle = input.required<string>();
  readonly collaborators = input.required<Collaborator[]>();
  readonly lists = input.required<List[]>();
  readonly archivalListIds = input<string[]>([]);

  private readonly dialog = viewChild.required<HlmDialog>('dialog');

  // Optimistic local copy so the multi-select updates instantly on change; it
  // resets from the input whenever the live board document echoes the save back.
  protected readonly localArchivalListIds = linkedSignal(() => this.archivalListIds());

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

  protected async onArchivalListIdsChange(listIds: string[]): Promise<void> {
    this.localArchivalListIds.set(listIds);
    try {
      await this.boardService.updateBoard(this.boardId(), { archivalListIds: listIds });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to update archived lists');
    }
  }

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
