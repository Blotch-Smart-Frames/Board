import { Component, computed, input, output } from '@angular/core';
import { format } from 'date-fns';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { compareOrder } from '../../../shared/utils/ordering';
import type { Sprint } from '../../../shared/types/board';

const NO_SPRINT_VALUE = '';

@Component({
  selector: 'app-sprint-picker',
  imports: [HlmLabel, HlmSelectImports],
  template: `
    <div>
      <label hlmLabel for="sprint-picker-trigger" class="text-muted-foreground mb-2 block text-sm"
        >Sprint</label
      >

      <hlm-select
        [value]="selectedSprintId() ?? noSprintValue"
        [itemToString]="sprintIdToLabel"
        (valueChange)="onValueChange($event)"
      >
        <hlm-select-trigger [buttonId]="'sprint-picker-trigger'" class="w-full">
          <hlm-select-value />
        </hlm-select-trigger>
        <hlm-select-content *hlmSelectPortal>
          <hlm-select-item [value]="noSprintValue">No sprint (Backlog)</hlm-select-item>
          @for (sprint of sorted(); track sprint.id) {
            <hlm-select-item [value]="sprint.id">
              <span class="flex w-full items-center justify-between gap-2">
                <span>{{ sprint.name }}</span>
                <span class="text-muted-foreground text-xs">{{ formatRange(sprint) }}</span>
              </span>
            </hlm-select-item>
          }
        </hlm-select-content>
      </hlm-select>
    </div>
  `,
})
export class SprintPicker {
  readonly sprints = input.required<Sprint[]>();
  readonly selectedSprintId = input<string | null>(null);
  readonly selectedSprintIdChange = output<string | null>();

  protected readonly noSprintValue = NO_SPRINT_VALUE;

  protected readonly sorted = computed(() =>
    [...this.sprints()].sort((a, b) => compareOrder(a.order, b.order)),
  );

  protected onValueChange(value: unknown): void {
    if (typeof value !== 'string') return;
    this.selectedSprintIdChange.emit(value === NO_SPRINT_VALUE ? null : value);
  }

  protected formatRange(sprint: Sprint): string {
    return `${format(sprint.startDate.toDate(), 'MMM d')} - ${format(sprint.endDate.toDate(), 'MMM d')}`;
  }

  protected readonly sprintIdToLabel = (id: string): string => {
    if (id === NO_SPRINT_VALUE) return 'No sprint (Backlog)';
    return this.sprints().find((s) => s.id === id)?.name ?? '';
  };
}
