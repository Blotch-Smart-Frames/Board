import { Component, ElementRef, computed, effect, output, signal, viewChild } from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { MAX_TITLE_LENGTH } from '../../task-title';

/** Ensures each instance gets a unique error id (multiple columns render this form). */
let nextErrorId = 0;

/**
 * Inline add-task widget shown at the bottom of a list column. Toggles
 * between a "+ Add a task" call-to-action and a textarea + submit/cancel
 * buttons. Owns its own draft/editing state so the parent list column
 * doesn't have to track per-column composition state.
 */
@Component({
  selector: 'app-add-task-form',
  imports: [HlmButton, HlmInput, NgIcon, FormField],
  providers: [provideIcons({ lucidePlus })],
  template: `
    <div class="border-t p-2">
      @if (adding()) {
        <!-- /* v8 ignore start -- template listener wrappers (keydown/mousedown) exercised via user.type/user.click but V8 attributes coverage inconsistently @preserve */ -->
        <textarea
          #taskInput
          hlmInput
          class="min-h-16 w-full resize-none"
          placeholder="Enter task title..."
          [formField]="taskForm.title"
          (keydown.enter)="$event.preventDefault(); submit()"
          (keydown.escape)="cancel()"
          aria-label="Task title"
          [attr.aria-invalid]="showError()"
          [attr.aria-describedby]="showError() ? errorId : null"
        ></textarea>
        @if (showError()) {
          <p [id]="errorId" role="alert" class="text-destructive mt-1 text-sm">
            {{ taskForm.title().errors()[0].message }}
          </p>
        }
        <div class="mt-2 flex items-center gap-2">
          <button
            hlmBtn
            size="sm"
            [disabled]="taskForm().invalid()"
            (mousedown)="$event.preventDefault()"
            (click)="submit()"
          >
            Add
          </button>
          <button
            hlmBtn
            size="sm"
            variant="ghost"
            (mousedown)="$event.preventDefault()"
            (click)="cancel()"
          >
            Cancel
          </button>
        </div>
        <!-- /* v8 ignore stop -- @preserve */ -->
      } @else {
        <button
          hlmBtn
          variant="ghost"
          class="text-muted-foreground w-full justify-start"
          (click)="start()"
        >
          <ng-icon name="lucidePlus" class="mr-2" />
          Add a task
        </button>
      }
    </div>
  `,
})
export class AddTaskForm {
  readonly addTask = output<string>();

  protected readonly adding = signal(false);
  protected readonly errorId = `add-task-error-${nextErrorId++}`;

  /** Single source of truth for the composed title. */
  private readonly model = signal({ title: '' });

  protected readonly taskForm = form(this.model, (path) => {
    required(path.title, { message: 'Enter a task title' });
    // `required` treats a whitespace-only string as present, so reject those explicitly.
    validate(path.title, ({ value }) => {
      const title = value();
      return title.length > 0 && title.trim().length === 0
        ? { kind: 'blank', message: 'Enter a task title' }
        : null;
    });
    // A custom rule rather than `maxLength`, which would reflect a native `maxlength` and silently
    // hard-cap input — this lets the user type past the limit and see why the title is rejected.
    validate(path.title, ({ value }) =>
      value().length > MAX_TITLE_LENGTH
        ? {
            kind: 'maxLength',
            message:
              'Title is too long. If you want to add more information, create the card and add it to the description instead.',
          }
        : null,
    );
  });

  /** Only surface errors once the user has started typing, not on a freshly opened field. */
  protected readonly showError = computed(
    () => this.taskForm.title().dirty() && this.taskForm.title().invalid(),
  );

  /* v8 ignore start -- Angular's viewChild signal getter is not tracked as invoked by V8 in tests @preserve */
  private readonly taskInput = viewChild<ElementRef<HTMLTextAreaElement>>('taskInput');
  /* v8 ignore stop -- @preserve */

  constructor() {
    effect(() => {
      if (this.adding()) this.taskInput()?.nativeElement.focus();
    });
  }

  protected start(): void {
    this.reset();
    this.adding.set(true);
  }

  protected cancel(): void {
    this.adding.set(false);
    this.reset();
  }

  protected submit(): void {
    if (this.taskForm().invalid()) return;
    this.addTask.emit(this.model().title.trim());
    this.reset();
  }

  private reset(): void {
    this.model.set({ title: '' });
    this.taskForm().reset();
  }
}
