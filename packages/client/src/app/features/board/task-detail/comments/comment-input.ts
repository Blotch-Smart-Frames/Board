import { Component, input, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { MarkdownEditor } from '../../../../shared/components/markdown-editor/markdown-editor';

@Component({
  selector: 'app-comment-input',
  imports: [HlmButton, MarkdownEditor],
  template: `
    <div class="flex flex-col gap-2">
      <app-markdown-editor [(value)]="text" placeholder="Add a comment..." ariaLabel="Add a comment" />
      <div class="flex justify-end">
        <button hlmBtn size="sm" [disabled]="!text().trim() || submitting()" (click)="submit()">Post</button>
      </div>
    </div>
  `,
})
export class CommentInput {
  // Handler owns persistence; the draft is only cleared after it resolves, so a
  // failed post keeps the text for retry (mirrors the source's CommentInput).
  readonly postHandler = input.required<(text: string) => Promise<void>>();

  protected readonly text = signal('');
  protected readonly submitting = signal(false);

  protected async submit(): Promise<void> {
    const trimmed = this.text().trim();
    if (!trimmed) return;
    this.submitting.set(true);
    try {
      await this.postHandler()(trimmed);
      this.text.set('');
    } finally {
      this.submitting.set(false);
    }
  }
}
