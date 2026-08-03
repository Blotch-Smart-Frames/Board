import { signal } from '@angular/core';
import { provideMarkdown } from 'ngx-markdown';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CommentsSection } from './comments-section';
import { FIRESTORE_DB } from '../../../../core/firebase/firebase.config';
import { AuthStore } from '../../../../core/auth/auth.store';
import { BoardService } from '../../../../core/services/board.service';

// CommentsSection subscribes to live Firestore comments via collectionSignal;
// stub the SDK so onSnapshot never fires instead of hitting real Firebase (a
// misconfigured, key-less app in this test environment). The comments signal
// then stays `undefined` forever, which the component renders as the empty state.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'collection', path: segments.join('/') })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ type: 'query', ref, constraints })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  onSnapshot: vi.fn(() => vi.fn()),
}));

function setup() {
  const boardService = {
    addComment: vi.fn().mockResolvedValue(undefined),
    updateComment: vi.fn().mockResolvedValue(undefined),
    deleteComment: vi.fn().mockResolvedValue(undefined),
  };
  return {
    boardService,
    providers: [
      { provide: FIRESTORE_DB, useValue: {} },
      { provide: AuthStore, useValue: { user: signal({ uid: 'u1' }) } },
      { provide: BoardService, useValue: boardService },
      provideMarkdown(),
    ],
  };
}

describe('CommentsSection', () => {
  it('shows "No comments yet" when there are no comments', async () => {
    const { providers } = setup();
    await render(CommentsSection, {
      inputs: { boardId: 'board-1', taskId: 'task-1' },
      providers,
    });

    expect(screen.getByText('No comments yet')).toBeInTheDocument();
  });

  it('posts a new comment through BoardService using the signed-in user', async () => {
    const user = userEvent.setup();
    const { boardService, providers } = setup();
    await render(CommentsSection, {
      inputs: { boardId: 'board-1', taskId: 'task-1' },
      providers,
    });

    await user.type(screen.getByLabelText('Add a comment'), 'A new comment');
    await user.click(screen.getByRole('button', { name: /^post$/i }));

    await waitFor(() =>
      expect(boardService.addComment).toHaveBeenCalledWith(
        'board-1',
        'task-1',
        { text: 'A new comment' },
        'u1',
      ),
    );
  });
});
