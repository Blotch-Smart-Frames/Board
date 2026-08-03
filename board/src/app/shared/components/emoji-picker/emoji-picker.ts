import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSmile, lucideX } from '@ng-icons/lucide';
import type { BrnOverlayState } from '@spartan-ng/brain/overlay';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { EmojiGrid } from './emoji-grid/emoji-grid';

@Component({
  selector: 'app-emoji-picker',
  imports: [HlmPopoverImports, HlmButton, NgIcon, EmojiGrid],
  providers: [provideIcons({ lucideSmile, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-popover [state]="state()" (stateChanged)="state.set($event)">
      <button
        hlmBtn
        variant="outline"
        type="button"
        hlmPopoverTrigger
        [attr.id]="buttonId() || null"
        class="w-full justify-start gap-2 font-normal"
      >
        @if (value(); as v) {
          <span class="text-lg leading-none" aria-hidden="true">{{ v }}</span>
          <span>Change emoji</span>
        } @else {
          <ng-icon name="lucideSmile" class="text-muted-foreground" />
          <span class="text-muted-foreground">Pick an emoji</span>
        }
      </button>

      <hlm-popover-content *hlmPopoverPortal class="flex w-72 flex-col gap-0 overflow-hidden p-0">
        <app-emoji-grid [value]="value()" (select)="onSelect($event)" (escape)="close()" />

        @if (value()) {
          <div class="border-border border-t p-2">
            <button
              hlmBtn
              type="button"
              variant="ghost"
              size="sm"
              class="text-muted-foreground w-full justify-start"
              (click)="onSelect('')"
            >
              <ng-icon name="lucideX" />
              Remove emoji
            </button>
          </div>
        }
      </hlm-popover-content>
    </hlm-popover>
  `,
})
export class EmojiPicker {
  readonly value = input<string>('');
  readonly buttonId = input<string>('');
  readonly valueChange = output<string>();

  protected readonly state = signal<BrnOverlayState | null>(null);

  protected onSelect(char: string): void {
    this.valueChange.emit(char);
    this.state.set('closed');
  }

  protected close(): void {
    this.state.set('closed');
  }
}
