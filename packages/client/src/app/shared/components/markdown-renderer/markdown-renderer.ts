import { Component, input } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';

/**
 * Read-only GFM markdown renderer for task descriptions and comments.
 * Replaces the source app's `MDEditor.Markdown`; HTML is sanitized via the
 * SANITIZE provider configured in app.config.ts.
 */
@Component({
  selector: 'app-markdown-renderer',
  imports: [MarkdownComponent],
  styles: `
    :host ::ng-deep .board-markdown {
      font-size: 0.875rem;
      line-height: 1.5;
      word-break: break-word;
    }
    :host ::ng-deep .board-markdown > *:first-child {
      margin-top: 0;
    }
    :host ::ng-deep .board-markdown > *:last-child {
      margin-bottom: 0;
    }
    :host ::ng-deep .board-markdown p {
      margin: 0.25rem 0;
    }
    :host ::ng-deep .board-markdown ul,
    :host ::ng-deep .board-markdown ol {
      margin: 0.25rem 0;
      padding-left: 1.25rem;
      list-style: revert;
    }
    :host ::ng-deep .board-markdown a {
      color: var(--primary);
      text-decoration: underline;
    }
    :host ::ng-deep .board-markdown code {
      background: var(--muted);
      border-radius: 0.25rem;
      padding: 0.1rem 0.25rem;
      font-size: 0.85em;
    }
    :host ::ng-deep .board-markdown pre {
      background: var(--muted);
      border-radius: 0.375rem;
      padding: 0.5rem;
      overflow-x: auto;
    }
    :host ::ng-deep .board-markdown h1,
    :host ::ng-deep .board-markdown h2,
    :host ::ng-deep .board-markdown h3 {
      font-weight: 600;
      margin: 0.5rem 0 0.25rem;
    }
  `,
  template: `<markdown class="board-markdown" [data]="source()" />`,
})
export class MarkdownRenderer {
  readonly source = input<string>('');
}
