import { Component, computed, inject, input, output, viewChild } from '@angular/core';
import { format } from 'date-fns';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSettings, lucidePlus } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { SprintDialog } from '../sprint-dialog/sprint-dialog';
import { SprintManagement } from '../sprint-management/sprint-management';
import { SprintService } from '../../../core/services/sprint.service';
import { compareOrder } from '../../../shared/utils/ordering';
import type { Board, Sprint, CreateSprintInput } from '../../../shared/types/board';

const NO_SPRINT_VALUE = '';

@Component({
  selector: 'app-sprint-picker',
  imports: [HlmButton, HlmLabel, HlmSelectImports, NgIcon, SprintDialog, SprintManagement],
  providers: [provideIcons({ lucideSettings, lucidePlus })],
  template: `
    <div>
      <div class="mb-2 flex items-center justify-between">
        <label hlmLabel for="sprint-picker-trigger" class="text-muted-foreground text-sm">Sprint</label>
        <button hlmBtn variant="ghost" size="sm" type="button" (click)="openManagement()">
          <ng-icon name="lucideSettings" class="mr-2" />
          Manage
        </button>
      </div>

      <hlm-select [value]="selectedSprintId() ?? noSprintValue" (valueChange)="onValueChange($event)">
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

      <button hlmBtn variant="ghost" size="sm" type="button" class="mt-1" (click)="openCreate()">
        <ng-icon name="lucidePlus" class="mr-2" />
        Create sprint
      </button>
    </div>

    <app-sprint-dialog #sprintDialog [boardId]="boardId()" [saveHandler]="createHandler" />
    <app-sprint-management #management [boardId]="boardId()" [board]="board()" [sprints]="sprints()" />
  `,
})
export class SprintPicker {
  private readonly sprintService = inject(SprintService);

  readonly boardId = input.required<string>();
  readonly board = input<Board | null>(null);
  readonly sprints = input.required<Sprint[]>();
  readonly selectedSprintId = input<string | null>(null);
  readonly selectedSprintIdChange = output<string | null>();

  protected readonly noSprintValue = NO_SPRINT_VALUE;

  private readonly sprintDialog = viewChild.required<SprintDialog>('sprintDialog');
  private readonly management = viewChild.required<SprintManagement>('management');

  protected readonly sorted = computed(() => [...this.sprints()].sort((a, b) => compareOrder(a.order, b.order)));

  protected onValueChange(value: unknown): void {
    if (typeof value !== 'string') return;
    this.selectedSprintIdChange.emit(value === NO_SPRINT_VALUE ? null : value);
  }

  protected formatRange(sprint: Sprint): string {
    return `${format(sprint.startDate.toDate(), 'MMM d')} - ${format(sprint.endDate.toDate(), 'MMM d')}`;
  }

  protected openManagement(): void {
    this.management().open();
  }

  protected openCreate(): void {
    this.sprintDialog().open(null);
  }

  protected readonly createHandler = (data: CreateSprintInput): Promise<void> =>
    this.sprintService.createSprint(this.boardId(), data).then(() => {});
}
