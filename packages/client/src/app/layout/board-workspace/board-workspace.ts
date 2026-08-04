import { Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLayoutDashboard } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { BoardStore } from '../../features/board/data/board.store';
import { BoardsSidebar, type ViewMode } from '../../features/boards/boards-sidebar/boards-sidebar';
import { KanbanBoard } from '../../features/board/kanban-board/kanban-board';
import { TimelineView } from '../../features/timeline/timeline-view/timeline-view';
import { BackgroundImageUpload } from '../../features/board/background-image-upload/background-image-upload';
import { ShareDialog } from '../../features/collaboration/share-dialog/share-dialog';

@Component({
  selector: 'app-board-workspace',
  providers: [BoardStore, provideIcons({ lucideLayoutDashboard })],
  imports: [
    RouterLink,
    NgIcon,
    HlmButton,
    HlmEmptyImports,
    HlmSpinner,
    BoardsSidebar,
    KanbanBoard,
    TimelineView,
    BackgroundImageUpload,
    ShareDialog,
  ],
  template: `
    <div class="flex h-full overflow-hidden">
      <app-boards-sidebar
        [boardTitle]="store.board()?.title"
        [showShare]="!!store.board()"
        [viewMode]="store.board() ? viewMode() : undefined"
        (viewModeChange)="viewMode.set($event)"
        (share)="openShare()"
      />

      <main class="flex-1 overflow-hidden">
        @if (!store.boardId()) {
          <div class="flex h-full items-center justify-center p-4">
            <hlm-empty class="w-96">
              <hlm-empty-header>
                <hlm-empty-media variant="icon">
                  <ng-icon name="lucideLayoutDashboard" />
                </hlm-empty-media>
                <div hlmEmptyTitle>No board selected</div>
                <div hlmEmptyDescription>
                  Select a board from the sidebar or create a new one to get started.
                </div>
              </hlm-empty-header>
            </hlm-empty>
          </div>
        } @else if (store.isLoading()) {
          <div class="flex h-full items-center justify-center">
            <hlm-spinner />
          </div>
        } @else if (!store.board()) {
          <div class="flex h-full flex-col items-center justify-center gap-2 text-center">
            <h2 class="text-xl font-medium">Board not found</h2>
            <p class="text-muted-foreground">
              You don't have access to this board, or it doesn't exist.
            </p>
            <a hlmBtn variant="outline" routerLink="/" class="mt-1">Go to boards</a>
          </div>
        } @else if (viewMode() === 'kanban') {
          <app-kanban-board />
        } @else {
          <app-timeline-view />
        }
      </main>
    </div>

    @if (store.board(); as board) {
      <app-background-image-upload
        [boardId]="store.boardId()!"
        [hasBackground]="!!board.backgroundImageUrl"
      />

      <app-share-dialog
        #shareDialog
        [boardId]="store.boardId()!"
        [boardTitle]="board.title"
        [collaborators]="store.collaborators()"
      />
    }
  `,
})
export class BoardWorkspace {
  protected readonly store = inject(BoardStore);

  protected readonly viewMode = signal<ViewMode>('kanban');

  private readonly shareDialog = viewChild<ShareDialog>('shareDialog');

  protected openShare(): void {
    this.shareDialog()?.open();
  }
}
