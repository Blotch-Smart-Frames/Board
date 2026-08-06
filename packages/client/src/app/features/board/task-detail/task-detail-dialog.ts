import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';
import { HlmAlert, HlmAlertDescription } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HistorySection } from './history/history-section';
import { TaskMigrateForm, type MigrateSubmit } from './migrate/task-migrate-form';
import { TaskDetailsTab } from './details-tab/task-details-tab';
import { TaskSprintTab } from './sprint-tab/task-sprint-tab';
import { TaskTitleEditor } from './title/task-title-editor';
import { BoardStore } from '../data/board.store';
import type { Task } from '../../../shared/types/board';

type TabId = 'details' | 'sprint' | 'history' | 'advanced';

@Component({
  selector: 'app-task-detail-dialog',
  imports: [
    HlmAlert,
    HlmAlertDescription,
    HlmDialogImports,
    HlmButton,
    HlmSpinner,
    HlmTabsImports,
    NgIcon,
    HistorySection,
    TaskMigrateForm,
    TaskTitleEditor,
    TaskDetailsTab,
    TaskSprintTab,
  ],
  providers: [provideIcons({ lucideTrash2 })],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content
        *hlmDialogPortal
        class="flex h-[85vh] flex-col sm:w-[85vw]! sm:max-w-[85vw]!"
      >
        @if (migrationResult(); as result) {
          <hlm-dialog-header>
            <h3 hlmDialogTitle>Task moved</h3>
          </hlm-dialog-header>
          <div class="flex flex-1 items-center justify-center">
            <div hlmAlert class="max-w-md">
              <p hlmAlertDescription>
                Task moved to <strong>{{ result.boardTitle }}</strong
                >.
              </p>
            </div>
          </div>
          <hlm-dialog-footer class="justify-end">
            <button hlmBtn variant="outline" type="button" (click)="close()">Close</button>
            <button hlmBtn type="button" (click)="goToTarget(result.boardId)">
              Go to {{ result.boardTitle }}
            </button>
          </hlm-dialog-footer>
        } @else if (migrationInProgress(); as pending) {
          <hlm-dialog-header>
            <h3 hlmDialogTitle>Moving task…</h3>
          </hlm-dialog-header>
          <div class="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3">
            <hlm-spinner class="text-[2rem]" />
            <p class="text-sm">Moving to {{ pending.boardTitle }}…</p>
          </div>
        } @else if (task(); as task) {
          <hlm-dialog-header>
            <app-task-title-editor [title]="task.title" (titleChange)="onTitleChange($event)" />
          </hlm-dialog-header>

          <hlm-tabs
            [tab]="activeTab()"
            (tabActivated)="activeTab.set($any($event))"
            class="flex min-h-0 flex-1 flex-col"
          >
            <hlm-tabs-list class="w-fit">
              <button hlmTabsTrigger="details">Details</button>
              <button hlmTabsTrigger="sprint">Sprint</button>
              <button hlmTabsTrigger="history">History</button>
              <button hlmTabsTrigger="advanced">Advanced</button>
            </hlm-tabs-list>

            <div hlmTabsContent="details" class="flex flex-col gap-5 overflow-y-auto py-3">
              <app-task-details-tab [task]="task" [boardId]="boardId()" />
            </div>

            <div hlmTabsContent="sprint" class="flex flex-col gap-5 overflow-y-auto py-3">
              <app-task-sprint-tab [task]="task" [boardId]="boardId()" />
            </div>

            <div hlmTabsContent="history" class="overflow-y-auto py-2">
              @if (activeTab() === 'history') {
                <app-history-section
                  [boardId]="boardId()"
                  [taskId]="task.id"
                  [collaborators]="store.collaborators()"
                  [createdBy]="task.createdBy"
                  [createdAt]="task.createdAt"
                />
              }
            </div>

            <div hlmTabsContent="advanced" class="overflow-y-auto py-2">
              @if (activeTab() === 'advanced') {
                <app-task-migrate-form
                  [sourceBoardId]="boardId()"
                  [errorMessage]="migrationError()"
                  (submitMigration)="onMigrateSubmit($event)"
                />
              }
            </div>
          </hlm-tabs>

          <hlm-dialog-footer class="justify-between">
            <button hlmBtn variant="destructive" type="button" (click)="deleteTask()">
              <ng-icon name="lucideTrash2" class="mr-2" />
              Delete
            </button>
            <!-- /* v8 ignore start -- close listener is exercised via spec but V8 attributes coverage elsewhere @preserve */ -->
            <button hlmBtn variant="outline" type="button" (click)="close()">Close</button>
            <!-- /* v8 ignore stop -- @preserve */ -->
          </hlm-dialog-footer>
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class TaskDetailDialog {
  protected readonly store = inject(BoardStore);
  private readonly router = inject(Router);

  private readonly dialog = viewChild.required<HlmDialog>('dialog');

  private readonly taskId = signal<string | null>(null);
  protected readonly activeTab = signal<TabId>('details');
  protected readonly migrationResult = signal<{ boardId: string; boardTitle: string } | null>(null);
  protected readonly migrationInProgress = signal<{ boardTitle: string } | null>(null);
  protected readonly migrationError = signal<string | null>(null);

  protected readonly task = computed(() =>
    /* v8 ignore next -- defensive: tasks() is seeded to an array by the collection stream @preserve */
    (this.store.tasks() ?? []).find((t) => t.id === this.taskId()),
  );
  /* v8 ignore next -- defensive: boardId() is set before this dialog can open @preserve */
  protected readonly boardId = computed(() => this.store.boardId() ?? '');

  open(task: Task): void {
    this.taskId.set(task.id);
    this.activeTab.set('details');
    this.migrationResult.set(null);
    this.migrationInProgress.set(null);
    this.migrationError.set(null);
    this.dialog().open();
  }

  close(): void {
    this.dialog().close(undefined);
  }

  protected async onMigrateSubmit(payload: MigrateSubmit): Promise<void> {
    const currentTask = this.task();
    /* v8 ignore next 2 -- defensive: the form is only visible when task() is defined @preserve */
    if (!currentTask) return;
    this.migrationInProgress.set({ boardTitle: payload.boardTitle });
    this.migrationError.set(null);
    try {
      await this.store.migrateTaskToBoard(
        currentTask.id,
        payload.boardId,
        payload.listId,
        payload.boardTitle,
      );
      this.migrationResult.set({ boardId: payload.boardId, boardTitle: payload.boardTitle });
    } catch (err) {
      this.migrationError.set(err instanceof Error ? err.message : 'Failed to migrate task');
    } finally {
      this.migrationInProgress.set(null);
    }
  }

  protected async goToTarget(boardId: string): Promise<void> {
    await this.router.navigate(['/board', boardId]);
    this.close();
  }

  protected onTitleChange(title: string): void {
    const task = this.task();
    if (task) this.store.updateTask(task.id, { title });
  }

  protected async deleteTask(): Promise<void> {
    const task = this.task();
    if (!task) return;
    try {
      await this.store.deleteTask(task.id);
      this.close();
    } catch (err) {
      console.error('Task delete failed:', err);
    }
  }
}
