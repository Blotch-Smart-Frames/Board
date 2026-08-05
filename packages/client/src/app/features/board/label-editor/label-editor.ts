import { Component, input, signal, viewChild } from '@angular/core';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import {
  EMPTY_LABEL_FORM,
  LabelFormFields,
  type LabelFormModel,
} from './label-form-fields/label-form-fields';
import type { Label, CreateLabelInput } from '../../../shared/types/board';

@Component({
  selector: 'app-label-editor',
  imports: [HlmDialogImports, HlmButton, HlmSpinner, LabelFormFields],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content *hlmDialogPortal class="min-w-sm sm:max-w-sm">
        <hlm-dialog-header>
          <h3 hlmDialogTitle>{{ editing() ? 'Edit Label' : 'Create Label' }}</h3>
        </hlm-dialog-header>

        <app-label-form-fields
          #formFields
          [initialValue]="initialValue()"
          [error]="error()"
          (escape)="close()"
          (submit)="save()"
        />

        <hlm-dialog-footer>
          <button hlmBtn variant="outline" type="button" [disabled]="saving()" (click)="close()">
            Cancel
          </button>
          <button
            hlmBtn
            type="button"
            [disabled]="formFields.invalid() || saving()"
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
  private readonly formFields = viewChild.required<LabelFormFields>('formFields');

  protected readonly editing = signal<Label | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly initialValue = signal<LabelFormModel>(EMPTY_LABEL_FORM);

  open(label: Label | null = null): void {
    this.editing.set(label);
    this.error.set(null);
    this.initialValue.set(
      label
        ? {
            name: label.name,
            emoji: label.emoji ?? '',
            /* v8 ignore next -- defensive: label.color is always set on stored labels @preserve */
            color: label.color ?? EMPTY_LABEL_FORM.color,
          }
        : EMPTY_LABEL_FORM,
    );
    this.dialog().open();
  }

  close(): void {
    this.dialog().close(undefined);
    this.saving.set(false);
  }

  protected async save(): Promise<void> {
    await this.formFields().submitWith(async (v) => {
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
