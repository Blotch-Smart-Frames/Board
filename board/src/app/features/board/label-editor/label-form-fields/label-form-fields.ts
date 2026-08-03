import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { form, submit, required, FormField } from '@angular/forms/signals';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { ColorPicker } from '../../../../shared/components/color-picker/color-picker';
import { EmojiPicker } from '../../../../shared/components/emoji-picker/emoji-picker';
import {
  LabelChip,
  type LabelChipInput,
} from '../../../../shared/components/label-chip/label-chip';
import { PreviewBackdrop } from '../../../../shared/components/preview-backdrop/preview-backdrop';
import { labelColors } from '../../../../core/config/default-labels';

export type LabelFormModel = {
  name: string;
  emoji: string;
  color: string;
};

export const EMPTY_LABEL_FORM: LabelFormModel = {
  name: '',
  emoji: '',
  color: labelColors[0],
};

@Component({
  selector: 'app-label-form-fields',
  imports: [
    HlmFieldImports,
    HlmInput,
    ColorPicker,
    EmojiPicker,
    LabelChip,
    PreviewBackdrop,
    FormField,
  ],
  template: `
    <form hlmFieldGroup class="py-2" (submit)="$event.preventDefault(); submit.emit()">
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
          (keydown.escape)="escape.emit()"
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
  `,
})
export class LabelFormFields {
  readonly initialValue = input<LabelFormModel>(EMPTY_LABEL_FORM);
  readonly error = input<string | null>(null);
  readonly escape = output<void>();
  readonly submit = output<void>();

  // Reset the local model when the parent supplies a new initialValue (e.g.
  // reopened for a different label). Free-form user edits within a session
  // are preserved because the source is only the incoming input.
  protected readonly model = linkedSignal<LabelFormModel, LabelFormModel>({
    source: this.initialValue,
    computation: (value) => value,
  });

  protected readonly labelForm = form(this.model, (path) => {
    required(path.name, { message: 'Name is required' });
  });

  protected readonly previewLabel = computed<LabelChipInput>(() => ({
    name: this.model().name || 'Label',
    color: this.model().color,
    emoji: this.model().emoji || undefined,
  }));

  readonly value = this.model.asReadonly();
  readonly invalid = computed(() => this.labelForm().invalid());

  protected setColor(color: string): void {
    this.model.update((m) => ({ ...m, color }));
  }

  protected setEmoji(emoji: string): void {
    this.model.update((m) => ({ ...m, emoji }));
  }

  async submitWith(fn: (value: LabelFormModel) => Promise<void>): Promise<void> {
    await submit(this.labelForm, async () => {
      await fn(this.model());
    });
  }
}
