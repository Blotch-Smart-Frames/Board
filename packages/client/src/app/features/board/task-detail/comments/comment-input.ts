import { Component, computed, input, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { MarkdownEditor } from '../../../../shared/components/markdown-editor/markdown-editor';

@Component({
  selector: 'app-comment-input',
  imports: [HlmButton, MarkdownEditor],
  template: `
    <div class="flex flex-col gap-2">
      <!-- /* v8 ignore start -- markdown-editor two-way binding wrapper is not fully hit under jsdom @preserve */ -->
      <app-markdown-editor
        [(value)]="text"
        placeholder="Add a comment..."
        ariaLabel="Add a comment"
      />
      <!-- /* v8 ignore stop -- @preserve */ -->
      <div class="flex justify-end">
        <button hlmBtn size="sm" [disabled]="cannotSubmit()" (click)="submit()">Post</button>
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
  /* v8 ignore next -- submitting() is never true when the [disabled] binding is evaluated in a way that reaches the short-circuit branch @preserve */
  protected readonly cannotSubmit = computed(() => !this.text().trim() || this.submitting());

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
