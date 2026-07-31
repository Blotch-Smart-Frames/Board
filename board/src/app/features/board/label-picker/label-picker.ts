import { Component, computed, inject, input, output, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSettings, lucidePlus } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { LabelChip } from '../../../shared/components/label-chip/label-chip';
import { LabelEditor } from '../label-editor/label-editor';
import { LabelManagement } from '../label-management/label-management';
import { LabelService } from '../../../core/services/label.service';
import { compareOrder } from '../../../shared/utils/ordering';
import type { Label, CreateLabelInput } from '../../../shared/types/board';

@Component({
  selector: 'app-label-picker',
  imports: [HlmButton, HlmCheckbox, NgIcon, LabelChip, LabelEditor, LabelManagement],
  providers: [provideIcons({ lucideSettings, lucidePlus })],
  template: `
    <div>
      <div class="mb-2 flex items-center justify-between">
        <button hlmBtn variant="ghost" size="sm" type="button" (click)="openManagement()">
          <ng-icon name="lucideSettings" class="mr-2" />
          Manage
        </button>
      </div>

      @if (sorted().length > 0) {
        <div class="mb-2 flex flex-col gap-1">
          @for (label of sorted(); track label.id) {
            <button
              type="button"
              class="hover:bg-accent flex items-center gap-2 rounded px-1 py-1 text-left transition-opacity"
              [class.opacity-60]="!isSelected(label.id)"
              (click)="toggle(label.id)"
            >
              <hlm-checkbox
                [checked]="isSelected(label.id)"
                class="pointer-events-none"
                [aria-label]="'Toggle label ' + label.name"
              />
              <app-label-chip [label]="label" />
            </button>
          }
        </div>
      }

      <button hlmBtn variant="ghost" size="sm" type="button" (click)="openCreate()">
        <ng-icon name="lucidePlus" class="mr-2" />
        Create label
      </button>
    </div>

    <app-label-editor #editor [saveHandler]="createHandler" />
    <app-label-management #management [boardId]="boardId()" [labels]="labels()" />
  `,
})
export class LabelPicker {
  private readonly labelService = inject(LabelService);

  readonly boardId = input.required<string>();
  readonly labels = input.required<Label[]>();
  readonly selectedLabelIds = input<string[]>([]);
  readonly selectedLabelIdsChange = output<string[]>();

  private readonly editor = viewChild.required<LabelEditor>('editor');
  private readonly management = viewChild.required<LabelManagement>('management');

  protected readonly sorted = computed(() =>
    [...this.labels()].sort((a, b) => compareOrder(a.order, b.order)),
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

  protected openManagement(): void {
    this.management().open();
  }

  protected openCreate(): void {
    this.editor().open(null);
  }

  protected readonly createHandler = (data: CreateLabelInput): Promise<void> =>
    this.labelService.createLabel(this.boardId(), data).then(() => {});
}
