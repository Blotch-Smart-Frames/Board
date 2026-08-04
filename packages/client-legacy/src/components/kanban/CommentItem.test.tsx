import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { CommentItem } from './CommentItem';
import type { Comment } from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

const mockComment: Comment = {
  id: 'comment-1',
  text: 'This is a comment',
  authorId: 'user-1',
  createdAt: Timestamp.fromDate(new Date('2024-06-15T10:00:00')),
  updatedAt: Timestamp.fromDate(new Date('2024-06-15T10:00:00')),
};

const mockAuthor: Collaborator = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@test.com',
  isOwner: false,
};

describe('CommentItem', () => {
  it('renders comment text and author name', () => {
    render(
      <CommentItem
        comment={mockComment}
        author={mockAuthor}
        isOwnComment={false}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('This is a comment')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows "Unknown User" when author is undefined', () => {
    render(
      <CommentItem
        comment={mockComment}
        author={undefined}
        isOwnComment={false}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Unknown User')).toBeInTheDocument();
  });

  it('shows edit and delete buttons for own comments', () => {
    render(
      <CommentItem
        comment={mockComment}
        author={mockAuthor}
        isOwnComment={true}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /edit comment/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete comment/i }),
    ).toBeInTheDocument();
  });

  it('hides edit and delete buttons for other users comments', () => {
    render(
      <CommentItem
        comment={mockComment}
        author={mockAuthor}
        isOwnComment={false}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /edit comment/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /delete comment/i }),
    ).not.toBeInTheDocument();
  });

  it('enters edit mode and saves updated text', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <CommentItem
        comment={mockComment}
        author={mockAuthor}
        isOwnComment={true}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /edit comment/i }));

    const textField = screen.getByDisplayValue('This is a comment');
    await user.clear(textField);
    await user.type(textField, 'Updated comment');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onUpdate).toHaveBeenCalledWith('comment-1', 'Updated comment');
  });

  it('cancels edit mode and restores original text', async () => {
    const user = userEvent.setup();
    render(
      <CommentItem
        comment={mockComment}
        author={mockAuthor}
        isOwnComment={true}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /edit comment/i }));
    const textField = screen.getByDisplayValue('This is a comment');
    await user.clear(textField);
    await user.type(textField, 'Changed');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByText('This is a comment')).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <CommentItem
        comment={mockComment}
        author={mockAuthor}
        isOwnComment={true}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: /delete comment/i }));
    expect(onDelete).toHaveBeenCalledWith('comment-1');
  });
});
