import { Component, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { format } from 'date-fns';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { SprintService } from '../../../../core/services/sprint.service';
import { compareOrder } from '../../../../shared/utils/ordering';
import { SprintDialog } from '../../../sprints/sprint-dialog/sprint-dialog';
import type { CreateSprintInput, Sprint } from '../../../../shared/types/board';

const DEFAULT_SPRINT_DURATION_DAYS = 14;

@Component({
  selector: 'app-sprint-management',
  imports: [HlmAlert, HlmAlertDescription, HlmButton, HlmInput, HlmLabel, NgIcon, SprintDialog],
  providers: [provideIcons({ lucidePencil, lucidePlus, lucideTrash2 })],
  template: `
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div>
        <span hlmLabel>Default sprint duration</span>
        <div class="mt-1 flex items-center gap-2">
          <input
            hlmInput
            type="number"
            min="1"
            max="365"
            class="w-24"
            aria-label="Default sprint duration in days"
            [value]="durationDays()"
            (input)="durationDays.set($any($event.target).value)"
          />
          <span class="text-sm">days</span>
          <button
            hlmBtn
            variant="outline"
            size="sm"
            [disabled]="savingConfig() || durationUnchanged()"
            (click)="saveConfig()"
          >
            {{ savingConfig() ? 'Saving...' : 'Save' }}
          </button>
        </div>
        <p class="text-muted-foreground mt-1 text-xs">
          Used when auto-calculating dates for new sprints
        </p>
      </div>

      <hr class="border-border" />

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
              <div class="flex items-center justify-between gap-2 rounded-md border p-2">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ sprint.name }}</p>
                  <p class="text-muted-foreground text-xs">{{ formatDates(sprint) }}</p>
                </div>
                <span class="flex shrink-0 gap-1">
                  <button
                    hlmBtn
                    variant="ghost"
                    size="icon"
                    aria-label="Edit sprint"
                    (click)="openEdit(sprint)"
                  >
                    <ng-icon name="lucidePencil" />
                  </button>
                  <button
                    hlmBtn
                    variant="ghost"
                    size="icon"
                    aria-label="Delete sprint"
                    [disabled]="deletingId() === sprint.id"
                    (click)="remove(sprint)"
                  >
                    <ng-icon name="lucideTrash2" />
                  </button>
                </span>
              </div>
            }
          </div>
        }
      </div>
    </div>

    <app-sprint-dialog #sprintDialog [boardId]="boardId()" [saveHandler]="saveHandler" />
  `,
})
export class SprintManagement {
  private readonly sprintService = inject(SprintService);

  readonly boardId = input.required<string>();
  readonly sprints = input<Sprint[]>([]);
  readonly configuredDurationDays = input<number | undefined>(undefined);

  private readonly sprintDialog = viewChild.required<SprintDialog>('sprintDialog');

  // linkedSignal so the local input tracks the persisted config when it changes
  // (e.g. after a successful save), while still allowing the user to type freely.
  protected readonly durationDays = linkedSignal(() =>
    String(this.configuredDurationDays() ?? DEFAULT_SPRINT_DURATION_DAYS),
  );
  protected readonly savingConfig = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);
  private readonly editingSprint = signal<Sprint | null>(null);

  protected readonly sortedSprints = computed(() =>
    [...this.sprints()].sort((a, b) => compareOrder(a.order, b.order)),
  );

  protected readonly durationUnchanged = computed(
    () =>
      this.durationDays() === String(this.configuredDurationDays() ?? DEFAULT_SPRINT_DURATION_DAYS),
  );

  protected saveConfig(): void {
    const days = parseInt(this.durationDays(), 10);
    if (isNaN(days) || days < 1) return;
    this.savingConfig.set(true);
    this.sprintService
      .updateSprintConfig(this.boardId(), { durationDays: days })
      .catch((err) => console.error('Failed to save sprint config:', err))
      .finally(() => this.savingConfig.set(false));
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
      const { canDelete, taskCount } = await this.sprintService.canDeleteSprint(
        this.boardId(),
        sprint.id,
      );
      if (!canDelete) {
        const noun = taskCount === 1 ? 'task is' : 'tasks are';
        this.deleteError.set(
          `Cannot delete: ${taskCount} ${noun} assigned to this sprint. Remove tasks from the sprint first.`,
        );
        return;
      }
      await this.sprintService.deleteSprint(this.boardId(), sprint.id);
    } catch (err) {
      this.deleteError.set(err instanceof Error ? err.message : 'Failed to delete sprint');
    } finally {
      this.deletingId.set(null);
    }
  }

  protected formatDates(sprint: Sprint): string {
    return `${format(sprint.startDate.toDate(), 'MMM d, yyyy')} - ${format(sprint.endDate.toDate(), 'MMM d, yyyy')}`;
  }
}
