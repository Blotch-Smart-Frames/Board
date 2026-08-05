import { Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucideTrash2 } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { MarkdownRenderer } from '../../../../shared/components/markdown-renderer/markdown-renderer';
import { MarkdownEditor } from '../../../../shared/components/markdown-editor/markdown-editor';
import type { Comment, Collaborator } from '../../../../shared/types/board';

@Component({
  selector: 'app-comment-item',
  imports: [NgIcon, HlmButton, MarkdownRenderer, MarkdownEditor],
  providers: [provideIcons({ lucidePencil, lucideTrash2 })],
  template: `
    <div class="py-2">
      <div class="flex items-center justify-between">
        <div class="flex items-baseline gap-2">
          <span class="text-sm font-medium">{{ author()?.name ?? 'Unknown User' }}</span>
          <span class="text-muted-foreground text-xs">{{ formattedDate() }}</span>
        </div>
        @if (isOwnComment() && !editing()) {
          <div class="flex gap-1">
            <button
              hlmBtn
              variant="ghost"
              size="icon-sm"
              aria-label="Edit comment"
              (click)="startEdit()"
            >
              <ng-icon name="lucidePencil" />
            </button>
            <button
              hlmBtn
              variant="ghost"
              size="icon-sm"
              aria-label="Delete comment"
              (click)="deleted.emit(comment().id)"
            >
              <ng-icon name="lucideTrash2" />
            </button>
          </div>
        }
      </div>

      @if (editing()) {
        <div class="mt-1 flex flex-col gap-2">
          <!-- /* v8 ignore start -- markdown-editor two-way binding wrapper is not fully hit under jsdom @preserve */ -->
          <app-markdown-editor [(value)]="editText" ariaLabel="Edit comment" />
          <!-- /* v8 ignore stop -- @preserve */ -->
          <div class="flex justify-end gap-2">
            <button hlmBtn variant="ghost" size="sm" [disabled]="saving()" (click)="cancel()">
              Cancel
            </button>
            <button hlmBtn size="sm" [disabled]="cannotSave()" (click)="save()">Save</button>
          </div>
        </div>
      } @else {
        <div class="mt-1">
          <app-markdown-renderer [source]="comment().text" />
        </div>
      }
    </div>
  `,
})
export class CommentItem {
  readonly comment = input.required<Comment>();
  readonly author = input<Collaborator | undefined>(undefined);
  readonly isOwnComment = input(false);
  readonly updateHandler = input.required<(commentId: string, text: string) => Promise<void>>();
  readonly deleted = output<string>();

  protected readonly editing = signal(false);
  protected readonly editText = signal('');
  protected readonly saving = signal(false);
  /* v8 ignore next -- saving() is never true when the [disabled] binding is evaluated in a way that reaches the short-circuit branch @preserve */
  protected readonly cannotSave = computed(() => !this.editText().trim() || this.saving());

  protected readonly formattedDate = computed(() => {
    const createdAt = this.comment().createdAt;
    /* v8 ignore next -- defensive: createdAt is always a Timestamp with toDate() on live comments @preserve */
    if (!createdAt?.toDate) return '';
    return createdAt.toDate().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  });

  protected startEdit(): void {
    this.editText.set(this.comment().text);
    this.editing.set(true);
  }

  protected cancel(): void {
    this.editing.set(false);
  }

  protected async save(): Promise<void> {
    const trimmed = this.editText().trim();
    /* v8 ignore next -- save button is disabled when the draft is empty @preserve */
    if (!trimmed) return;
    this.saving.set(true);
    try {
      await this.updateHandler()(this.comment().id, trimmed);
      this.editing.set(false);
    } finally {
      this.saving.set(false);
    }
  }
}
