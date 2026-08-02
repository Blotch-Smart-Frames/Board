import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideSmile, lucideX } from '@ng-icons/lucide';
import type { BrnOverlayState } from '@spartan-ng/brain/overlay';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { EMOJI_CATEGORIES, EMOJIS, type Emoji, type EmojiCategoryId } from './emoji-data';

interface EmojiGroup {
  readonly category: EmojiCategoryId;
  readonly label: string;
  readonly items: readonly Emoji[];
}

@Component({
  selector: 'app-emoji-picker',
  imports: [HlmPopoverImports, HlmButton, HlmInput, NgIcon],
  providers: [provideIcons({ lucideSearch, lucideSmile, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-popover [state]="state()" (stateChanged)="onStateChange($event)">
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
        <div class="border-border relative border-b p-2">
          <ng-icon
            name="lucideSearch"
            class="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm"
          />
          <input
            hlmInput
            type="search"
            autocomplete="off"
            placeholder="Search emojis"
            aria-label="Search emojis"
            class="h-8 w-full pl-7 text-sm"
            [value]="query()"
            (input)="onSearch($event)"
            (keydown.escape)="close()"
          />
        </div>

        <div class="max-h-64 overflow-y-auto p-2" role="listbox" aria-label="Emojis">
          @if (grouped().length === 0) {
            <p class="text-muted-foreground p-4 text-center text-sm">No emojis found</p>
          } @else {
            @for (group of grouped(); track group.category) {
              <div class="mb-3 last:mb-0">
                <p
                  class="text-muted-foreground bg-popover sticky -top-2 z-10 mb-1 py-0.5 text-xs font-medium"
                >
                  {{ group.label }}
                </p>
                <div class="grid grid-cols-8 gap-0.5">
                  @for (emoji of group.items; track emoji.char) {
                    <button
                      type="button"
                      role="option"
                      class="hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring flex size-8 items-center justify-center rounded-md text-lg leading-none transition-transform hover:scale-110 focus-visible:ring-1 focus-visible:outline-none"
                      [class.ring-foreground]="emoji.char === value()"
                      [class.ring-2]="emoji.char === value()"
                      [attr.aria-label]="emoji.name"
                      [attr.aria-selected]="emoji.char === value()"
                      (click)="select(emoji.char)"
                    >
                      {{ emoji.char }}
                    </button>
                  }
                </div>
              </div>
            }
          }
        </div>

        @if (value()) {
          <div class="border-border border-t p-2">
            <button
              hlmBtn
              type="button"
              variant="ghost"
              size="sm"
              class="text-muted-foreground w-full justify-start"
              (click)="select('')"
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

  protected readonly query = signal('');
  protected readonly state = signal<BrnOverlayState | null>(null);

  private readonly filtered = computed<readonly Emoji[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return EMOJIS;
    return EMOJIS.filter(
      (e) => e.name.toLowerCase().includes(q) || e.keywords.some((k) => k.includes(q)),
    );
  });

  protected readonly grouped = computed<readonly EmojiGroup[]>(() => {
    const list = this.filtered();
    const groups: EmojiGroup[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      const items = list.filter((e) => e.category === cat.id);
      if (items.length > 0) {
        groups.push({ category: cat.id, label: cat.label, items });
      }
    }
    return groups;
  });

  protected onStateChange(state: BrnOverlayState): void {
    this.state.set(state);
    if (state === 'closed') this.query.set('');
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected select(char: string): void {
    this.valueChange.emit(char);
    this.state.set('closed');
  }

  protected close(): void {
    this.state.set('closed');
  }
}
