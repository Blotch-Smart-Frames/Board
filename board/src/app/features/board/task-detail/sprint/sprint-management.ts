import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
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
                (edit)="openEdit(sprint)"
                (remove)="remove(sprint)"
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

  private readonly sprintDialog = viewChild.required<SprintDialog>('sprintDialog');

  protected readonly deletingId = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);
  private readonly editingSprint = signal<Sprint | null>(null);

  protected readonly sortedSprints = computed(() =>
    [...this.sprints()].sort((a, b) => compareOrder(a.order, b.order)),
  );

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
}
