import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { UserBoardsStore } from '../../../boards/data/user-boards.store';
import { BoardStore } from '../../data/board.store';
import { MigrateBoardPicker } from './migrate-board-picker/migrate-board-picker';
import { MigrateListPicker } from './migrate-list-picker/migrate-list-picker';

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

      @if (error()) {
        <div hlmAlert variant="destructive">
          <p hlmAlertDescription>{{ error() }}</p>
        </div>
      }

      <div class="flex items-center gap-2">
        <button hlmBtn type="button" [disabled]="!canSubmit()" (click)="submit()">
          @if (isMigrating()) {
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
  private readonly boardStore = inject(BoardStore);

  readonly taskId = input.required<string>();
  readonly sourceBoardId = input.required<string>();
  readonly migrated = output<void>();

  protected readonly targetBoardId = signal<string | null>(null);
  // Reset the list selection whenever the target board changes so we never
  // submit a listId that belongs to a different board.
  protected readonly targetListId = linkedSignal<string | null, string | null>({
    source: this.targetBoardId,
    computation: () => null,
  });
  protected readonly isMigrating = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly availableBoards = computed(() =>
    this.userBoardsStore.boards().filter((b) => b.id !== this.sourceBoardId()),
  );

  protected readonly canSubmit = computed(
    () => !!this.targetBoardId() && !!this.targetListId() && !this.isMigrating(),
  );

  protected onBoardChange(value: string | null): void {
    this.targetBoardId.set(value);
    this.error.set(null);
  }

  protected onListChange(value: string | null): void {
    this.targetListId.set(value);
  }

  protected async submit(): Promise<void> {
    const boardId = this.targetBoardId();
    const listId = this.targetListId();
    if (!boardId || !listId) return;

    const targetBoard = this.userBoardsStore.boards().find((b) => b.id === boardId);
    if (!targetBoard) {
      this.error.set('Target board is no longer available');
      return;
    }

    this.isMigrating.set(true);
    this.error.set(null);
    try {
      await this.boardStore.migrateTaskToBoard(this.taskId(), boardId, listId, targetBoard.title);
      this.migrated.emit();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to migrate task');
    } finally {
      this.isMigrating.set(false);
    }
  }
}
