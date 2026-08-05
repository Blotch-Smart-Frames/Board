import { signal } from '@angular/core';
import { provideMarkdown } from 'ngx-markdown';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Timestamp } from 'firebase/firestore';
import { CommentsSection } from './comments-section';
import { FIRESTORE_DB } from '../../../../core/firebase/firebase.config';
import { AuthStore } from '../../../../core/auth/auth.store';
import { BoardService } from '../../../../core/services/board.service';
import type { Collaborator, Comment } from '../../../../shared/types/board';

type SnapshotDoc = { id: string; data: () => Omit<Comment, 'id'> };
type SnapshotCallback = (snapshot: { docs: SnapshotDoc[] }) => void;
let onSnapshotCallback: SnapshotCallback | undefined;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ type: 'query', ref, constraints })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  onSnapshot: vi.fn((_ref: unknown, cb: SnapshotCallback) => {
    onSnapshotCallback = cb;
    return vi.fn();
  }),
}));

function ts(date: Date): Timestamp {
  return { toDate: () => date, toMillis: () => date.getTime() } as Timestamp;
}

function feed(comments: Comment[]): void {
  onSnapshotCallback?.({
    docs: comments.map((c) => {
      const { id: _id, ...rest } = c;
      return { id: c.id, data: () => rest };
    }),
  });
}

function setup(user: { uid: string } | null = { uid: 'u1' }) {
  const boardService = {
    addComment: vi.fn().mockResolvedValue(undefined),
    updateComment: vi.fn().mockResolvedValue(undefined),
    deleteComment: vi.fn().mockResolvedValue(undefined),
  };
  return {
    boardService,
    providers: [
      { provide: FIRESTORE_DB, useValue: {} },
      { provide: AuthStore, useValue: { user: signal(user) } },
      { provide: BoardService, useValue: boardService },
      provideMarkdown(),
    ],
  };
}

describe('CommentsSection', () => {
  beforeEach(() => {
    onSnapshotCallback = undefined;
  });

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

  it('rejects a post attempt when the user is not authenticated', async () => {
    const { boardService, providers } = setup(null);
    const { fixture } = await render(CommentsSection, {
      inputs: { boardId: 'board-1', taskId: 'task-1' },
      providers,
    });

    const postHandler = (
      fixture.componentInstance as unknown as {
        postHandler: (text: string) => Promise<void>;
      }
    ).postHandler;

    await expect(postHandler('boom')).rejects.toThrow('Not authenticated');
    expect(boardService.addComment).not.toHaveBeenCalled();
  });

  it('renders existing comments with author names and handles updates and deletions', async () => {
    const user = userEvent.setup();
    const { boardService, providers } = setup();
    const collaborators: Collaborator[] = [
      { id: 'u1', email: 'me@example.com', name: 'Me', isOwner: true },
      { id: 'u2', email: 'other@example.com', name: 'Bob', isOwner: false },
    ];

    const { fixture } = await render(CommentsSection, {
      inputs: { boardId: 'board-1', taskId: 'task-1', collaborators },
      providers,
    });

    feed([
      {
        id: 'c1',
        text: 'Own comment',
        authorId: 'u1',
        createdAt: ts(new Date(2026, 0, 1)),
        updatedAt: ts(new Date(2026, 0, 1)),
      },
      {
        id: 'c2',
        text: "Other's comment",
        authorId: 'u2',
        createdAt: ts(new Date(2026, 0, 2)),
        updatedAt: ts(new Date(2026, 0, 2)),
      },
      {
        id: 'c3',
        text: 'Ghost comment',
        authorId: 'ghost',
        createdAt: ts(new Date(2026, 0, 3)),
        updatedAt: ts(new Date(2026, 0, 3)),
      },
    ]);
    fixture.detectChanges();

    expect(await screen.findByText('Own comment')).toBeInTheDocument();
    expect(screen.getByText("Other's comment")).toBeInTheDocument();
    expect(screen.getByText('Ghost comment')).toBeInTheDocument();

    // Own comment renders edit + delete actions.
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));

    const textarea = screen.getByLabelText('Edit comment');
    await user.clear(textarea);
    await user.type(textarea, 'Updated');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(boardService.updateComment).toHaveBeenCalledWith('board-1', 'task-1', 'c1', {
        text: 'Updated',
      }),
    );

    // Now delete the own comment.
    await user.click(screen.getByRole('button', { name: /delete comment/i }));
    await waitFor(() =>
      expect(boardService.deleteComment).toHaveBeenCalledWith('board-1', 'task-1', 'c1'),
    );
  });

  it('swallows delete errors so the UI is not left in a broken state', async () => {
    const user = userEvent.setup();
    const { boardService, providers } = setup();
    boardService.deleteComment.mockRejectedValueOnce(new Error('nope'));

    const { fixture } = await render(CommentsSection, {
      inputs: { boardId: 'board-1', taskId: 'task-1' },
      providers,
    });

    feed([
      {
        id: 'c1',
        text: 'Own',
        authorId: 'u1',
        createdAt: ts(new Date(2026, 0, 1)),
        updatedAt: ts(new Date(2026, 0, 1)),
      },
    ]);
    fixture.detectChanges();

    await user.click(await screen.findByRole('button', { name: /delete comment/i }));

    await waitFor(() => expect(boardService.deleteComment).toHaveBeenCalled());
    // The comment remains rendered because delete failed silently.
    expect(screen.getByText('Own')).toBeInTheDocument();
  });
});
