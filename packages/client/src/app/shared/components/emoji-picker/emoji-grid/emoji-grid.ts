import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { HlmInput } from '@spartan-ng/helm/input';
import { EMOJI_CATEGORIES, EMOJIS, type Emoji, type EmojiCategoryId } from '../emoji-data';

interface EmojiGroup {
  readonly category: EmojiCategoryId;
  readonly label: string;
  readonly items: readonly Emoji[];
}

/**
 * Search + grouped grid of pickable emojis. Owns its own query signal so the
 * parent trigger only needs to consume selection events. The grid is portal-
 * rendered inside a popover, so it's recreated on each open — no need for
 * explicit query resetting.
 */
@Component({
  selector: 'app-emoji-grid',
  imports: [HlmInput, NgIcon],
  providers: [provideIcons({ lucideSearch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
        (keydown.escape)="escape.emit()"
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
                  (click)="select.emit(emoji.char)"
                >
                  {{ emoji.char }}
                </button>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class EmojiGrid {
  readonly value = input<string>('');
  readonly select = output<string>();
  readonly escape = output<void>();

  protected readonly query = signal('');

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

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
