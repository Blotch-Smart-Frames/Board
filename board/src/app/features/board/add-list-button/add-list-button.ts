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
          <button hlmBtn size="sm" [disabled]="!draft().trim()" (mousedown)="$event.preventDefault()" (click)="add()">
            Add list
          </button>
          <button hlmBtn size="sm" variant="ghost" (mousedown)="$event.preventDefault()" (click)="cancel()">
            Cancel
          </button>
        </div>
      </div>
    } @else {
      <button
        hlmBtn
        variant="secondary"
        class="bg-background/40 hover:bg-background/60 w-72 shrink-0 justify-start"
        (click)="startAdding()"
      >
        <ng-icon name="lucidePlus" class="mr-2" />
        Add another list
      </button>
    }
  `,
})
export class AddListButton {
  readonly listAdded = output<string>();

  protected readonly adding = signal(false);
  protected readonly draft = signal('');

  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

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
