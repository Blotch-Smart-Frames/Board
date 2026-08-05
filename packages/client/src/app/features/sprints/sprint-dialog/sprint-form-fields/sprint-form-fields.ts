import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { form, submit, required, validate, FormField } from '@angular/forms/signals';
import { Timestamp } from 'firebase/firestore';
import { HlmCalendarRange } from '@spartan-ng/helm/calendar';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { PreviewBackdrop } from '../../../../shared/components/preview-backdrop/preview-backdrop';
import { SprintListItem } from '../../../board/task-detail/sprint/sprint-list-item';
import type { Sprint } from '../../../../shared/types/board';

export type SprintFormModel = {
  name: string;
  startDate: Date | null;
  endDate: Date | null;
};

export const EMPTY_SPRINT_FORM: SprintFormModel = {
  name: '',
  startDate: null,
  endDate: null,
};

@Component({
  selector: 'app-sprint-form-fields',
  imports: [
    HlmCalendarRange,
    HlmFieldImports,
    HlmInput,
    FormField,
    PreviewBackdrop,
    SprintListItem,
  ],
  template: `
    @if (previewSprint(); as sprint) {
      <app-preview-backdrop label="Preview">
        <div class="pointer-events-none" inert>
          <app-sprint-list-item [sprint]="sprint" />
        </div>
      </app-preview-backdrop>
    }

    <form hlmFieldGroup (submit)="$event.preventDefault(); submit.emit()">
      <div hlmField>
        <label hlmFieldLabel for="sprint-name">Sprint Name</label>
        <input
          hlmInput
          id="sprint-name"
          autocomplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
          [formField]="sprintForm.name"
          (keydown.escape)="escape.emit()"
        />
        @for (err of sprintForm.name().errors(); track err.kind) {
          <hlm-field-error forceShow>{{ err.message }}</hlm-field-error>
        }
      </div>

      <div hlmField>
        <span hlmFieldLabel>Start &amp; end date</span>
        <div class="flex">
          <!-- /* v8 ignore start -- template listener wrappers on host-directive outputs @preserve */ -->
          <hlm-calendar-range
            [startDate]="model().startDate ?? undefined"
            [endDate]="model().endDate ?? undefined"
            (startDateChange)="onStartDateChange($event)"
            (endDateChange)="onEndDateChange($event)"
          />
          <!-- /* v8 ignore stop -- @preserve */ -->
        </div>
        @for (err of sprintForm.startDate().errors(); track err.kind) {
          <hlm-field-error forceShow>{{ err.message }}</hlm-field-error>
        }
        @for (err of sprintForm.endDate().errors(); track err.kind) {
          <hlm-field-error forceShow>{{ err.message }}</hlm-field-error>
        }
      </div>

      @if (error()) {
        <hlm-field-error forceShow>{{ error() }}</hlm-field-error>
      }
    </form>
  `,
})
export class SprintFormFields {
  readonly initialValue = input<SprintFormModel>(EMPTY_SPRINT_FORM);
  readonly error = input<string | null>(null);
  readonly escape = output<void>();
  readonly submit = output<void>();

  // Reset the local model whenever the parent supplies a new initialValue
  // (e.g. when the dialog is reopened for a different sprint or when async
  // create-mode defaults arrive). Free-form user edits within a single session
  // are preserved because the source is only the incoming input, not the model
  // itself.
  protected readonly model = linkedSignal<SprintFormModel, SprintFormModel>({
    source: this.initialValue,
    computation: (value) => value,
  });

  protected readonly sprintForm = form(this.model, (path) => {
    required(path.name, { message: 'Name is required' });
    required(path.startDate, { message: 'Start date is required' });
    required(path.endDate, { message: 'End date is required' });
    validate(path.endDate, ({ value, valueOf }) => {
      const end = value();
      const start = valueOf(path.startDate);
      if (end && start && end < start) {
        return { kind: 'dateOrder', message: 'End date must be on or after the start date' };
      }
      return undefined;
    });
  });

  protected readonly previewSprint = computed<Sprint | null>(() => {
    const v = this.model();
    const name = v.name.trim();
    if (!name || !v.startDate || !v.endDate) return null;
    const now = Timestamp.now();
    return {
      id: '__preview__',
      name,
      startDate: Timestamp.fromDate(v.startDate),
      endDate: Timestamp.fromDate(v.endDate),
      order: '',
      createdAt: now,
      updatedAt: now,
    };
  });

  readonly value = this.model.asReadonly();
  readonly invalid = computed(() => this.sprintForm().invalid());

  protected onStartDateChange(date: Date | undefined): void {
    this.model.update((m) => ({ ...m, startDate: date ?? null }));
  }

  protected onEndDateChange(date: Date | undefined): void {
    this.model.update((m) => ({ ...m, endDate: date ?? null }));
  }

  async submitWith(fn: (value: SprintFormModel) => Promise<void>): Promise<void> {
    await submit(this.sprintForm, async () => {
      await fn(this.model());
    });
  }
}
