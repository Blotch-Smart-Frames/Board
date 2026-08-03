import { Component, computed, input, output } from '@angular/core';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { LabelChip } from '../../../shared/components/label-chip/label-chip';
import { compareOrder } from '../../../shared/utils/ordering';
import type { Label } from '../../../shared/types/board';

@Component({
  selector: 'app-label-filter',
  imports: [HlmSelectImports, LabelChip],
  template: `
    <hlm-select-multiple [value]="selectedLabelIds()" (valueChange)="onValueChange($event)">
      <hlm-select-trigger class="min-w-40">
        <hlm-select-placeholder>Filter by label</hlm-select-placeholder>
        <ng-template hlmSelectValues>
          <hlm-select-values-content class="flex-wrap gap-1">
            @for (label of selectedLabels(); track label.id) {
              <app-label-chip [label]="label" />
            }
          </hlm-select-values-content>
        </ng-template>
      </hlm-select-trigger>
      <hlm-select-content *hlmSelectPortal class="w-64">
        @if (sorted().length === 0) {
          <p class="text-muted-foreground p-2 text-sm">No labels yet</p>
        }
        <hlm-select-group>
          @for (label of sorted(); track label.id) {
            <hlm-select-item [value]="label.id">
              <app-label-chip [label]="label" />
            </hlm-select-item>
          }
        </hlm-select-group>
      </hlm-select-content>
    </hlm-select-multiple>
  `,
})
export class LabelFilter {
  readonly labels = input.required<Label[]>();
  readonly selectedLabelIds = input<string[]>([]);
  readonly selectedLabelIdsChange = output<string[]>();

  protected readonly sorted = computed(() =>
    [...this.labels()].sort((a, b) => compareOrder(a.order, b.order)),
  );
  protected readonly selectedLabels = computed(() =>
    this.labels().filter((l) => this.selectedLabelIds().includes(l.id)),
  );

  protected onValueChange(value: unknown): void {
    if (!Array.isArray(value)) return;
    this.selectedLabelIdsChange.emit(value.filter((v): v is string => typeof v === 'string'));
  }
}
