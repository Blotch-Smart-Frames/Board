import type { Timestamp } from 'firebase/firestore';
import { provideMarkdown } from 'ngx-markdown';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CommentItem } from './comment-item';
import type { Comment, Collaborator } from '../../../../shared/types/board';

function fakeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    text: 'Hello world',
    authorId: 'u1',
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

function fakeCollaborator(overrides: Partial<Collaborator> = {}): Collaborator {
  return {
    id: 'u1',
    email: 'alice@example.com',
    name: 'Alice',
    isOwner: false,
    ...overrides,
  };
}

describe('CommentItem', () => {
  it("shows the author's name and the comment's rendered text", async () => {
    await render(CommentItem, {
      inputs: {
        comment: fakeComment({ text: 'Hello world' }),
        author: fakeCollaborator({ name: 'Alice' }),
        updateHandler: vi.fn().mockResolvedValue(undefined),
      },
      providers: [provideMarkdown()],
    });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(await screen.findByText('Hello world')).toBeInTheDocument();
  });

  it('falls back to "Unknown User" when author is undefined', async () => {
    await render(CommentItem, {
      inputs: { comment: fakeComment(), updateHandler: vi.fn().mockResolvedValue(undefined) },
      providers: [provideMarkdown()],
    });

    expect(screen.getByText('Unknown User')).toBeInTheDocument();
  });

  it('hides the Edit/Delete buttons when it is not the own comment', async () => {
    await render(CommentItem, {
      inputs: {
        comment: fakeComment(),
        isOwnComment: false,
        updateHandler: vi.fn().mockResolvedValue(undefined),
      },
      providers: [provideMarkdown()],
    });

    expect(screen.queryByRole('button', { name: 'Edit comment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete comment' })).not.toBeInTheDocument();
  });

  it('shows the Edit/Delete buttons when it is the own comment', async () => {
    await render(CommentItem, {
      inputs: {
        comment: fakeComment(),
        isOwnComment: true,
        updateHandler: vi.fn().mockResolvedValue(undefined),
      },
      providers: [provideMarkdown()],
    });

    expect(screen.getByRole('button', { name: 'Edit comment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete comment' })).toBeInTheDocument();
  });

  it('emits deleted with the comment id when Delete is clicked', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    await render(CommentItem, {
      inputs: {
        comment: fakeComment({ id: 'c42' }),
        isOwnComment: true,
        updateHandler: vi.fn().mockResolvedValue(undefined),
      },
      on: { deleted: onDeleted },
      providers: [provideMarkdown()],
    });

    await user.click(screen.getByRole('button', { name: 'Delete comment' }));

    expect(onDeleted).toHaveBeenCalledWith('c42');
  });

  it('edits the comment text, saves it, and returns to the rendered view', async () => {
    const user = userEvent.setup();
    const updateHandler = vi.fn().mockResolvedValue(undefined);
    await render(CommentItem, {
      inputs: {
        comment: fakeComment({ id: 'c1', text: 'Original text' }),
        isOwnComment: true,
        updateHandler,
      },
      providers: [provideMarkdown()],
    });

    await user.click(screen.getByRole('button', { name: 'Edit comment' }));

    const textarea = screen.getByLabelText('Edit comment');
    expect(textarea).toHaveValue('Original text');

    await user.clear(textarea);
    await user.type(textarea, 'Updated text');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateHandler).toHaveBeenCalledWith('c1', 'Updated text'));
    // The rendered view is back (not the editable textarea) — "Edit comment" now
    // only matches the icon button, since that shares the textarea's aria-label.
    expect(screen.queryByRole('textbox', { name: 'Edit comment' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit comment' })).toBeInTheDocument();
  });
});
