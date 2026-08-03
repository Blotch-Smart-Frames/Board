import { Component, input, output } from '@angular/core';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmSelectImports } from '@spartan-ng/helm/select';

type ListOption = { readonly id: string; readonly title: string };

/**
 * "Move this task to another list" select. Only rendered by the parent when
 * the board has any lists; hides itself from tab-order otherwise.
 */
@Component({
  selector: 'app-task-list-select',
  imports: [HlmFieldImports, HlmSelectImports],
  template: `
    <div hlmField>
      <label hlmFieldLabel for="detail-list-trigger">List</label>
      <hlm-select
        [value]="value()"
        [itemToString]="idToTitle"
        (valueChange)="onValueChange($event)"
      >
        <hlm-select-trigger [buttonId]="'detail-list-trigger'" class="w-full">
          <hlm-select-value />
        </hlm-select-trigger>
        <hlm-select-content *hlmSelectPortal>
          @for (list of lists(); track list.id) {
            <hlm-select-item [value]="list.id">{{ list.title }}</hlm-select-item>
          }
        </hlm-select-content>
      </hlm-select>
    </div>
  `,
})
export class TaskListSelect {
  readonly value = input.required<string>();
  readonly lists = input.required<ListOption[]>();
  readonly listMove = output<string>();

  protected onValueChange(value: unknown): void {
    if (typeof value !== 'string' || !value) return;
    this.listMove.emit(value);
  }

  protected readonly idToTitle = (id: string): string =>
    this.lists().find((l) => l.id === id)?.title ?? '';
}
