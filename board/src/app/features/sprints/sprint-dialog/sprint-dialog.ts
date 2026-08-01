import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { form, submit, required, validate, FormField } from '@angular/forms/signals';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCalendarRange } from '@spartan-ng/helm/calendar';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { SprintService } from '../../../core/services/sprint.service';
import type { Sprint, CreateSprintInput } from '../../../shared/types/board';

const DEFAULT_SPRINT_DURATION_DAYS = 14;

type SprintFormModel = {
  name: string;
  startDate: Date | null;
  endDate: Date | null;
};

@Component({
  selector: 'app-sprint-dialog',
  imports: [
    HlmDialogImports,
    HlmButton,
    HlmCalendarRange,
    HlmFieldImports,
    HlmInput,
    HlmSpinner,
    FormField,
  ],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content *hlmDialogPortal class="sm:max-w-md">
        <hlm-dialog-header>
          <h3 hlmDialogTitle>{{ editing() ? 'Edit Sprint' : 'Create Sprint' }}</h3>
        </hlm-dialog-header>

        @if (loadingDefaults()) {
          <div class="flex items-center justify-center py-8">
            <hlm-spinner class="size-6" />
          </div>
          <hlm-dialog-footer>
            <button hlmBtn variant="outline" type="button" (click)="close()">Cancel</button>
          </hlm-dialog-footer>
        } @else {
          <form hlmFieldGroup class="py-2" (submit)="$event.preventDefault(); save()">
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
                (keydown.escape)="close()"
              />
              @for (err of sprintForm.name().errors(); track err.kind) {
                <hlm-field-error forceShow>{{ err.message }}</hlm-field-error>
              }
            </div>

            <div hlmField>
              <span hlmFieldLabel>Start &amp; end date</span>
              <div class="flex justify-center">
                <hlm-calendar-range
                  [startDate]="model().startDate ?? undefined"
                  [endDate]="model().endDate ?? undefined"
                  (startDateChange)="onStartDateChange($event)"
                  (endDateChange)="onEndDateChange($event)"
                />
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

          <hlm-dialog-footer>
            <button hlmBtn variant="outline" type="button" [disabled]="saving()" (click)="close()">
              Cancel
            </button>
            <button
              hlmBtn
              type="button"
              [disabled]="sprintForm().invalid() || saving()"
              (click)="save()"
            >
              @if (saving()) {
                <hlm-spinner class="size-4" />
              } @else {
                {{ editing() ? 'Save' : 'Create' }}
              }
            </button>
          </hlm-dialog-footer>
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class SprintDialog {
  private readonly sprintService = inject(SprintService);

  readonly boardId = input.required<string>();
  readonly saveHandler = input.required<(data: CreateSprintInput) => Promise<void>>();

  private readonly dialog = viewChild.required<HlmDialog>('dialog');

  protected readonly editing = signal<Sprint | null>(null);
  protected readonly loadingDefaults = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly model = signal<SprintFormModel>({ name: '', startDate: null, endDate: null });

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

  async open(sprint: Sprint | null): Promise<void> {
    this.editing.set(sprint);
    this.error.set(null);

    if (sprint) {
      this.model.set({
        name: sprint.name,
        startDate: sprint.startDate.toDate(),
        endDate: sprint.endDate.toDate(),
      });
      this.loadingDefaults.set(false);
      this.dialog().open();
      return;
    }

    this.model.set({ name: '', startDate: null, endDate: null });
    this.loadingDefaults.set(true);
    this.dialog().open();
    try {
      const defaults = await this.sprintService.calculateNextSprintDates(this.boardId());
      this.model.set({
        name: defaults.suggestedName,
        startDate: defaults.startDate,
        endDate: defaults.endDate,
      });
    } catch (err) {
      console.error('Failed to calculate sprint defaults:', err);
    } finally {
      this.loadingDefaults.set(false);
    }
  }

  close(): void {
    this.dialog().close(undefined);
    this.saving.set(false);
  }

  protected onStartDateChange(date: Date | undefined): void {
    this.model.update((m) => ({ ...m, startDate: date ?? null }));
  }

  protected onEndDateChange(date: Date | undefined): void {
    this.model.update((m) => ({ ...m, endDate: date ?? null }));
  }

  protected async save(): Promise<void> {
    await submit(this.sprintForm, async () => {
      const v = this.model();
      if (!v.startDate || !v.endDate) return;

      const data: CreateSprintInput = {
        name: v.name.trim(),
        startDate: v.startDate,
        endDate: v.endDate,
      };

      this.error.set(null);
      this.saving.set(true);
      try {
        await this.saveHandler()(data);
        this.close();
      } catch (err) {
        console.error('Sprint save failed:', err);
        this.error.set('Something went wrong. Please try again.');
      } finally {
        this.saving.set(false);
      }
    });
  }
}
