import { Component, input, output } from '@angular/core';
import { HlmComboboxImports } from '@spartan-ng/helm/combobox';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import type { BoardWithOrder } from '../../../../boards/data/user-boards.store';

@Component({
  selector: 'app-migrate-board-picker',
  imports: [HlmComboboxImports, HlmFieldImports],
  template: `
    <div hlmField>
      <label hlmFieldLabel for="migrate-board-trigger">Target board</label>

      <hlm-combobox
        [value]="value()"
        [itemToString]="idToTitle"
        (valueChange)="onValueChange($event)"
      >
        <hlm-combobox-trigger buttonId="migrate-board-trigger" class="w-full">
          <hlm-combobox-value placeholder="Select a board" />
        </hlm-combobox-trigger>
        <hlm-combobox-content *hlmComboboxPortal>
          <hlm-combobox-input placeholder="Search boards..." />
          <hlm-combobox-empty>No matching boards.</hlm-combobox-empty>
          <div hlmComboboxList>
            @for (board of boards(); track board.id) {
              <hlm-combobox-item [value]="board.id">{{ board.title }}</hlm-combobox-item>
            }
          </div>
        </hlm-combobox-content>
      </hlm-combobox>

      @if (boards().length === 0) {
        <p hlmFieldDescription>You need at least one other board to migrate a task.</p>
      }
    </div>
  `,
})
export class MigrateBoardPicker {
  readonly boards = input.required<BoardWithOrder[]>();
  readonly value = input<string | null>(null);
  readonly valueChange = output<string | null>();

  protected onValueChange(v: unknown): void {
    this.valueChange.emit(typeof v === 'string' ? v : null);
  }

  protected readonly idToTitle = (id: string): string =>
    this.boards().find((b) => b.id === id)?.title ?? '';
}
