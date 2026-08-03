import { Component, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CdkDropList, CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { UserBoardsStore, type BoardWithOrder } from '../data/user-boards.store';
import { BoardListItem } from '../board-list-item/board-list-item';
import { BoardFormDialog } from '../board-form-dialog/board-form-dialog';

@Component({
  selector: 'app-boards-sidebar',
  imports: [CdkDropList, CdkDrag, NgIcon, HlmButton, HlmSpinner, BoardListItem, BoardFormDialog],
  providers: [provideIcons({ lucidePlus })],
  template: `
    <div class="flex h-full flex-col">
      <div class="border-b p-4">
        <h2 class="font-semibold">My Boards</h2>
      </div>

      @if (store.isLoading()) {
        <div class="flex items-center justify-center p-8">
          <hlm-spinner />
        </div>
      } @else {
        <nav class="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Boards" cdkDropList (cdkDropListDropped)="onDrop($event)">
          @for (board of store.boards(); track board.id; let i = $index, count = $count) {
            <div cdkDrag [cdkDragData]="board.id">
              <app-board-list-item
                [board]="board"
                [canMoveUp]="i > 0"
                [canMoveDown]="i < count - 1"
                (rename)="openRename(board)"
                (deleted)="deleteBoard(board)"
                (moveUp)="store.reorderBoardToIndex(board.id, i - 1)"
                (moveDown)="store.reorderBoardToIndex(board.id, i + 1)"
              />
            </div>
          } @empty {
            <p class="text-muted-foreground p-4 text-center text-sm">
              No boards yet. Create your first board to get started.
            </p>
          }
        </nav>
      }

      <div class="border-t p-4">
        <button hlmBtn variant="outline" class="w-full" (click)="createDialog.open()">
          <ng-icon name="lucidePlus" class="mr-2" />
          Create board
        </button>
      </div>
    </div>

    <app-board-form-dialog
      #createDialog
      heading="Create new board"
      submitLabel="Create"
      [saveHandler]="createHandler"
    />
    <app-board-form-dialog
      #renameDialog
      heading="Rename board"
      submitLabel="Rename"
      [saveHandler]="renameHandler"
    />
  `,
})
export class BoardsSidebar {
  protected readonly store = inject(UserBoardsStore);
  private readonly router = inject(Router);

  private readonly renameDialog = viewChild.required<BoardFormDialog>('renameDialog');
  private renameTargetId: string | null = null;

  // Stable references so the [saveHandler] input identity doesn't churn.
  protected readonly createHandler = async (title: string): Promise<void> => {
    const board = await this.store.createBoard({ title });
    await this.router.navigate(['/board', board.id]);
  };

  protected readonly renameHandler = async (title: string): Promise<void> => {
    if (this.renameTargetId) {
      await this.store.renameBoard(this.renameTargetId, title);
    }
  };

  protected openRename(board: BoardWithOrder): void {
    this.renameTargetId = board.id;
    this.renameDialog().open(board.title);
  }

  protected async deleteBoard(board: BoardWithOrder): Promise<void> {
    await this.store.deleteBoard(board.id);
    if (this.router.url === `/board/${board.id}`) {
      await this.router.navigate(['/']);
    }
  }

  protected onDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    const boardId = event.item.data as string;
    this.store.reorderBoardToIndex(boardId, event.currentIndex);
  }
}
