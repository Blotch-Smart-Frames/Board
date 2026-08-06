import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { UserBoardsStore } from '../../../boards/data/user-boards.store';
import { MigrateBoardPicker } from './migrate-board-picker/migrate-board-picker';
import { MigrateListPicker } from './migrate-list-picker/migrate-list-picker';

export type MigrateSubmit = { boardId: string; listId: string; boardTitle: string };

@Component({
  selector: 'app-task-migrate-form',
  imports: [
    HlmAlert,
    HlmAlertDescription,
    HlmButton,
    HlmSpinner,
    MigrateBoardPicker,
    MigrateListPicker,
  ],
  template: `
    <div class="flex max-w-lg flex-col gap-4">
      <div>
        <h3 class="text-sm font-medium">Move to another board</h3>
        <p class="text-muted-foreground text-xs">
          Comments and history come along; labels are dropped because they belong to the source
          board.
        </p>
      </div>

      <app-migrate-board-picker
        [boards]="availableBoards()"
        [value]="targetBoardId()"
        (valueChange)="onBoardChange($event)"
      />

      <app-migrate-list-picker
        [boardId]="targetBoardId()"
        [value]="targetListId()"
        (valueChange)="onListChange($event)"
      />

      @if (displayedError(); as err) {
        <div hlmAlert variant="destructive">
          <p hlmAlertDescription>{{ err }}</p>
        </div>
      }

      <div class="flex items-center gap-2">
        <button hlmBtn type="button" [disabled]="!canSubmit()" (click)="submit()">
          @if (isSubmitting()) {
            <hlm-spinner class="mr-2 size-4" />
          }
          Move task
        </button>
      </div>
    </div>
  `,
})
export class TaskMigrateForm {
  private readonly userBoardsStore = inject(UserBoardsStore);

  readonly sourceBoardId = input.required<string>();
  readonly isSubmitting = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitMigration = output<MigrateSubmit>();

  protected readonly targetBoardId = signal<string | null>(null);
  // Reset the list selection whenever the target board changes so we never
  // submit a listId that belongs to a different board.
  protected readonly targetListId = linkedSignal<string | null, string | null>({
    source: this.targetBoardId,
    computation: () => null,
  });
  protected readonly localError = signal<string | null>(null);

  protected readonly displayedError = computed(() => this.localError() ?? this.errorMessage());

  protected readonly availableBoards = computed(() =>
    this.userBoardsStore.boards().filter((b) => b.id !== this.sourceBoardId()),
  );

  protected readonly canSubmit = computed(
    () => !!this.targetBoardId() && !!this.targetListId() && !this.isSubmitting(),
  );

  protected onBoardChange(value: string | null): void {
    this.targetBoardId.set(value);
    this.localError.set(null);
  }

  protected onListChange(value: string | null): void {
    this.targetListId.set(value);
  }

  protected submit(): void {
    const boardId = this.targetBoardId();
    const listId = this.targetListId();
    if (!boardId || !listId) return;

    const targetBoard = this.userBoardsStore.boards().find((b) => b.id === boardId);
    if (!targetBoard) {
      this.localError.set('Target board is no longer available');
      return;
    }

    this.localError.set(null);
    this.submitMigration.emit({ boardId, listId, boardTitle: targetBoard.title });
  }
}
