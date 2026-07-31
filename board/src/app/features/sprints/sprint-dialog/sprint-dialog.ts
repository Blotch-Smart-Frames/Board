import { Component, inject, input, signal, viewChild } from '@angular/core';
import { form, submit, required, validate, FormField } from '@angular/forms/signals';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { SprintService } from '../../../core/services/sprint.service';
import { toDateInputValue, parseDateInput } from '../../../shared/utils/date-input';
import type { Sprint, CreateSprintInput } from '../../../shared/types/board';

type SprintFormModel = {
  name: string;
  startDate: string;
  endDate: string;
};

@Component({
  selector: 'app-sprint-dialog',
  imports: [HlmDialogImports, HlmButton, HlmInput, HlmLabel, HlmSpinner, FormField],
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
          <form class="flex flex-col gap-4 py-2" (submit)="$event.preventDefault(); save()">
            <div>
              <label hlmLabel for="sprint-name">Sprint Name</label>
              <input hlmInput id="sprint-name" class="w-full" [formField]="sprintForm.name" (keydown.escape)="close()" />
              @for (err of sprintForm.name().errors(); track err.kind) {
                <p class="text-destructive mt-1 text-sm">{{ err.message }}</p>
              }
            </div>

            <div class="flex gap-4">
              <div class="flex-1">
                <label hlmLabel for="sprint-start">Start date</label>
                <input hlmInput id="sprint-start" type="date" class="w-full" [formField]="sprintForm.startDate" />
                @for (err of sprintForm.startDate().errors(); track err.kind) {
                  <p class="text-destructive mt-1 text-sm">{{ err.message }}</p>
                }
              </div>
              <div class="flex-1">
                <label hlmLabel for="sprint-end">End date</label>
                <input hlmInput id="sprint-end" type="date" class="w-full" [formField]="sprintForm.endDate" />
                @for (err of sprintForm.endDate().errors(); track err.kind) {
                  <p class="text-destructive mt-1 text-sm">{{ err.message }}</p>
                }
              </div>
            </div>

            @if (error()) {
              <p class="text-destructive text-sm">{{ error() }}</p>
            }
          </form>

          <hlm-dialog-footer>
            <button hlmBtn variant="outline" type="button" [disabled]="saving()" (click)="close()">Cancel</button>
            <button hlmBtn type="button" [disabled]="sprintForm().invalid() || saving()" (click)="save()">
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

  protected readonly model = signal<SprintFormModel>({ name: '', startDate: '', endDate: '' });

  protected readonly sprintForm = form(this.model, (path) => {
    required(path.name, { message: 'Name is required' });
    required(path.startDate, { message: 'Start date is required' });
    required(path.endDate, { message: 'End date is required' });
    validate(path.endDate, ({ value, valueOf }) => {
      const start = valueOf(path.startDate);
      if (value() && start && value() < start) {
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
        startDate: toDateInputValue(sprint.startDate.toDate()),
        endDate: toDateInputValue(sprint.endDate.toDate()),
      });
      this.loadingDefaults.set(false);
      this.dialog().open();
      return;
    }

    this.model.set({ name: '', startDate: '', endDate: '' });
    this.loadingDefaults.set(true);
    this.dialog().open();
    try {
      const defaults = await this.sprintService.calculateNextSprintDates(this.boardId());
      this.model.set({
        name: defaults.suggestedName,
        startDate: toDateInputValue(defaults.startDate),
        endDate: toDateInputValue(defaults.endDate),
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

  protected async save(): Promise<void> {
    await submit(this.sprintForm, async () => {
      const v = this.model();
      const startDate = parseDateInput(v.startDate);
      const endDate = parseDateInput(v.endDate);
      if (!startDate || !endDate) return;

      const data: CreateSprintInput = {
        name: v.name.trim(),
        startDate,
        endDate,
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
