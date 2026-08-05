import { Component, computed, inject, input } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCalendarImports } from '@spartan-ng/helm/calendar';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { SprintManagement } from '../sprint/sprint-management';
import { BoardStore } from '../../data/board.store';
import type { Task } from '../../../../shared/types/board';

@Component({
  selector: 'app-task-sprint-tab',
  imports: [HlmButton, HlmCalendarImports, HlmFieldImports, HlmSwitch, SprintManagement],
  template: `
    <div hlmField>
      <div class="flex items-center justify-between">
        <span hlmFieldLabel>Start &amp; due date</span>
        @if (task().startDate || task().dueDate) {
          <button hlmBtn variant="ghost" size="sm" type="button" (click)="clearDates()">
            Clear
          </button>
        }
      </div>

      <div class="flex gap-2">
        <!-- /* v8 ignore start -- template listener wrappers on host-directive outputs @preserve */ -->
        <hlm-calendar-range
          class="mx-auto"
          [startDate]="startDate()"
          [endDate]="dueDate()"
          (startDateChange)="onStartDateChange($event)"
          (endDateChange)="onEndDateChange($event)"
        />
        <!-- /* v8 ignore stop -- @preserve */ -->

        <app-sprint-management
          class="flex-1"
          [boardId]="boardId()"
          [sprints]="sprints()"
          [configuredDurationDays]="store.board()?.sprintConfig?.durationDays"
          [selectedStartDate]="startDate()"
          [selectedEndDate]="dueDate()"
          (selectDates)="onSprintDatesSelected($event)"
        />
      </div>
    </div>

    <div hlmField orientation="horizontal">
      <hlm-switch
        inputId="task-calendar-sync"
        [checked]="task().calendarSyncEnabled"
        [disabled]="!task().dueDate"
        (checkedChange)="onCalendarSyncChange($event)"
      />
      <div hlmFieldContent>
        <label hlmFieldLabel for="task-calendar-sync">Sync with Google Calendar</label>
        @if (!task().dueDate) {
          <p hlmFieldDescription>Set a due date to enable calendar sync</p>
        }
      </div>
    </div>
  `,
})
export class TaskSprintTab {
  protected readonly store = inject(BoardStore);

  readonly task = input.required<Task>();
  readonly boardId = input.required<string>();

  protected readonly startDate = computed(() => this.task().startDate?.toDate());
  protected readonly dueDate = computed(() => this.task().dueDate?.toDate());
  /* v8 ignore next -- defensive: sprints() is seeded to an array before this template reads it @preserve */
  protected readonly sprints = computed(() => this.store.sprints() ?? []);

  protected onStartDateChange(date: Date | undefined): void {
    const task = this.task();
    const current = task.startDate?.toDate().getTime();
    if (date?.getTime() !== current) {
      this.store.updateTask(task.id, { startDate: date ?? null });
    }
  }

  protected onEndDateChange(date: Date | undefined): void {
    const task = this.task();
    const current = task.dueDate?.toDate().getTime();
    if (date?.getTime() !== current) {
      this.store.updateTask(task.id, { dueDate: date ?? null });
    }
  }

  protected clearDates(): void {
    this.store.updateTask(this.task().id, { startDate: null, dueDate: null });
  }

  protected onSprintDatesSelected({
    startDate,
    endDate,
  }: {
    startDate: Date;
    endDate: Date;
  }): void {
    this.store.updateTask(this.task().id, { startDate, dueDate: endDate });
  }

  protected onCalendarSyncChange(enabled: boolean): void {
    this.store.updateTask(this.task().id, { calendarSyncEnabled: enabled });
  }
}
