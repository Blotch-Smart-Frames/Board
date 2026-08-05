import { Component, computed, inject, input, output } from '@angular/core';
import { collection, orderBy, query, type Query } from 'firebase/firestore';
import { HlmComboboxImports } from '@spartan-ng/helm/combobox';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { FIRESTORE_DB } from '../../../../../core/firebase/firebase.config';
import { collectionSignal } from '../../../../../core/interop/signal-interop';
import { compareOrder } from '../../../../../shared/utils/ordering';
import type { List } from '../../../../../shared/types/board';

@Component({
  selector: 'app-migrate-list-picker',
  imports: [HlmComboboxImports, HlmFieldImports],
  template: `
    <div hlmField>
      <label hlmFieldLabel for="migrate-list-trigger">Target list</label>

      <hlm-combobox
        [value]="value()"
        [itemToString]="idToTitle"
        [disabled]="!boardId() || loading()"
        (valueChange)="onValueChange($event)"
      >
        <hlm-combobox-trigger buttonId="migrate-list-trigger" class="w-full">
          <hlm-combobox-value [placeholder]="placeholder()" />
        </hlm-combobox-trigger>
        <hlm-combobox-content *hlmComboboxPortal>
          <hlm-combobox-input placeholder="Search lists..." />
          <hlm-combobox-empty>No matching lists.</hlm-combobox-empty>
          <div hlmComboboxList>
            @for (list of sortedLists(); track list.id) {
              <hlm-combobox-item [value]="list.id">{{ list.title }}</hlm-combobox-item>
            }
          </div>
        </hlm-combobox-content>
      </hlm-combobox>

      @if (boardId() && !loading() && sortedLists().length === 0) {
        <p hlmFieldDescription>That board has no lists — create one there first.</p>
      }
    </div>
  `,
})
export class MigrateListPicker {
  private readonly db = inject(FIRESTORE_DB);

  readonly boardId = input<string | null>(null);
  readonly value = input<string | null>(null);
  readonly valueChange = output<string | null>();

  private readonly listsQuery = computed<Query | null>(() => {
    const boardId = this.boardId();
    return boardId
      ? query(collection(this.db, 'boards', boardId, 'lists'), orderBy('order'))
      : null;
  });

  private readonly lists = collectionSignal<List>(() => this.listsQuery());

  protected readonly loading = computed(() => !!this.boardId() && this.lists() === undefined);

  protected readonly sortedLists = computed(() =>
    [...(this.lists() ?? [])].sort((a, b) => compareOrder(a.order, b.order)),
  );

  protected readonly placeholder = computed(() => {
    if (!this.boardId()) return 'Select a board first';
    if (this.loading()) return 'Loading lists...';
    return 'Select a list';
  });

  protected onValueChange(v: unknown): void {
    this.valueChange.emit(typeof v === 'string' ? v : null);
  }

  protected readonly idToTitle = (id: string): string =>
    /* v8 ignore next -- idToTitle only runs after a list is selected from the same list @preserve */
    this.sortedLists().find((l) => l.id === id)?.title ?? '';
}
