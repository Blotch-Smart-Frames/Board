import { Component, input } from '@angular/core';

@Component({
  selector: 'app-board-background',
  template: `
    <div
      class="relative flex h-full flex-col"
      [style.background-image]="backgroundStyle()"
      [class.bg-cover]="imageUrl()"
      [class.bg-center]="imageUrl()"
    >
      @if (imageUrl()) {
        <div class="pointer-events-none absolute inset-0 bg-black/30"></div>
      }
      <div class="relative flex flex-1 flex-col overflow-hidden">
        <ng-content />
      </div>
    </div>
  `,
})
export class BoardBackground {
  readonly imageUrl = input<string | undefined>(undefined);

  protected backgroundStyle(): string | null {
    const url = this.imageUrl();
    return url ? `url("${url}")` : null;
  }
}
