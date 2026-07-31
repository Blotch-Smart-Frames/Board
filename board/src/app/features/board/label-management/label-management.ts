import { Component, inject, input, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucideTrash2, lucidePlus } from '@ng-icons/lucide';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { LabelChip } from '../../../shared/components/label-chip/label-chip';
import { LabelEditor } from '../label-editor/label-editor';
import { LabelService } from '../../../core/services/label.service';
import { compareOrder } from '../../../shared/utils/ordering';
import type { Label, CreateLabelInput } from '../../../shared/types/board';

@Component({
  selector: 'app-label-management',
  imports: [HlmDialogImports, HlmButton, NgIcon, LabelChip, LabelEditor],
  providers: [provideIcons({ lucidePencil, lucideTrash2, lucidePlus })],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content *hlmDialogPortal class="sm:max-w-md">
        <hlm-dialog-header>
          <h3 hlmDialogTitle>Manage Labels</h3>
        </hlm-dialog-header>

        <div class="flex max-h-[60vh] flex-col overflow-y-auto py-2">
          @if (sorted().length === 0) {
            <p class="text-muted-foreground py-8 text-center text-sm">No labels yet. Create one to get started.</p>
          }
          @for (label of sorted(); track label.id) {
            <div class="flex items-center justify-between gap-2 border-b py-2 last:border-b-0">
              <button type="button" class="min-w-0 flex-1 text-left" (click)="openEdit(label)">
                <app-label-chip [label]="label" />
              </button>
              <span class="flex shrink-0 gap-1">
                <button hlmBtn variant="ghost" size="icon" aria-label="Edit label" (click)="openEdit(label)">
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
              </span>
            </div>
          }
        </div>

        <hlm-dialog-footer class="sm:justify-start">
          <button hlmBtn variant="outline" class="w-full" (click)="openCreate()">
            <ng-icon name="lucidePlus" class="mr-2" />
            Create new label
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>

    <app-label-editor #editor [saveHandler]="saveHandler" />
  `,
})
export class LabelManagement {
  private readonly labelService = inject(LabelService);

  readonly boardId = input.required<string>();
  readonly labels = input<Label[]>([]);

  private readonly dialog = viewChild.required<HlmDialog>('dialog');
  private readonly editor = viewChild.required<LabelEditor>('editor');

  protected readonly deletingLabelId = signal<string | null>(null);
  private readonly editingLabel = signal<Label | null>(null);

  protected readonly sorted = () => [...this.labels()].sort((a, b) => compareOrder(a.order, b.order));

  open(): void {
    this.dialog().open();
  }

  protected openCreate(): void {
    this.editingLabel.set(null);
    this.editor().open(null);
  }

  protected openEdit(label: Label): void {
    this.editingLabel.set(label);
    this.editor().open(label);
  }

  protected readonly saveHandler = (data: CreateLabelInput): Promise<void> => {
    const editing = this.editingLabel();
    return editing
      ? this.labelService.updateLabel(this.boardId(), editing.id, data)
      : this.labelService.createLabel(this.boardId(), data).then(() => {});
  };

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
}
