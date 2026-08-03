import { Component, ElementRef, effect, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';

/**
 * Inline add-task widget shown at the bottom of a list column. Toggles
 * between a "+ Add a task" call-to-action and a textarea + submit/cancel
 * buttons. Owns its own draft/editing state so the parent list column
 * doesn't have to track per-column composition state.
 */
@Component({
  selector: 'app-add-task-form',
  imports: [HlmButton, HlmInput, NgIcon],
  providers: [provideIcons({ lucidePlus })],
  template: `
    <div class="border-t p-2">
      @if (adding()) {
        <textarea
          #taskInput
          hlmInput
          class="min-h-16 w-full resize-none"
          placeholder="Enter task title..."
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          (keydown.enter)="$event.preventDefault(); submit()"
          (keydown.escape)="cancel()"
          aria-label="Task title"
        ></textarea>
        <div class="mt-2 flex items-center gap-2">
          <button
            hlmBtn
            size="sm"
            [disabled]="!draft().trim()"
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
  protected readonly draft = signal('');
  private readonly taskInput = viewChild<ElementRef<HTMLTextAreaElement>>('taskInput');

  constructor() {
    effect(() => {
      if (this.adding()) this.taskInput()?.nativeElement.focus();
    });
  }

  protected start(): void {
    this.draft.set('');
    this.adding.set(true);
  }

  protected cancel(): void {
    this.adding.set(false);
    this.draft.set('');
  }

  protected submit(): void {
    const trimmed = this.draft().trim();
    if (!trimmed) return;
    this.addTask.emit(trimmed);
    this.draft.set('');
  }
}
