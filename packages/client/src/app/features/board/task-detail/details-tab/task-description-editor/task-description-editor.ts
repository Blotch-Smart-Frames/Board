import { Component, input, output } from '@angular/core';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { RichTextEditor } from '../../../../../shared/components/rich-text-editor/rich-text-editor';

/**
 * Rich-text editor + save-on-blur for a task's description. Delegates the
 * actual editing surface to `RichTextEditor` (Quill 2 wrapped in a Spartan
 * toolbar) and only forwards the resulting HTML through to the parent store.
 * The `taskKey`-scoped reset behavior lives inside `RichTextEditor`, so opening
 * a new task never wipes an in-flight edit on a different one.
 */
@Component({
  selector: 'app-task-description-editor',
  imports: [HlmFieldImports, RichTextEditor],
  template: `
    <div hlmField>
      <label hlmFieldLabel>Description</label>
      <app-rich-text-editor
        [taskKey]="taskKey()"
        [initialHtml]="initialDescription()"
        placeholder="Add a description…"
        ariaLabel="Description"
        (htmlChange)="descriptionChange.emit($event)"
      />
    </div>
  `,
})
export class TaskDescriptionEditor {
  readonly taskKey = input.required<string>();
  readonly initialDescription = input<string>('');
  readonly descriptionChange = output<string | undefined>();
}
