import { Component, computed, inject, input } from '@angular/core';
import { FIRESTORE_DB } from '../../../../core/firebase/firebase.config';
import { taskCommentsQuery } from '../../../../core/firebase/firestore-refs';
import { collectionSignal } from '../../../../core/interop/signal-interop';
import { AuthStore } from '../../../../core/auth/auth.store';
import { BoardService } from '../../../../core/services/board.service';
import { CommentInput } from './comment-input';
import { CommentItem } from './comment-item';
import type { Comment, Collaborator } from '../../../../shared/types/board';

@Component({
  selector: 'app-comments-section',
  imports: [CommentInput, CommentItem],
  template: `
    <div>
      <h3 class="text-muted-foreground mb-2 text-sm font-medium">Comments</h3>

      @if (comments()?.length) {
        <div class="mb-2">
          @for (comment of comments(); track comment.id) {
            <app-comment-item
              [comment]="comment"
              [author]="authorFor(comment)"
              [isOwnComment]="isOwn(comment)"
              [updateHandler]="updateHandler"
              (deleted)="deleteComment($event)"
            />
          }
        </div>
      } @else {
        <p class="text-muted-foreground mb-2 text-sm">No comments yet</p>
      }

      <app-comment-input [postHandler]="postHandler" />
    </div>
  `,
})
export class CommentsSection {
  private readonly db = inject(FIRESTORE_DB);
  private readonly authStore = inject(AuthStore);
  private readonly boardService = inject(BoardService);

  readonly boardId = input.required<string>();
  readonly taskId = input.required<string>();
  readonly collaborators = input<Collaborator[]>([]);

  protected readonly comments = collectionSignal<Comment>(() =>
    taskCommentsQuery(this.db, this.boardId(), this.taskId()),
  );

  protected authorFor(comment: Comment): Collaborator | undefined {
    return this.collaborators().find((c) => c.id === comment.authorId);
  }

  protected isOwn(comment: Comment): boolean {
    return this.authStore.user()?.uid === comment.authorId;
  }

  protected readonly postHandler = (text: string): Promise<void> => {
    const userId = this.authStore.user()?.uid;
    if (!userId) return Promise.reject(new Error('Not authenticated'));
    return this.boardService.addComment(this.boardId(), this.taskId(), { text }, userId);
  };

  protected readonly updateHandler = (commentId: string, text: string): Promise<void> =>
    this.boardService.updateComment(this.boardId(), this.taskId(), commentId, { text });

  protected deleteComment(commentId: string): void {
    this.boardService.deleteComment(this.boardId(), this.taskId(), commentId).catch(() => {});
  }

  // Kept for template symmetry / potential future use.
  protected readonly hasComments = computed(() => (this.comments()?.length ?? 0) > 0);
}
