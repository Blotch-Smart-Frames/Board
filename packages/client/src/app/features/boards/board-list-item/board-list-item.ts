import { Component, computed, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLayoutDashboard,
  lucideEllipsisVertical,
  lucidePencil,
  lucideTrash2,
  lucideLogOut,
  lucideGripVertical,
  lucideArrowUp,
  lucideArrowDown,
  lucideFolder,
  lucideFolderInput,
  lucideFolderOutput,
  lucideFolderPlus,
} from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import type { BoardFolder, BoardWithOrder } from '../data/user-boards.store';

@Component({
  selector: 'app-board-list-item',
  imports: [RouterLink, RouterLinkActive, CdkDragHandle, NgIcon, HlmButton, HlmDropdownMenuImports],
  providers: [
    provideIcons({
      lucideLayoutDashboard,
      lucideEllipsisVertical,
      lucidePencil,
      lucideTrash2,
      lucideLogOut,
      lucideGripVertical,
      lucideArrowUp,
      lucideArrowDown,
      lucideFolder,
      lucideFolderInput,
      lucideFolderOutput,
      lucideFolderPlus,
    }),
  ],
  template: `
    <div
      class="group hover:bg-accent relative flex items-center rounded-md"
      routerLinkActive="bg-accent text-accent-foreground"
      #rla="routerLinkActive"
    >
      @if (!dragDisabled()) {
        <button
          hlmBtn
          variant="ghost"
          size="icon-sm"
          cdkDragHandle
          class="cursor-grab opacity-0 group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to reorder board"
        >
          <ng-icon name="lucideGripVertical" />
        </button>
      }

      <a
        class="flex flex-1 items-center gap-2 truncate py-2 pr-1 text-sm font-medium"
        [routerLink]="['/board', board().id]"
        [attr.aria-current]="rla.isActive ? 'page' : null"
      >
        <ng-icon name="lucideLayoutDashboard" class="shrink-0" />
        <span class="truncate">{{ board().title }}</span>
      </a>

      <button
        hlmBtn
        variant="ghost"
        size="icon-sm"
        class="mr-1 shrink-0"
        [attr.aria-label]="'Options for ' + board().title"
        [hlmDropdownMenuTrigger]="menu"
      >
        <ng-icon name="lucideEllipsisVertical" />
      </button>

      <ng-template #menu>
        <hlm-dropdown-menu>
          <button hlmDropdownMenuItem (click)="rename.emit()">
            <ng-icon name="lucidePencil" class="mr-2" />
            Rename
          </button>
          @if (canMoveUp()) {
            <button hlmDropdownMenuItem (click)="moveUp.emit()">
              <ng-icon name="lucideArrowUp" class="mr-2" />
              Move up
            </button>
          }
          @if (canMoveDown()) {
            <button hlmDropdownMenuItem (click)="moveDown.emit()">
              <ng-icon name="lucideArrowDown" class="mr-2" />
              Move down
            </button>
          }
          <button hlmDropdownMenuItem [hlmDropdownMenuSubTrigger]="folderMenu">
            <ng-icon name="lucideFolderInput" class="mr-2" />
            Move to folder
            <hlm-dropdown-menu-item-sub-indicator />
          </button>
          @if (isOwner()) {
            <button hlmDropdownMenuItem variant="destructive" (click)="deleted.emit()">
              <ng-icon name="lucideTrash2" class="mr-2" />
              Delete
            </button>
          } @else {
            <button hlmDropdownMenuItem (click)="leave.emit()">
              <ng-icon name="lucideLogOut" class="mr-2" />
              Leave board
            </button>
          }
        </hlm-dropdown-menu>
      </ng-template>

      <ng-template #folderMenu>
        <hlm-dropdown-menu-sub>
          @for (folder of otherFolders(); track folder.id) {
            <button hlmDropdownMenuItem (click)="moveToFolder.emit(folder.id)">
              <ng-icon name="lucideFolder" class="mr-2 shrink-0" />
              <span class="max-w-48 truncate">{{ folder.name }}</span>
            </button>
          }
          @if (folderId()) {
            <button hlmDropdownMenuItem (click)="moveToFolder.emit(null)">
              <ng-icon name="lucideFolderOutput" class="mr-2" />
              Remove from folder
            </button>
          }
          @if (otherFolders().length > 0 || folderId()) {
            <hlm-dropdown-menu-separator />
          }
          <button hlmDropdownMenuItem (click)="newFolder.emit()">
            <ng-icon name="lucideFolderPlus" class="mr-2" />
            New folder…
          </button>
        </hlm-dropdown-menu-sub>
      </ng-template>
    </div>
  `,
})
export class BoardListItem {
  readonly board = input.required<BoardWithOrder>();
  readonly canMoveUp = input(false);
  readonly canMoveDown = input(false);
  // Owners can delete the board; collaborators can only leave it. Defaults to
  // false so the non-destructive "Leave board" action is shown unless the parent
  // explicitly marks the current user as the owner.
  readonly isOwner = input(false);
  // Parent (BoardsSidebar) flips this on mobile/touch to hide the grip handle.
  readonly dragDisabled = input(false);
  /** Every folder the board could be filed into, and the one it's in now (null at the root). */
  readonly folders = input<BoardFolder[]>([]);
  readonly folderId = input<string | null>(null);
  readonly rename = output<void>();
  readonly deleted = output<void>();
  readonly leave = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  /** Emits the destination folder id, or null to take the board out of its folder. */
  readonly moveToFolder = output<string | null>();
  readonly newFolder = output<void>();

  protected readonly otherFolders = computed(() =>
    this.folders().filter((folder) => folder.id !== this.folderId()),
  );
}
