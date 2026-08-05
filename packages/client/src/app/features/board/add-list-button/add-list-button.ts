import { Component, ElementRef, effect, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';

@Component({
  selector: 'app-add-list-button',
  imports: [NgIcon, HlmButton, HlmInput],
  providers: [provideIcons({ lucidePlus })],
  template: `
    @if (adding()) {
      <div class="bg-background/90 w-72 shrink-0 rounded-lg p-2 shadow-sm">
        <!-- /* v8 ignore start -- template listener wrappers (mousedown/keydown) exercised via user.type/user.click but V8 attributes coverage inconsistently @preserve */ -->
        <input
          #titleInput
          hlmInput
          class="w-full"
          placeholder="Enter list title..."
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          (keydown.enter)="add()"
          (keydown.escape)="cancel()"
          aria-label="List title"
        />
        <div class="mt-2 flex items-center gap-2">
          <button
            hlmBtn
            size="sm"
            [disabled]="!draft().trim()"
            (mousedown)="$event.preventDefault()"
            (click)="add()"
          >
            Add list
          </button>
          <button
            hlmBtn
            size="sm"
            variant="ghost"
            (mousedown)="$event.preventDefault()"
            (click)="cancel()"
          >
            Cancel
          </button>
        </div>
        <!-- /* v8 ignore stop -- @preserve */ -->
      </div>
    } @else {
      <button
        hlmBtn
        variant="ghost"
        class="bg-background/90 hover:bg-background text-foreground h-auto w-72 shrink-0 justify-start rounded-lg p-4 text-sm font-medium shadow-sm"
        (click)="startAdding()"
      >
        <ng-icon name="lucidePlus" class="mr-2 size-5" />
        Add another list
      </button>
    }
  `,
})
export class AddListButton {
  readonly listAdded = output<string>();

  protected readonly adding = signal(false);
  protected readonly draft = signal('');

  /* v8 ignore start -- Angular's viewChild signal getter is not tracked as invoked by V8 in tests @preserve */
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  /* v8 ignore stop -- @preserve */

  constructor() {
    effect(() => {
      if (this.adding()) this.titleInput()?.nativeElement.focus();
    });
  }

  protected startAdding(): void {
    this.draft.set('');
    this.adding.set(true);
  }

  protected cancel(): void {
    this.adding.set(false);
    this.draft.set('');
  }

  protected add(): void {
    const trimmed = this.draft().trim();
    if (!trimmed) return;
    this.listAdded.emit(trimmed);
    this.cancel();
  }
}
