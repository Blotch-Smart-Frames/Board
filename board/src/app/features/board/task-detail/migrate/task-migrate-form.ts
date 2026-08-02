import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { collection, orderBy, query, type Query } from 'firebase/firestore';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmComboboxImports } from '@spartan-ng/helm/combobox';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { FIRESTORE_DB } from '../../../../core/firebase/firebase.config';
import { collectionSignal } from '../../../../core/interop/signal-interop';
import { UserBoardsStore } from '../../../boards/data/user-boards.store';
import { BoardStore } from '../../data/board.store';
import { compareOrder } from '../../../../shared/utils/ordering';
import type { List } from '../../../../shared/types/board';

@Component({
  selector: 'app-task-migrate-form',
  imports: [
    HlmAlert,
    HlmAlertDescription,
    HlmButton,
    HlmComboboxImports,
    HlmFieldImports,
    HlmSpinner,
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

      <div hlmField>
        <label hlmFieldLabel for="migrate-board-trigger">Target board</label>

        <hlm-combobox
          [value]="targetBoardId()"
          [itemToString]="boardIdToTitle"
          (valueChange)="onBoardChange($event)"
        >
          <hlm-combobox-trigger buttonId="migrate-board-trigger" class="w-full">
            <hlm-combobox-value placeholder="Select a board" />
          </hlm-combobox-trigger>
          <hlm-combobox-content *hlmComboboxPortal>
            <hlm-combobox-input placeholder="Search boards..." />
            <hlm-combobox-empty>No matching boards.</hlm-combobox-empty>
            <div hlmComboboxList>
              @for (board of availableBoards(); track board.id) {
                <hlm-combobox-item [value]="board.id">{{ board.title }}</hlm-combobox-item>
              }
            </div>
          </hlm-combobox-content>
        </hlm-combobox>

        @if (availableBoards().length === 0) {
          <p hlmFieldDescription>You need at least one other board to migrate a task.</p>
        }
      </div>

      <div hlmField>
        <label hlmFieldLabel for="migrate-list-trigger">Target list</label>

        <hlm-combobox
          [value]="targetListId()"
          [itemToString]="listIdToTitle"
          [disabled]="!targetBoardId() || targetListsLoading()"
          (valueChange)="onListChange($event)"
        >
          <hlm-combobox-trigger buttonId="migrate-list-trigger" class="w-full">
            <hlm-combobox-value [placeholder]="listPlaceholder()" />
          </hlm-combobox-trigger>
          <hlm-combobox-content *hlmComboboxPortal>
            <hlm-combobox-input placeholder="Search lists..." />
            <hlm-combobox-empty>No matching lists.</hlm-combobox-empty>
            <div hlmComboboxList>
              @for (list of sortedTargetLists(); track list.id) {
                <hlm-combobox-item [value]="list.id">{{ list.title }}</hlm-combobox-item>
              }
            </div>
          </hlm-combobox-content>
        </hlm-combobox>

        @if (targetBoardId() && !targetListsLoading() && sortedTargetLists().length === 0) {
          <p hlmFieldDescription>That board has no lists — create one there first.</p>
        }
      </div>

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
  private readonly db = inject(FIRESTORE_DB);
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

  private readonly targetListsQuery = computed<Query | null>(() => {
    const boardId = this.targetBoardId();
    return boardId
      ? query(collection(this.db, 'boards', boardId, 'lists'), orderBy('order'))
      : null;
  });

  private readonly targetLists = collectionSignal<List>(() => this.targetListsQuery());

  protected readonly targetListsLoading = computed(
    () => !!this.targetBoardId() && this.targetLists() === undefined,
  );

  protected readonly sortedTargetLists = computed(() =>
    [...(this.targetLists() ?? [])].sort((a, b) => compareOrder(a.order, b.order)),
  );

  protected readonly listPlaceholder = computed(() => {
    if (!this.targetBoardId()) return 'Select a board first';
    if (this.targetListsLoading()) return 'Loading lists...';
    return 'Select a list';
  });

  protected readonly canSubmit = computed(
    () => !!this.targetBoardId() && !!this.targetListId() && !this.isMigrating(),
  );

  protected onBoardChange(value: unknown): void {
    this.targetBoardId.set(typeof value === 'string' ? value : null);
    this.error.set(null);
  }

  protected onListChange(value: unknown): void {
    this.targetListId.set(typeof value === 'string' ? value : null);
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

  protected readonly boardIdToTitle = (id: string): string =>
    this.userBoardsStore.boards().find((b) => b.id === id)?.title ?? '';

  protected readonly listIdToTitle = (id: string): string =>
    this.sortedTargetLists().find((l) => l.id === id)?.title ?? '';
}
