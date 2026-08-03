import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';

export const DEFAULT_SPRINT_DURATION_DAYS = 14;

@Component({
  selector: 'app-sprint-duration-config',
  imports: [HlmButton, HlmFieldImports, HlmInput],
  template: `
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
          [disabled]="saving() || unchanged()"
          (click)="onSave()"
        >
          {{ saving() ? 'Saving...' : 'Save' }}
        </button>
      </div>
      <p hlmFieldDescription>Used when auto-calculating dates for new sprints</p>
    </div>
  `,
})
export class SprintDurationConfig {
  readonly configuredDurationDays = input<number | undefined>(undefined);
  readonly saveHandler = input.required<(days: number) => Promise<void>>();

  // linkedSignal so the local input tracks the persisted config when it changes
  // (e.g. after a successful save), while still allowing the user to type freely.
  protected readonly durationDays = linkedSignal(() =>
    String(this.configuredDurationDays() ?? DEFAULT_SPRINT_DURATION_DAYS),
  );
  protected readonly saving = signal(false);
  protected readonly unchanged = computed(
    () =>
      this.durationDays() === String(this.configuredDurationDays() ?? DEFAULT_SPRINT_DURATION_DAYS),
  );

  protected onSave(): void {
    const days = parseInt(this.durationDays(), 10);
    if (isNaN(days) || days < 1) return;
    this.saving.set(true);
    this.saveHandler()(days)
      .catch((err) => console.error('Failed to save sprint config:', err))
      .finally(() => this.saving.set(false));
  }
}
