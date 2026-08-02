import { Component, computed, input, signal, viewChild } from '@angular/core';
import { form, submit, required, FormField } from '@angular/forms/signals';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { ColorPicker } from '../../../shared/components/color-picker/color-picker';
import { EmojiPicker } from '../../../shared/components/emoji-picker/emoji-picker';
import { LabelChip, type LabelChipInput } from '../../../shared/components/label-chip/label-chip';
import { PreviewBackdrop } from '../../../shared/components/preview-backdrop/preview-backdrop';
import { labelColors } from '../../../core/config/default-labels';
import type { Label, CreateLabelInput } from '../../../shared/types/board';

type LabelFormModel = {
  name: string;
  emoji: string;
  color: string;
};

@Component({
  selector: 'app-label-editor',
  imports: [
    HlmDialogImports,
    HlmFieldImports,
    HlmButton,
    HlmInput,
    HlmSpinner,
    ColorPicker,
    EmojiPicker,
    LabelChip,
    PreviewBackdrop,
    FormField,
  ],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content *hlmDialogPortal class="min-w-sm sm:max-w-sm">
        <hlm-dialog-header>
          <h3 hlmDialogTitle>{{ editing() ? 'Edit Label' : 'Create Label' }}</h3>
        </hlm-dialog-header>

        <form hlmFieldGroup class="py-2" (submit)="$event.preventDefault(); save()">
          <app-preview-backdrop>
            <app-label-chip [label]="previewLabel()" />
          </app-preview-backdrop>

          <div hlmField>
            <label hlmFieldLabel for="label-name">Name</label>
            <input
              hlmInput
              id="label-name"
              autocomplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              data-bwignore="true"
              data-form-type="other"
              [formField]="labelForm.name"
              (keydown.escape)="close()"
            />
            @for (err of labelForm.name().errors(); track err.kind) {
              <hlm-field-error forceShow>{{ err.message }}</hlm-field-error>
            }
          </div>

          <div hlmField>
            <label hlmFieldLabel for="label-emoji">Emoji (optional)</label>
            <app-emoji-picker
              buttonId="label-emoji"
              [value]="model().emoji"
              (valueChange)="setEmoji($event)"
            />
          </div>

          <div hlmField>
            <span hlmFieldLabel>Color</span>
            <app-color-picker [value]="model().color" (valueChange)="setColor($event)" />
          </div>

          @if (error()) {
            <hlm-field-error forceShow>{{ error() }}</hlm-field-error>
          }
        </form>

        <hlm-dialog-footer>
          <button hlmBtn variant="outline" type="button" [disabled]="saving()" (click)="close()">
            Cancel
          </button>
          <button
            hlmBtn
            type="button"
            [disabled]="labelForm().invalid() || saving()"
            (click)="save()"
          >
            @if (saving()) {
              <hlm-spinner class="size-4" />
            } @else {
              {{ editing() ? 'Save' : 'Create' }}
            }
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class LabelEditor {
  readonly saveHandler = input.required<(data: CreateLabelInput) => Promise<void>>();

  private readonly dialog = viewChild.required<HlmDialog>('dialog');

  protected readonly editing = signal<Label | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly model = signal<LabelFormModel>({
    name: '',
    emoji: '',
    color: labelColors[0],
  });

  protected readonly labelForm = form(this.model, (path) => {
    required(path.name, { message: 'Name is required' });
  });

  protected readonly previewLabel = computed<LabelChipInput>(() => ({
    name: this.model().name || 'Label',
    color: this.model().color,
    emoji: this.model().emoji || undefined,
  }));

  open(label: Label | null = null): void {
    this.editing.set(label);
    this.error.set(null);
    this.model.set({
      name: label?.name ?? '',
      emoji: label?.emoji ?? '',
      color: label?.color ?? labelColors[0],
    });
    this.dialog().open();
  }

  close(): void {
    this.dialog().close(undefined);
    this.saving.set(false);
  }

  protected setColor(color: string): void {
    this.model.update((m) => ({ ...m, color }));
  }

  protected setEmoji(emoji: string): void {
    this.model.update((m) => ({ ...m, emoji }));
  }

  protected async save(): Promise<void> {
    await submit(this.labelForm, async () => {
      const v = this.model();
      const data: CreateLabelInput = {
        name: v.name.trim(),
        color: v.color,
        emoji: v.emoji.trim() || undefined,
      };

      this.error.set(null);
      this.saving.set(true);
      try {
        await this.saveHandler()(data);
        this.close();
      } catch (err) {
        console.error('Label save failed:', err);
        this.error.set('Something went wrong. Please try again.');
      } finally {
        this.saving.set(false);
      }
    });
  }
}
