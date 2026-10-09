import { Component, input, output } from '@angular/core';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideChevronRight,
  lucideEllipsisVertical,
  lucideFolder,
  lucideFolderOpen,
  lucideGripVertical,
  lucidePencil,
  lucideTrash2,
} from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import type { BoardFolder } from '../data/user-boards.store';

/** A folder's row in the boards sidebar: expand/collapse toggle plus its options menu. */
@Component({
  selector: 'app-board-folder-header',
  imports: [CdkDragHandle, NgIcon, HlmButton, HlmDropdownMenuImports],
  providers: [
    provideIcons({
      lucideArrowDown,
      lucideArrowUp,
      lucideChevronRight,
      lucideEllipsisVertical,
      lucideFolder,
      lucideFolderOpen,
      lucideGripVertical,
      lucidePencil,
      lucideTrash2,
    }),
  ],
  host: {
    // The sidebar hit-tests this attribute to spot a board being dropped onto the folder.
    '[attr.data-folder-id]': 'folder().id',
  },
  template: `
    <div
      class="group hover:bg-accent relative flex items-center rounded-md transition-shadow"
      [class.bg-accent]="dropTarget()"
      [class.ring-2]="dropTarget()"
      [class.ring-ring]="dropTarget()"
    >
      @if (!dragDisabled()) {
        <button
          hlmBtn
          variant="ghost"
          size="icon-sm"
          cdkDragHandle
          class="cursor-grab opacity-0 group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to reorder folder"
        >
          <ng-icon name="lucideGripVertical" />
        </button>
      }

      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-1 text-left text-sm font-medium"
        [attr.aria-expanded]="!folder().collapsed"
        [attr.aria-controls]="folder().collapsed ? null : contentId()"
        (click)="toggle.emit()"
      >
        <ng-icon
          name="lucideChevronRight"
          class="text-muted-foreground shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none"
          [class.rotate-90]="!folder().collapsed"
        />
        <ng-icon
          [name]="folder().collapsed ? 'lucideFolder' : 'lucideFolderOpen'"
          class="shrink-0"
        />
        <span class="truncate">{{ folder().name }}</span>
        <span class="text-muted-foreground ms-auto text-xs tabular-nums" aria-hidden="true">
          {{ boardCount() }}
        </span>
        <span class="sr-only"
          >, {{ boardCount() }} {{ boardCount() === 1 ? 'board' : 'boards' }}</span
        >
      </button>

      <button
        hlmBtn
        variant="ghost"
        size="icon-sm"
        class="mr-1 shrink-0"
        [attr.aria-label]="'Options for folder ' + folder().name"
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
          <button hlmDropdownMenuItem variant="destructive" (click)="deleted.emit()">
            <ng-icon name="lucideTrash2" class="mr-2" />
            Delete folder
          </button>
        </hlm-dropdown-menu>
      </ng-template>
    </div>
  `,
})
export class BoardFolderHeader {
  readonly folder = input.required<BoardFolder>();
  readonly boardCount = input(0);
  /** Id of the element holding the folder's boards, for aria-controls. */
  readonly contentId = input<string | null>(null);
  readonly canMoveUp = input(false);
  readonly canMoveDown = input(false);
  readonly dragDisabled = input(false);
  /** Highlights the row while a dragged board hovers it, to show it will drop inside. */
  readonly dropTarget = input(false);
  readonly toggle = output<void>();
  readonly rename = output<void>();
  readonly deleted = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
}
