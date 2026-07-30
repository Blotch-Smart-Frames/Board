import { Component, computed, input, signal, viewChild } from '@angular/core';
import { form, submit, required, validate, FormField } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { ColorPicker } from '../../../shared/components/color-picker/color-picker';
import { toDateInputValue, parseDateInput } from '../../../shared/utils/date-input';
import type { Task, CreateTaskInput, UpdateTaskInput } from '../../../shared/types/board';

type TaskFormModel = {
  title: string;
  description: string;
  color: string;
  startDate: string;
  dueDate: string;
};

@Component({
  selector: 'app-task-dialog',
  imports: [HlmDialogImports, HlmButton, HlmInput, HlmLabel, HlmSpinner, ColorPicker, NgIcon, FormField],
  providers: [provideIcons({ lucideTrash2 })],
  template: `
    <hlm-dialog #dialog>
      <hlm-dialog-content *hlmDialogPortal class="sm:max-w-lg">
        <hlm-dialog-header>
          <h3 hlmDialogTitle>{{ editing() ? 'Edit task' : 'Create task' }}</h3>
        </hlm-dialog-header>

        <form class="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-2" (submit)="$event.preventDefault(); save()">
          <div>
            <label hlmLabel for="task-title">Title</label>
            <input hlmInput id="task-title" class="w-full" [formField]="taskForm.title" (keydown.escape)="close()" />
            @for (err of taskForm.title().errors(); track err.kind) {
              <p class="text-destructive mt-1 text-sm">{{ err.message }}</p>
            }
          </div>

          <div>
            <label hlmLabel for="task-desc">Description</label>
            <textarea hlmInput id="task-desc" class="min-h-20 w-full resize-y" [formField]="taskForm.description"></textarea>
          </div>

          <div class="flex flex-col gap-2">
            <span class="flex items-center justify-between">
              <span hlmLabel>Card color</span>
              @if (model().color) {
                <button hlmBtn variant="ghost" size="sm" type="button" (click)="clearColor()">Clear</button>
              }
            </span>
            <app-color-picker [value]="model().color" (valueChange)="setColor($event)" />
          </div>

          <div class="flex gap-4">
            <div class="flex-1">
              <label hlmLabel for="task-start">Start date</label>
              <input hlmInput id="task-start" type="date" class="w-full" [formField]="taskForm.startDate" />
            </div>
            <div class="flex-1">
              <label hlmLabel for="task-due">Due date</label>
              <input hlmInput id="task-due" type="date" class="w-full" [formField]="taskForm.dueDate" />
              @for (err of taskForm.dueDate().errors(); track err.kind) {
                <p class="text-destructive mt-1 text-sm">{{ err.message }}</p>
              }
            </div>
          </div>

          @if (error()) {
            <p class="text-destructive text-sm">{{ error() }}</p>
          }
        </form>

        <hlm-dialog-footer class="justify-between">
          <span>
            @if (editing() && deleteHandler()) {
              <button hlmBtn variant="destructive" type="button" [disabled]="saving()" (click)="remove()">
                <ng-icon name="lucideTrash2" class="mr-2" />
                Delete
              </button>
            }
          </span>
          <span class="flex gap-2">
            <button hlmBtn variant="outline" type="button" [disabled]="saving()" (click)="close()">Cancel</button>
            <button hlmBtn type="button" [disabled]="taskForm().invalid() || saving()" (click)="save()">
              @if (saving()) {
                <hlm-spinner class="size-4" />
              } @else {
                {{ editing() ? 'Save' : 'Create' }}
              }
            </button>
          </span>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class TaskDialog {
  readonly saveHandler = input.required<(data: CreateTaskInput | UpdateTaskInput) => Promise<void>>();
  readonly deleteHandler = input<(() => Promise<void>) | null>(null);

  private readonly dialog = viewChild.required<HlmDialog>('dialog');

  protected readonly editing = signal<Task | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly model = signal<TaskFormModel>({
    title: '',
    description: '',
    color: '',
    startDate: '',
    dueDate: '',
  });

  protected readonly taskForm = form(this.model, (path) => {
    required(path.title, { message: 'A title is required' });
    validate(path.dueDate, ({ value, valueOf }) => {
      const start = valueOf(path.startDate);
      if (value() && start && value() < start) {
        return { kind: 'dateOrder', message: 'Due date must be on or after the start date' };
      }
      return undefined;
    });
  });

  protected readonly isEditing = computed(() => !!this.editing());

  open(task: Task | null): void {
    this.editing.set(task);
    this.error.set(null);
    this.model.set({
      title: task?.title ?? '',
      description: task?.description ?? '',
      color: task?.color ?? '',
      startDate: task?.startDate ? toDateInputValue(task.startDate.toDate()) : '',
      dueDate: task?.dueDate ? toDateInputValue(task.dueDate.toDate()) : '',
    });
    this.dialog().open();
  }

  close(): void {
    this.dialog().close(undefined);
    this.saving.set(false);
  }

  protected setColor(color: string): void {
    this.model.update((m) => ({ ...m, color }));
  }

  protected clearColor(): void {
    this.setColor('');
  }

  protected async save(): Promise<void> {
    await submit(this.taskForm, async () => {
      const isEditing = this.isEditing();
      const v = this.model();
      const data: CreateTaskInput | UpdateTaskInput = {
        title: v.title.trim(),
        description: v.description.trim() || undefined,
        color: v.color || (isEditing ? null : undefined),
        startDate: v.startDate ? parseDateInput(v.startDate) : isEditing ? null : undefined,
        dueDate: v.dueDate ? parseDateInput(v.dueDate) : isEditing ? null : undefined,
      };

      this.error.set(null);
      this.saving.set(true);
      try {
        await this.saveHandler()(data);
        this.close();
      } catch (err) {
        console.error('Task save failed:', err);
        this.error.set('Something went wrong. Please try again.');
      } finally {
        this.saving.set(false);
      }
    });
  }

  protected async remove(): Promise<void> {
    const handler = this.deleteHandler();
    if (!handler) return;
    this.saving.set(true);
    try {
      await handler();
      this.close();
    } catch (err) {
      console.error('Task delete failed:', err);
      this.error.set('Could not delete this task. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
