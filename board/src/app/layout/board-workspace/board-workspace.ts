import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { BoardStore } from '../../features/board/data/board.store';
import { BoardsSidebar } from '../../features/boards/boards-sidebar/boards-sidebar';
import { KanbanBoard } from '../../features/board/kanban-board/kanban-board';
import { isMobileSignal } from '../../core/interop/breakpoint-signal';
import { AppBar, type ViewMode } from '../app-bar/app-bar';

@Component({
  selector: 'app-board-workspace',
  providers: [BoardStore],
  imports: [NgTemplateOutlet, RouterLink, HlmButton, HlmSpinner, AppBar, BoardsSidebar, KanbanBoard],
  template: `
    <div class="flex h-dvh flex-col">
      <app-app-bar
        [title]="title()"
        [showMenuButton]="true"
        [showShare]="!!store.board()"
        [viewMode]="store.board() ? viewMode() : undefined"
        (menuClick)="toggleDrawer()"
        (viewModeChange)="viewMode.set($event)"
      />

      <div class="flex flex-1 overflow-hidden">
        @if (!isMobile() && drawerOpen()) {
          <aside class="w-70 shrink-0 overflow-y-auto border-e">
            <ng-container [ngTemplateOutlet]="sidebarContent" />
          </aside>
        }

        @if (isMobile()) {
          <dialog
            #mobileDrawer
            class="bg-background start-0 top-0 m-0 h-dvh max-h-none w-72 max-w-[80vw] rounded-none border-e p-0 backdrop:bg-black/50"
            (close)="drawerOpen.set(false)"
          >
            <ng-container [ngTemplateOutlet]="sidebarContent" />
          </dialog>
        }

        <main class="flex-1 overflow-hidden">
          @if (!store.boardId()) {
            <div class="text-muted-foreground flex h-full items-center justify-center">
              Select a board or create a new one to get started
            </div>
          } @else if (store.isLoading()) {
            <div class="flex h-full items-center justify-center">
              <hlm-spinner />
            </div>
          } @else if (!store.board()) {
            <div class="flex h-full flex-col items-center justify-center gap-2 text-center">
              <h2 class="text-xl font-medium">Board not found</h2>
              <p class="text-muted-foreground">You don't have access to this board, or it doesn't exist.</p>
              <a hlmBtn variant="outline" routerLink="/" class="mt-1">Go to boards</a>
            </div>
          } @else {
            <app-kanban-board />
          }
        </main>
      </div>
    </div>

    <ng-template #sidebarContent>
      <app-boards-sidebar />
    </ng-template>
  `,
})
export class BoardWorkspace {
  protected readonly store = inject(BoardStore);
  protected readonly isMobile = isMobileSignal();

  protected readonly drawerOpen = signal(true);
  protected readonly viewMode = signal<ViewMode>('kanban');

  protected readonly title = computed(() => this.store.board()?.title ?? 'Board by Blotch');

  private readonly mobileDrawer = viewChild<ElementRef<HTMLDialogElement>>('mobileDrawer');

  constructor() {
    effect(() => {
      const dialogEl = this.mobileDrawer()?.nativeElement;
      if (!dialogEl) return;
      if (this.isMobile() && this.drawerOpen()) {
        if (!dialogEl.open) dialogEl.showModal();
      } else if (dialogEl.open) {
        dialogEl.close();
      }
    });
  }

  protected toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }
}
