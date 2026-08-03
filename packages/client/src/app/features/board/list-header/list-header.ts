import { Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideEllipsisVertical,
  lucidePencil,
  lucideTrash2,
  lucideArrowLeft,
  lucideArrowRight,
} from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';

@Component({
  selector: 'app-list-header',
  imports: [NgIcon, HlmButton, HlmInput, HlmDropdownMenuImports],
  providers: [
    provideIcons({
      lucideEllipsisVertical,
      lucidePencil,
      lucideTrash2,
      lucideArrowLeft,
      lucideArrowRight,
    }),
  ],
  template: `
    <div class="flex items-center justify-between gap-1 px-2 py-2">
      @if (editing()) {
        <input
          #titleInput
          hlmInput
          class="h-8 flex-1"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          (blur)="commit()"
          (keydown.enter)="commit()"
          (keydown.escape)="cancel()"
          aria-label="List title"
        />
      } @else {
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <h2
            class="cursor-pointer truncate font-semibold"
            (click)="startEditing()"
            (keydown.enter)="startEditing()"
            tabindex="0"
            role="button"
            [attr.aria-label]="'Rename list ' + title()"
          >
            {{ title() }}
          </h2>
          <span class="bg-accent text-muted-foreground rounded-full px-2 py-0.5 text-xs">{{ taskCount() }}</span>
        </div>
      }

      <button hlmBtn variant="ghost" size="icon-sm" [hlmDropdownMenuTrigger]="menu" aria-label="List options">
        <ng-icon name="lucideEllipsisVertical" />
      </button>
      <ng-template #menu>
        <hlm-dropdown-menu>
          <button hlmDropdownMenuItem (click)="startEditing()">
            <ng-icon name="lucidePencil" class="mr-2" />
            Edit title
          </button>
          @if (canMoveLeft()) {
            <button hlmDropdownMenuItem (click)="moveLeft.emit()">
              <ng-icon name="lucideArrowLeft" class="mr-2" />
              Move left
            </button>
          }
          @if (canMoveRight()) {
            <button hlmDropdownMenuItem (click)="moveRight.emit()">
              <ng-icon name="lucideArrowRight" class="mr-2" />
              Move right
            </button>
          }
          <button hlmDropdownMenuItem variant="destructive" (click)="deleteList.emit()">
            <ng-icon name="lucideTrash2" class="mr-2" />
            Delete list
          </button>
        </hlm-dropdown-menu>
      </ng-template>
    </div>
  `,
})
export class ListHeader {
  readonly title = input.required<string>();
  readonly taskCount = input(0);
  readonly canMoveLeft = input(false);
  readonly canMoveRight = input(false);
  readonly updateTitle = output<string>();
  readonly deleteList = output<void>();
  readonly moveLeft = output<void>();
  readonly moveRight = output<void>();

  protected readonly editing = signal(false);
  protected readonly draft = signal('');

  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  constructor() {
    effect(() => {
      if (this.editing()) {
        this.titleInput()?.nativeElement.focus();
        this.titleInput()?.nativeElement.select();
      }
    });
  }

  protected startEditing(): void {
    this.draft.set(this.title());
    this.editing.set(true);
  }

  protected commit(): void {
    if (!this.editing()) return;
    const trimmed = this.draft().trim();
    if (trimmed && trimmed !== this.title()) {
      this.updateTitle.emit(trimmed);
    }
    this.editing.set(false);
  }

  protected cancel(): void {
    this.editing.set(false);
  }
}
