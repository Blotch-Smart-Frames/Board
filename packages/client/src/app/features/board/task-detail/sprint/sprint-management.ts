import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { SprintService } from '../../../../core/services/sprint.service';
import { compareOrder } from '../../../../shared/utils/ordering';
import { SprintDialog } from '../../../sprints/sprint-dialog/sprint-dialog';
import { SprintListItem } from './sprint-list-item';
import type { CreateSprintInput, Sprint } from '../../../../shared/types/board';

@Component({
  selector: 'app-sprint-management',
  imports: [HlmAlert, HlmAlertDescription, HlmButton, NgIcon, SprintDialog, SprintListItem],
  providers: [provideIcons({ lucidePlus })],
  template: `
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div>
        <div class="mb-2 flex items-center justify-between">
          <span class="text-muted-foreground text-sm">Sprints</span>
          <button hlmBtn variant="ghost" size="sm" type="button" (click)="openCreate()">
            <ng-icon name="lucidePlus" class="mr-2" />
            Create Sprint
          </button>
        </div>

        @if (deleteError()) {
          <div hlmAlert variant="destructive" class="mb-2">
            <p hlmAlertDescription>{{ deleteError() }}</p>
          </div>
        }

        @if (sortedSprints().length === 0) {
          <p class="text-muted-foreground text-sm">No sprints created yet</p>
        } @else {
          <div class="flex flex-col gap-2">
            @for (sprint of sortedSprints(); track sprint.id) {
              <app-sprint-list-item
                [sprint]="sprint"
                [deleting]="deletingId() === sprint.id"
                [highlighted]="highlightedSprintIds().has(sprint.id)"
                (edit)="openEdit(sprint)"
                (remove)="remove(sprint)"
                (selectDates)="emitSelectDates(sprint)"
              />
            }
          </div>
        }
      </div>
    </div>

    <app-sprint-dialog
      #sprintDialog
      [boardId]="boardId()"
      [saveHandler]="saveHandler"
      [configuredDurationDays]="configuredDurationDays()"
    />
  `,
})
export class SprintManagement {
  private readonly sprintService = inject(SprintService);

  readonly boardId = input.required<string>();
  readonly sprints = input<Sprint[]>([]);
  readonly configuredDurationDays = input<number | undefined>(undefined);
  readonly selectedStartDate = input<Date | undefined>(undefined);
  readonly selectedEndDate = input<Date | undefined>(undefined);
  readonly selectDates = output<{ startDate: Date; endDate: Date }>();

  private readonly sprintDialog = viewChild.required<SprintDialog>('sprintDialog');

  protected readonly deletingId = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);
  private readonly editingSprint = signal<Sprint | null>(null);

  protected readonly sortedSprints = computed(() =>
    [...this.sprints()].sort((a, b) => compareOrder(a.order, b.order)),
  );

  protected readonly highlightedSprintIds = computed(() => {
    const start = this.selectedStartDate();
    const end = this.selectedEndDate();
    if (!start && !end) return new Set<string>();
    const times = [start, end].filter((d): d is Date => d instanceof Date).map((d) => d.getTime());
    const rangeStart = Math.min(...times);
    const rangeEnd = Math.max(...times);
    const ids = new Set<string>();
    for (const sprint of this.sprints()) {
      const sprintStart = sprint.startDate.toDate().getTime();
      const sprintEnd = sprint.endDate.toDate().getTime();
      if (sprintEnd >= rangeStart && sprintStart <= rangeEnd) {
        ids.add(sprint.id);
      }
    }
    return ids;
  });

  protected emitSelectDates(sprint: Sprint): void {
    this.selectDates.emit({
      startDate: sprint.startDate.toDate(),
      endDate: sprint.endDate.toDate(),
    });
  }

  protected openCreate(): void {
    this.editingSprint.set(null);
    this.sprintDialog().open(null);
  }

  protected openEdit(sprint: Sprint): void {
    this.editingSprint.set(sprint);
    this.sprintDialog().open(sprint);
  }

  protected readonly saveHandler = (data: CreateSprintInput): Promise<void> => {
    const editing = this.editingSprint();
    return editing
      ? this.sprintService.updateSprint(this.boardId(), editing.id, data)
      : this.sprintService.createSprint(this.boardId(), data).then(() => {});
  };

  protected async remove(sprint: Sprint): Promise<void> {
    this.deleteError.set(null);
    this.deletingId.set(sprint.id);
    try {
      await this.sprintService.deleteSprint(this.boardId(), sprint.id);
    } catch (err) {
      this.deleteError.set(err instanceof Error ? err.message : 'Failed to delete sprint');
    } finally {
      this.deletingId.set(null);
    }
  }
}
