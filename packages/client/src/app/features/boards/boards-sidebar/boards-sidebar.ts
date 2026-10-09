import {
  Component,
  DOCUMENT,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { CdkDropList, CdkDrag, type CdkDragDrop, type CdkDragMove } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideMenu,
  lucideSettings,
  lucideColumns3,
  lucideGanttChartSquare,
  lucideFolderPlus,
} from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { toast } from '@spartan-ng/brain/sonner';
import {
  UserBoardsStore,
  type BoardFolder,
  type BoardWithOrder,
  type SidebarNode,
} from '../data/user-boards.store';
import { BoardListItem } from '../board-list-item/board-list-item';
import { BoardFolderHeader } from '../board-folder-header/board-folder-header';
import { BoardFormDialog } from '../board-form-dialog/board-form-dialog';
import { isTouchOrMobileSignal } from '../../../core/interop/breakpoint-signal';

export type ViewMode = 'kanban' | 'timeline';

const ROOT_LIST_ID = 'boards-root';
const FOLDER_LIST_PREFIX = 'board-folder-';
const folderListId = (folderId: string) => FOLDER_LIST_PREFIX + folderId;

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
    BoardFolderHeader,
    BoardFormDialog,
  ],
  providers: [
    provideIcons({
      lucidePlus,
      lucideMenu,
      lucideSettings,
      lucideColumns3,
      lucideGanttChartSquare,
      lucideFolderPlus,
    }),
  ],
  host: {
    class:
      'flex h-full shrink-0 flex-col overflow-hidden border-e transition-[width] duration-300 ease-out',
    '[class.w-70]': '!collapsed()',
    '[class.w-14]': 'collapsed()',
    '[attr.data-reveal-on-expand]': 'hasToggled() ? "" : null',
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
        <h1 class="text-primary sidebar-reveal min-w-0 grow truncate text-sm font-semibold">
          {{ title() }}
        </h1>

        @if (showSettings()) {
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            class="sidebar-reveal"
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
          [orientation]="collapsed() ? 'vertical' : 'horizontal'"
          type="single"
          [value]="mode"
          class="w-full"
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
              <span class="sidebar-reveal">Kanban</span>
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
              <span class="sidebar-reveal">Timeline</span>
            }
          </button>
        </div>
      </div>
    }

    @if (!collapsed()) {
      @if (store.isLoading()) {
        <div class="sidebar-reveal flex items-center justify-center p-8">
          <hlm-spinner />
        </div>
      } @else {
        <nav
          class="sidebar-reveal flex-1 space-y-0.5 overflow-y-auto p-2"
          aria-label="Boards"
          cdkDropList
          [id]="rootListId"
          [cdkDropListConnectedTo]="folderListIds()"
          [cdkDropListDisabled]="dragDisabled()"
          [cdkDropListEnterPredicate]="canEnterList"
          [cdkDropListSortPredicate]="canSortRoot"
          (cdkDropListDropped)="onDrop($event)"
        >
          @for (node of store.sidebar(); track node.id; let i = $index, count = $count) {
            <div
              cdkDrag
              [cdkDragData]="node"
              [cdkDragDisabled]="dragDisabled()"
              (cdkDragMoved)="onDragMoved($event)"
            >
              @if (node.kind === 'folder') {
                <app-board-folder-header
                  [folder]="node.folder"
                  [boardCount]="node.boards.length"
                  [contentId]="folderListId(node.id)"
                  [canMoveUp]="i > 0"
                  [canMoveDown]="i < count - 1"
                  [dragDisabled]="dragDisabled()"
                  [dropTarget]="dropIntoFolderId() === node.id"
                  (toggle)="arrange(store.setFolderCollapsed(node.id, !node.folder.collapsed))"
                  (rename)="openRenameFolder(node.folder)"
                  (deleted)="deleteFolder(node.folder)"
                  (moveUp)="arrange(store.moveFolder(node.id, i - 1))"
                  (moveDown)="arrange(store.moveFolder(node.id, i + 1))"
                />
                @if (!node.folder.collapsed) {
                  <div
                    role="group"
                    class="ms-4 space-y-0.5 border-s ps-1"
                    [attr.aria-label]="node.folder.name"
                    cdkDropList
                    [id]="folderListId(node.id)"
                    [cdkDropListConnectedTo]="allListIds()"
                    [cdkDropListDisabled]="dragDisabled()"
                    [cdkDropListEnterPredicate]="canEnterList"
                    (cdkDropListDropped)="onDrop($event)"
                  >
                    @for (child of node.boards; track child.id; let j = $index, size = $count) {
                      <div
                        cdkDrag
                        [cdkDragData]="child"
                        [cdkDragDisabled]="dragDisabled()"
                        (cdkDragMoved)="onDragMoved($event)"
                      >
                        <app-board-list-item
                          [board]="child.board"
                          [canMoveUp]="j > 0"
                          [canMoveDown]="j < size - 1"
                          [isOwner]="child.board.ownerId === store.currentUserId()"
                          [dragDisabled]="dragDisabled()"
                          [folders]="store.folders()"
                          [folderId]="node.id"
                          (rename)="openRename(child.board)"
                          (deleted)="deleteBoard(child.board)"
                          (leave)="leaveBoard(child.board)"
                          (moveUp)="arrange(store.moveBoard(child.id, node.id, j - 1))"
                          (moveDown)="arrange(store.moveBoard(child.id, node.id, j + 1))"
                          (moveToFolder)="arrange(store.moveBoardToFolder(child.id, $event))"
                          (newFolder)="openCreateFolder(child.id)"
                        />
                      </div>
                    } @empty {
                      <p
                        class="text-muted-foreground px-2 py-1.5 text-xs in-[.cdk-drop-list-dragging]:hidden"
                      >
                        No boards in this folder
                      </p>
                    }
                  </div>
                }
              } @else {
                <app-board-list-item
                  [board]="node.board"
                  [canMoveUp]="i > 0"
                  [canMoveDown]="i < count - 1"
                  [isOwner]="node.board.ownerId === store.currentUserId()"
                  [dragDisabled]="dragDisabled()"
                  [folders]="store.folders()"
                  (rename)="openRename(node.board)"
                  (deleted)="deleteBoard(node.board)"
                  (leave)="leaveBoard(node.board)"
                  (moveUp)="arrange(store.moveBoard(node.id, null, i - 1))"
                  (moveDown)="arrange(store.moveBoard(node.id, null, i + 1))"
                  (moveToFolder)="arrange(store.moveBoardToFolder(node.id, $event))"
                  (newFolder)="openCreateFolder(node.id)"
                />
              }
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
        <div class="sidebar-reveal flex gap-2">
          <button hlmBtn variant="outline" class="flex-1" (click)="createDialog.open()">
            <ng-icon name="lucidePlus" class="mr-2" />
            Create board
          </button>
          <button
            hlmBtn
            variant="outline"
            size="icon"
            aria-label="New folder"
            (click)="openCreateFolder()"
          >
            <ng-icon name="lucideFolderPlus" />
          </button>
        </div>
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
    <app-board-form-dialog
      #createFolderDialog
      heading="New folder"
      submitLabel="Create"
      fieldLabel="Folder name"
      [saveHandler]="createFolderHandler"
    />
    <app-board-form-dialog
      #renameFolderDialog
      heading="Rename folder"
      submitLabel="Rename"
      fieldLabel="Folder name"
      [saveHandler]="renameFolderHandler"
    />
  `,
})
export class BoardsSidebar {
  protected readonly store = inject(UserBoardsStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  readonly boardTitle = input<string | undefined>(undefined);
  readonly viewMode = input<ViewMode | undefined>(undefined);
  readonly showSettings = input(false);

  readonly viewModeChange = output<ViewMode>();
  readonly settings = output<void>();

  protected readonly collapsed = signal(false);
  // Gates the expand fade-in so it doesn't play on the sidebar's first render.
  protected readonly hasToggled = signal(false);

  // Suppress sidebar drag reordering on touch/mobile so vertical scroll works.
  protected readonly dragDisabled = isTouchOrMobileSignal();

  protected readonly title = computed(() => this.boardTitle() ?? 'Board by Blotch');

  protected readonly rootListId = ROOT_LIST_ID;
  protected readonly folderListId = folderListId;
  // Only expanded folders render a drop list to connect to.
  protected readonly folderListIds = computed(() =>
    this.store
      .folders()
      .filter((folder) => !folder.collapsed)
      .map((folder) => folderListId(folder.id)),
  );
  protected readonly allListIds = computed(() => [...this.folderListIds(), ROOT_LIST_ID]);

  // CDK hands a drag to the first connected list whose box contains the pointer,
  // and the root list's box contains every folder — so it would swallow drops
  // meant for a folder. We track the innermost list under the pointer instead
  // and only let that one accept the item.
  private hoveredListId: string | null = null;
  /** The folder whose row a dragged board is hovering; dropping files the board into it. */
  protected readonly dropIntoFolderId = signal<string | null>(null);

  private readonly renameDialog = viewChild.required<BoardFormDialog>('renameDialog');
  private readonly createFolderDialog = viewChild.required<BoardFormDialog>('createFolderDialog');
  private readonly renameFolderDialog = viewChild.required<BoardFormDialog>('renameFolderDialog');
  private renameTargetId: string | null = null;
  private renameFolderTargetId: string | null = null;
  // Set when "New folder…" is picked from a board's menu, so the board goes straight in.
  private newFolderBoardId: string | null = null;

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

  protected readonly createFolderHandler = async (name: string): Promise<void> => {
    const folderId = await this.store.createFolder(name);
    if (this.newFolderBoardId) {
      await this.store.moveBoardToFolder(this.newFolderBoardId, folderId);
    }
  };

  protected readonly renameFolderHandler = async (name: string): Promise<void> => {
    if (this.renameFolderTargetId) {
      await this.store.renameFolder(this.renameFolderTargetId, name);
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

  protected openCreateFolder(boardId: string | null = null): void {
    this.newFolderBoardId = boardId;
    this.createFolderDialog().open();
  }

  protected openRenameFolder(folder: BoardFolder): void {
    this.renameFolderTargetId = folder.id;
    this.renameFolderDialog().open(folder.name);
  }

  protected async deleteFolder(folder: BoardFolder): Promise<void> {
    try {
      await this.store.deleteFolder(folder.id);
    } catch {
      toast.error(`Couldn't delete "${folder.name}". Please try again.`);
    }
  }

  /** Runs a sidebar layout change; the store rolls back its optimistic update on failure. */
  protected arrange(change: Promise<void>): void {
    change.catch(() => toast.error("Couldn't save your sidebar layout. Please try again."));
  }

  protected onDragMoved(event: CdkDragMove<SidebarNode>): void {
    const { x, y } = event.pointerPosition;
    const target = this.document.elementFromPoint(x, y);
    this.hoveredListId = target?.closest('.cdk-drop-list')?.id ?? null;
    const folderRow =
      event.source.data.kind === 'board'
        ? target?.closest<HTMLElement>('app-board-folder-header')
        : null;
    this.dropIntoFolderId.set(folderRow?.dataset['folderId'] ?? null);
  }

  protected readonly canEnterList = (drag: CdkDrag<SidebarNode>, drop: CdkDropList): boolean =>
    drop.id === this.hoveredListId && (drop.id === ROOT_LIST_ID || drag.data.kind === 'board');

  // While a board hovers a folder row it's headed into that folder, so hold the root order still.
  protected readonly canSortRoot = (): boolean => this.dropIntoFolderId() === null;

  protected onDrop(event: CdkDragDrop<unknown, unknown, SidebarNode>): void {
    const node = event.item.data;
    const intoFolderId = this.dropIntoFolderId();
    this.dropIntoFolderId.set(null);
    this.hoveredListId = null;

    if (node.kind === 'board' && intoFolderId) {
      if (intoFolderId !== node.folderId) {
        this.arrange(this.store.moveBoardToFolder(node.id, intoFolderId));
      }
      return;
    }
    if (event.container === event.previousContainer && event.currentIndex === event.previousIndex) {
      return;
    }
    if (node.kind === 'folder') {
      this.arrange(this.store.moveFolder(node.id, event.currentIndex));
    } else {
      const listId = event.container.id;
      const folderId = listId === ROOT_LIST_ID ? null : listId.slice(FOLDER_LIST_PREFIX.length);
      this.arrange(this.store.moveBoard(node.id, folderId, event.currentIndex));
    }
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
    this.hasToggled.set(true);
  }

  protected onViewModeChange(value: unknown): void {
    if (value === 'kanban' || value === 'timeline') {
      this.viewModeChange.emit(value);
    }
  }
}
