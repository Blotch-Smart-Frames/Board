import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLayoutDashboard,
  lucideEllipsisVertical,
  lucidePencil,
  lucideTrash2,
  lucideGripVertical,
  lucideArrowUp,
  lucideArrowDown,
} from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import type { BoardWithOrder } from '../data/user-boards.store';

@Component({
  selector: 'app-board-list-item',
  imports: [RouterLink, RouterLinkActive, CdkDragHandle, NgIcon, HlmButton, HlmDropdownMenuImports],
  providers: [
    provideIcons({
      lucideLayoutDashboard,
      lucideEllipsisVertical,
      lucidePencil,
      lucideTrash2,
      lucideGripVertical,
      lucideArrowUp,
      lucideArrowDown,
    }),
  ],
  template: `
    <div
      class="group hover:bg-accent relative flex items-center rounded-md"
      routerLinkActive="bg-accent text-accent-foreground"
      #rla="routerLinkActive"
    >
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
          <button hlmDropdownMenuItem variant="destructive" (click)="deleted.emit()">
            <ng-icon name="lucideTrash2" class="mr-2" />
            Delete
          </button>
        </hlm-dropdown-menu>
      </ng-template>
    </div>
  `,
})
export class BoardListItem {
  readonly board = input.required<BoardWithOrder>();
  readonly canMoveUp = input(false);
  readonly canMoveDown = input(false);
  readonly rename = output<void>();
  readonly deleted = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
}
