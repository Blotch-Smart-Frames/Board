import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CdkDropList, CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideMenu,
  lucideSettings,
  lucideColumns3,
  lucideGanttChartSquare,
} from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { toast } from '@spartan-ng/brain/sonner';
import { UserBoardsStore, type BoardWithOrder } from '../data/user-boards.store';
import { BoardListItem } from '../board-list-item/board-list-item';
import { BoardFormDialog } from '../board-form-dialog/board-form-dialog';
import { isTouchOrMobileSignal } from '../../../core/interop/breakpoint-signal';

export type ViewMode = 'kanban' | 'timeline';

@Component({
  selector: 'app-boards-sidebar',
  imports: [
    CdkDropList,
    CdkDrag,
    NgIcon,
    HlmButton,
    HlmSpinner,
    HlmToggleGroupImports,
    BoardListItem,
    BoardFormDialog,
  ],
  providers: [
    provideIcons({
      lucidePlus,
      lucideMenu,
      lucideSettings,
      lucideColumns3,
      lucideGanttChartSquare,
    }),
  ],
  host: {
    class:
      'flex h-full shrink-0 flex-col overflow-hidden border-e transition-[width] duration-300 ease-out',
    '[class.w-70]': '!collapsed()',
    '[class.w-14]': 'collapsed()',
  },
  template: `
    <div class="flex items-center gap-1 border-b p-2">
      <button
        hlmBtn
        variant="ghost"
        size="icon"
        aria-label="menu"
        [attr.aria-expanded]="!collapsed()"
        (click)="toggleCollapsed()"
      >
        <ng-icon name="lucideMenu" />
      </button>

      @if (!collapsed()) {
        <h1 class="text-primary min-w-0 grow truncate text-sm font-semibold">{{ title() }}</h1>

        @if (showSettings()) {
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            aria-label="Board settings"
            (click)="settings.emit()"
          >
            <ng-icon name="lucideSettings" />
          </button>
        }
      }
    </div>

    @if (viewMode(); as mode) {
      <div class="border-b p-2">
        <div
          hlmToggleGroup
          type="single"
          [value]="mode"
          class="w-full"
          [class.flex-col]="collapsed()"
          [class.gap-1]="collapsed()"
          (valueChange)="onViewModeChange($event)"
        >
          <button
            hlmToggleGroupItem
            value="kanban"
            aria-label="Kanban view"
            [class.flex-1]="!collapsed()"
            [class.w-full]="collapsed()"
          >
            <ng-icon name="lucideColumns3" />
            @if (!collapsed()) {
              <span>Kanban</span>
            }
          </button>
          <button
            hlmToggleGroupItem
            value="timeline"
            aria-label="Timeline view"
            [class.flex-1]="!collapsed()"
            [class.w-full]="collapsed()"
          >
            <ng-icon name="lucideGanttChartSquare" />
            @if (!collapsed()) {
              <span>Timeline</span>
            }
          </button>
        </div>
      </div>
    }

    @if (!collapsed()) {
      @if (store.isLoading()) {
        <div class="flex items-center justify-center p-8">
          <hlm-spinner />
        </div>
      } @else {
        <nav
          class="flex-1 space-y-0.5 overflow-y-auto p-2"
          aria-label="Boards"
          cdkDropList
          [cdkDropListDisabled]="dragDisabled()"
          (cdkDropListDropped)="onDrop($event)"
        >
          @for (board of store.boards(); track board.id; let i = $index, count = $count) {
            <div cdkDrag [cdkDragData]="board.id" [cdkDragDisabled]="dragDisabled()">
              <app-board-list-item
                [board]="board"
                [canMoveUp]="i > 0"
                [canMoveDown]="i < count - 1"
                [isOwner]="board.ownerId === store.currentUserId()"
                [dragDisabled]="dragDisabled()"
                (rename)="openRename(board)"
                (deleted)="deleteBoard(board)"
                (leave)="leaveBoard(board)"
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
    } @else {
      <div class="flex-1"></div>
    }

    <div class="border-t" [class.p-4]="!collapsed()" [class.p-2]="collapsed()">
      @if (collapsed()) {
        <button
          hlmBtn
          variant="outline"
          size="icon"
          aria-label="Create board"
          class="w-full"
          (click)="createDialog.open()"
        >
          <ng-icon name="lucidePlus" />
        </button>
      } @else {
        <button hlmBtn variant="outline" class="w-full" (click)="createDialog.open()">
          <ng-icon name="lucidePlus" class="mr-2" />
          Create board
        </button>
      }
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

  readonly boardTitle = input<string | undefined>(undefined);
  readonly viewMode = input<ViewMode | undefined>(undefined);
  readonly showSettings = input(false);

  readonly viewModeChange = output<ViewMode>();
  readonly settings = output<void>();

  protected readonly collapsed = signal(false);

  // Suppress sidebar drag reordering on touch/mobile so vertical scroll works.
  protected readonly dragDisabled = isTouchOrMobileSignal();

  protected readonly title = computed(() => this.boardTitle() ?? 'Board by Blotch');

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
    try {
      await this.store.deleteBoard(board.id);
    } catch {
      toast.error(`Couldn't delete "${board.title}". Please try again.`);
      return;
    }
    await this.navigateAwayIfViewing(board.id);
  }

  protected async leaveBoard(board: BoardWithOrder): Promise<void> {
    try {
      await this.store.leaveBoard(board.id);
    } catch {
      toast.error(`Couldn't leave "${board.title}". Please try again.`);
      return;
    }
    await this.navigateAwayIfViewing(board.id);
  }

  // When the board being removed is the one on screen, bounce back home so we're
  // not left viewing a board that no longer exists or is no longer accessible.
  private async navigateAwayIfViewing(boardId: string): Promise<void> {
    if (this.router.url === `/board/${boardId}`) {
      await this.router.navigate(['/']);
    }
  }

  protected onDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    const boardId = event.item.data as string;
    this.store.reorderBoardToIndex(boardId, event.currentIndex);
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }

  protected onViewModeChange(value: unknown): void {
    if (value === 'kanban' || value === 'timeline') {
      this.viewModeChange.emit(value);
    }
  }
}
