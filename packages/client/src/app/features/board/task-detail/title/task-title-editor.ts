import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';

type TitleFormModel = { title: string };

@Component({
  selector: 'app-task-title-editor',
  imports: [HlmDialogImports, HlmFieldImports, HlmInput, FormField],
  template: `
    @if (editing()) {
      <div hlmField>
        <label class="sr-only" hlmFieldLabel for="task-title">Title</label>
        <input
          #titleInput
          hlmInput
          id="task-title"
          class="text-lg font-medium"
          autocomplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
          [formField]="titleForm.title"
          (blur)="commit()"
          (keydown.enter)="onEnter($event)"
          (keydown.escape)="cancel()"
        />
        @for (err of titleForm.title().errors(); track err.kind) {
          <hlm-field-error forceShow>{{ err.message }}</hlm-field-error>
        }
      </div>
    } @else {
      <h3
        hlmDialogTitle
        class="hover:bg-accent -mx-2 -my-1 cursor-text rounded px-2 py-1 pr-6 text-lg wrap-break-word"
        tabindex="0"
        (click)="startEditing()"
        (keydown.enter)="startEditing()"
      >
        {{ title() }}
      </h3>
    }
  `,
})
export class TaskTitleEditor {
  readonly title = input.required<string>();
  readonly titleChange = output<string>();

  protected readonly editing = signal(false);
  protected readonly model = signal<TitleFormModel>({ title: '' });
  protected readonly titleForm = form(this.model, (path) => {
    required(path.title, { message: 'A title is required' });
  });

  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  protected startEditing(): void {
    this.model.set({ title: this.title() });
    this.editing.set(true);
    requestAnimationFrame(() => {
      const el = this.titleInput()?.nativeElement;
      el?.focus();
      el?.select();
    });
  }

  protected commit(): void {
    const value = this.model().title.trim();
    // Empty/invalid titles are silently discarded; the h3 re-renders with the current title() input.
    if (!this.titleForm.title().invalid() && value && value !== this.title()) {
      this.titleChange.emit(value);
    }
    this.editing.set(false);
  }

  protected cancel(): void {
    this.editing.set(false);
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    (event.target as HTMLInputElement).blur();
  }
}
