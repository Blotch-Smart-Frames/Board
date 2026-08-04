import { Component, inject, input, signal, viewChild } from '@angular/core';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { SprintService } from '../../../core/services/sprint.service';
import { SprintDurationConfig } from './sprint-duration-config/sprint-duration-config';
import {
  EMPTY_SPRINT_FORM,
  SprintFormFields,
  type SprintFormModel,
} from './sprint-form-fields/sprint-form-fields';
import type { Sprint, CreateSprintInput } from '../../../shared/types/board';

@Component({
  selector: 'app-sprint-dialog',
  imports: [HlmDialogImports, HlmButton, HlmSpinner, SprintDurationConfig, SprintFormFields],
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
              <app-sprint-duration-config
                [configuredDurationDays]="configuredDurationDays()"
                [saveHandler]="saveDurationConfig"
              />

              <hr class="border-border" />
            }

            <app-sprint-form-fields
              #formFields
              [initialValue]="initialValue()"
              [error]="error()"
              (escape)="close()"
              (submit)="save()"
            />
          </div>

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
  private readonly formFields = viewChild.required<SprintFormFields>('formFields');

  protected readonly editing = signal<Sprint | null>(null);
  protected readonly loadingDefaults = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly initialValue = signal<SprintFormModel>(EMPTY_SPRINT_FORM);

  async open(sprint: Sprint | null): Promise<void> {
    this.editing.set(sprint);
    this.error.set(null);

    if (sprint) {
      this.initialValue.set({
        name: sprint.name,
        startDate: sprint.startDate.toDate(),
        endDate: sprint.endDate.toDate(),
      });
      this.loadingDefaults.set(false);
      this.dialog().open();
      return;
    }

    this.initialValue.set(EMPTY_SPRINT_FORM);
    this.loadingDefaults.set(true);
    this.dialog().open();
    try {
      const defaults = await this.sprintService.calculateNextSprintDates(this.boardId());
      this.initialValue.set({
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

  protected readonly saveDurationConfig = (days: number): Promise<void> =>
    this.sprintService.updateSprintConfig(this.boardId(), { durationDays: days });

  protected async save(): Promise<void> {
    await this.formFields().submitWith(async (v) => {
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
