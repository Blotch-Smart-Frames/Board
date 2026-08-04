import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucidePencil, lucideTrash2 } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { LabelChip } from '../../../shared/components/label-chip/label-chip';
import { LabelEditor } from '../label-editor/label-editor';
import { LabelService } from '../../../core/services/label.service';
import { compareOrder } from '../../../shared/utils/ordering';
import type { Label, CreateLabelInput } from '../../../shared/types/board';

@Component({
  selector: 'app-label-picker',
  imports: [HlmButton, HlmCheckbox, NgIcon, LabelChip, LabelEditor],
  providers: [provideIcons({ lucidePlus, lucidePencil, lucideTrash2 })],
  template: `
    <div>
      @if (sorted().length > 0) {
        <div class="mb-2 flex flex-col gap-1">
          @for (label of sorted(); track label.id) {
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="hover:bg-accent flex flex-1 items-center gap-2 rounded px-1 py-1 text-left transition-opacity"
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
              <button
                hlmBtn
                variant="ghost"
                size="icon"
                aria-label="Edit label"
                (click)="openEdit(label)"
              >
                <ng-icon name="lucidePencil" />
              </button>
              <button
                hlmBtn
                variant="ghost"
                size="icon"
                aria-label="Delete label"
                [disabled]="deletingLabelId() === label.id"
                (click)="remove(label.id)"
              >
                <ng-icon name="lucideTrash2" />
              </button>
            </div>
          }
        </div>
      }

      <button hlmBtn variant="ghost" size="sm" type="button" (click)="openCreate()">
        <ng-icon name="lucidePlus" class="mr-2" />
        Create label
      </button>
    </div>

    <app-label-editor #editor [saveHandler]="saveHandler" />
  `,
})
export class LabelPicker {
  private readonly labelService = inject(LabelService);

  readonly boardId = input.required<string>();
  readonly labels = input.required<Label[]>();
  readonly selectedLabelIds = input<string[]>([]);
  readonly selectedLabelIdsChange = output<string[]>();

  private readonly editor = viewChild.required<LabelEditor>('editor');

  protected readonly deletingLabelId = signal<string | null>(null);
  private readonly editingLabel = signal<Label | null>(null);

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

  protected openCreate(): void {
    this.editingLabel.set(null);
    this.editor().open(null);
  }

  protected openEdit(label: Label): void {
    this.editingLabel.set(label);
    this.editor().open(label);
  }

  protected async remove(labelId: string): Promise<void> {
    this.deletingLabelId.set(labelId);
    try {
      await this.labelService.deleteLabel(this.boardId(), labelId);
    } catch (err) {
      console.error('Failed to delete label:', err);
    } finally {
      this.deletingLabelId.set(null);
    }
  }

  protected readonly saveHandler = (data: CreateLabelInput): Promise<void> => {
    const editing = this.editingLabel();
    return editing
      ? this.labelService.updateLabel(this.boardId(), editing.id, data)
      : this.labelService.createLabel(this.boardId(), data).then(() => {});
  };
}
