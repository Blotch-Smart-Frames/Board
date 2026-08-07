import { Component, computed, input, output } from '@angular/core';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { compareOrder } from '../../../../shared/utils/ordering';
import type { List } from '../../../../shared/types/board';

/**
 * Multi-select for choosing which of the board's lists act as archives. Picks
 * from the board's actual lists (rather than free-text) and emits list IDs, so
 * the configuration survives list renames and can't drift from a typo. Selected
 * lists render as chips, mirroring the label-filter multi-select pattern.
 */
@Component({
  selector: 'app-archival-lists-field',
  imports: [HlmSelectImports, HlmBadge],
  template: `
    <hlm-select-multiple [value]="selectedListIds()" (valueChange)="onValueChange($event)">
      <hlm-select-trigger class="w-full">
        <hlm-select-placeholder>Select lists that archive tasks</hlm-select-placeholder>
        <ng-template hlmSelectValues>
          <hlm-select-values-content class="flex-wrap gap-1">
            @for (list of selectedLists(); track list.id) {
              <span hlmBadge>{{ list.title }}</span>
            }
          </hlm-select-values-content>
        </ng-template>
      </hlm-select-trigger>
      <hlm-select-content *hlmSelectPortal class="w-64">
        @if (sorted().length === 0) {
          <p class="text-muted-foreground p-2 text-sm">No lists yet</p>
        }
        <hlm-select-group>
          @for (list of sorted(); track list.id) {
            <hlm-select-item [value]="list.id">{{ list.title }}</hlm-select-item>
          }
        </hlm-select-group>
      </hlm-select-content>
    </hlm-select-multiple>
  `,
})
export class ArchivalListsField {
  readonly lists = input.required<List[]>();
  readonly selectedListIds = input<string[]>([]);
  readonly selectedListIdsChange = output<string[]>();

  protected readonly sorted = computed(() =>
    [...this.lists()].sort((a, b) => compareOrder(a.order, b.order)),
  );
  protected readonly selectedLists = computed(() =>
    this.lists().filter((l) => this.selectedListIds().includes(l.id)),
  );

  protected onValueChange(value: unknown): void {
    if (!Array.isArray(value)) return;
    this.selectedListIdsChange.emit(value.filter((v): v is string => typeof v === 'string'));
  }
}
