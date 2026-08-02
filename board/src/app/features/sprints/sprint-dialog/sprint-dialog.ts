import { Component, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { form, submit, required, validate, FormField } from '@angular/forms/signals';
import { Timestamp } from 'firebase/firestore';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCalendarRange } from '@spartan-ng/helm/calendar';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { SprintService } from '../../../core/services/sprint.service';
import { PreviewBackdrop } from '../../../shared/components/preview-backdrop/preview-backdrop';
import { SprintListItem } from '../../board/task-detail/sprint/sprint-list-item';
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
    PreviewBackdrop,
    SprintListItem,
  ],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content *hlmDialogPortal class="w-100">
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
          <div class="flex flex-col gap-4 py-2">
            @if (!editing()) {
              <div hlmField>
                <label hlmFieldLabel for="sprint-duration">Default sprint duration</label>
                <div class="flex items-center gap-2">
                  <input
                    hlmInput
                    id="sprint-duration"
                    type="number"
                    min="1"
                    max="365"
                    class="w-24"
                    [value]="durationDays()"
                    (input)="durationDays.set($any($event.target).value)"
                  />
                  <span class="text-sm">days</span>
                  <button
                    hlmBtn
                    variant="outline"
                    size="sm"
                    type="button"
                    [disabled]="savingConfig() || durationUnchanged()"
                    (click)="saveConfig()"
                  >
                    {{ savingConfig() ? 'Saving...' : 'Save' }}
                  </button>
                </div>
                <p hlmFieldDescription>Used when auto-calculating dates for new sprints</p>
              </div>

              <hr class="border-border" />
            }

            @if (previewSprint(); as sprint) {
              <app-preview-backdrop label="Preview">
                <div class="pointer-events-none" inert>
                  <app-sprint-list-item [sprint]="sprint" />
                </div>
              </app-preview-backdrop>
            }

            <form hlmFieldGroup (submit)="$event.preventDefault(); save()">
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
                <div class="flex">
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
          </div>

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
  readonly configuredDurationDays = input<number | undefined>(undefined);

  private readonly dialog = viewChild.required<HlmDialog>('dialog');

  protected readonly editing = signal<Sprint | null>(null);
  protected readonly loadingDefaults = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  // linkedSignal so the local input tracks the persisted config when it changes
  // (e.g. after a successful save), while still allowing the user to type freely.
  protected readonly durationDays = linkedSignal(() =>
    String(this.configuredDurationDays() ?? DEFAULT_SPRINT_DURATION_DAYS),
  );
  protected readonly savingConfig = signal(false);
  protected readonly durationUnchanged = computed(
    () =>
      this.durationDays() === String(this.configuredDurationDays() ?? DEFAULT_SPRINT_DURATION_DAYS),
  );

  protected readonly model = signal<SprintFormModel>({ name: '', startDate: null, endDate: null });

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

  protected saveConfig(): void {
    const days = parseInt(this.durationDays(), 10);
    if (isNaN(days) || days < 1) return;
    this.savingConfig.set(true);
    this.sprintService
      .updateSprintConfig(this.boardId(), { durationDays: days })
      .catch((err) => console.error('Failed to save sprint config:', err))
      .finally(() => this.savingConfig.set(false));
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
