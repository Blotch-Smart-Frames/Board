import { Component, input, linkedSignal, output } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';

type DescriptionFormModel = {
  description: string;
};

/**
 * Textarea + save-on-blur for a task's description. Resets the local model
 * only when a different task is opened (keyed by `taskKey`), so ambient
 * updates to the same task (e.g. from another collaborator) don't wipe an
 * edit in progress.
 */
@Component({
  selector: 'app-task-description-editor',
  imports: [HlmFieldImports, HlmInput, FormField],
  template: `
    <div hlmField>
      <label hlmFieldLabel for="task-description">Description</label>
      <textarea
        hlmInput
        id="task-description"
        class="min-h-20 resize-y"
        placeholder="Add a description…"
        autocomplete="off"
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
        data-form-type="other"
        [formField]="descriptionForm.description"
        (blur)="onBlur()"
      ></textarea>
    </div>
  `,
})
export class TaskDescriptionEditor {
  readonly taskKey = input.required<string>();
  readonly initialDescription = input<string>('');
  readonly descriptionChange = output<string | undefined>();

  protected readonly model = linkedSignal<string, DescriptionFormModel>({
    source: this.taskKey,
    computation: () => ({ description: this.initialDescription() }),
  });
  protected readonly descriptionForm = form(this.model);

  protected onBlur(): void {
    const value = this.model().description.trim();
    const current = this.initialDescription();
    if (value !== current) {
      this.descriptionChange.emit(value || undefined);
    }
  }
}
