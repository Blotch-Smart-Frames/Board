import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { LabelChip } from '../../../shared/components/label-chip/label-chip';
import { compareOrder } from '../../../shared/utils/ordering';
import type { Label } from '../../../shared/types/board';

@Component({
  selector: 'app-label-filter',
  imports: [HlmPopoverImports, HlmButton, HlmCheckbox, NgIcon, LabelChip],
  providers: [provideIcons({ lucideChevronDown })],
  template: `
    <hlm-popover>
      <button type="button" hlmPopoverTrigger hlmBtn variant="outline" class="min-w-[10rem] justify-between gap-2">
        @if (selectedLabels().length > 0) {
          <span class="flex flex-wrap items-center gap-1">
            @for (label of selectedLabels(); track label.id) {
              <app-label-chip [label]="label" />
            }
          </span>
        } @else {
          <span class="text-muted-foreground">Filter by label</span>
        }
        <ng-icon name="lucideChevronDown" class="shrink-0" />
      </button>

      <hlm-popover-content *hlmPopoverPortal class="w-64" align="start">
        @if (sorted().length === 0) {
          <p class="text-muted-foreground text-sm">No labels yet</p>
        }
        @for (label of sorted(); track label.id) {
          <button
            type="button"
            class="hover:bg-accent flex w-full items-center gap-2 rounded px-1 py-1 text-left transition-opacity"
            [class.opacity-60]="!isSelected(label.id)"
            (click)="toggle(label.id)"
          >
            <hlm-checkbox [checked]="isSelected(label.id)" class="pointer-events-none" [aria-label]="'Toggle label ' + label.name" />
            <app-label-chip [label]="label" />
          </button>
        }
      </hlm-popover-content>
    </hlm-popover>
  `,
})
export class LabelFilter {
  readonly labels = input.required<Label[]>();
  readonly selectedLabelIds = input<string[]>([]);
  readonly selectedLabelIdsChange = output<string[]>();

  protected readonly sorted = computed(() => [...this.labels()].sort((a, b) => compareOrder(a.order, b.order)));
  protected readonly selectedLabels = computed(() =>
    this.labels().filter((l) => this.selectedLabelIds().includes(l.id)),
  );

  protected isSelected(labelId: string): boolean {
    return this.selectedLabelIds().includes(labelId);
  }

  protected toggle(labelId: string): void {
    const current = this.selectedLabelIds();
    this.selectedLabelIdsChange.emit(
      current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId],
    );
  }
}
