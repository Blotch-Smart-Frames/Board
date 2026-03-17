import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { CommentsSection } from './CommentsSection';
import type { Comment } from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

const mockAddComment = vi.fn().mockResolvedValue(undefined);
const mockUpdateComment = vi.fn().mockResolvedValue(undefined);
const mockDeleteComment = vi.fn().mockResolvedValue(undefined);

let mockComments: Comment[] = [];

vi.mock('../../hooks/useCommentsQuery', () => ({
  useCommentsQuery: () => ({
    comments: mockComments,
    isLoading: false,
    addComment: mockAddComment,
    updateComment: mockUpdateComment,
    deleteComment: mockDeleteComment,
  }),
}));

vi.mock('../../hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({
    user: { uid: 'user-1' },
    isAuthenticated: true,
  }),
}));

const mockCollaborators: Collaborator[] = [
  { id: 'user-1', name: 'Alice', email: 'alice@test.com', isOwner: false },
  { id: 'user-2', name: 'Bob', email: 'bob@test.com', isOwner: false },
];

describe('CommentsSection', () => {
  beforeEach(() => {
    mockComments = [];
    vi.clearAllMocks();
  });

  it('renders the Comments heading', () => {
    render(
      <CommentsSection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );
    expect(screen.getByText('Comments')).toBeInTheDocument();
  });

  it('shows empty state when no comments', () => {
    render(
      <CommentsSection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );
    expect(screen.getByText('No comments yet')).toBeInTheDocument();
  });

  it('renders comments when present', () => {
    mockComments = [
      {
        id: 'c1',
        text: 'First comment',
        authorId: 'user-1',
        createdAt: Timestamp.fromDate(new Date('2024-06-15')),
        updatedAt: Timestamp.fromDate(new Date('2024-06-15')),
      },
      {
        id: 'c2',
        text: 'Second comment',
        authorId: 'user-2',
        createdAt: Timestamp.fromDate(new Date('2024-06-16')),
        updatedAt: Timestamp.fromDate(new Date('2024-06-16')),
      },
    ];

    render(
      <CommentsSection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    expect(screen.getByText('First comment')).toBeInTheDocument();
    expect(screen.getByText('Second comment')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('No comments yet')).not.toBeInTheDocument();
  });

  it('submits a new comment', async () => {
    const user = userEvent.setup();
    render(
      <CommentsSection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    await user.type(
      screen.getByPlaceholderText('Add a comment...'),
      'New comment',
    );
    await user.click(screen.getByRole('button', { name: /post/i }));

    expect(mockAddComment).toHaveBeenCalledWith({ text: 'New comment' });
  });

  it('shows edit/delete buttons only for own comments', () => {
    mockComments = [
      {
        id: 'c1',
        text: 'My comment',
        authorId: 'user-1',
        createdAt: Timestamp.fromDate(new Date('2024-06-15')),
        updatedAt: Timestamp.fromDate(new Date('2024-06-15')),
      },
      {
        id: 'c2',
        text: 'Their comment',
        authorId: 'user-2',
        createdAt: Timestamp.fromDate(new Date('2024-06-16')),
        updatedAt: Timestamp.fromDate(new Date('2024-06-16')),
      },
    ];

    render(
      <CommentsSection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    const editButtons = screen.getAllByRole('button', {
      name: /edit comment/i,
    });
    const deleteButtons = screen.getAllByRole('button', {
      name: /delete comment/i,
    });
    expect(editButtons).toHaveLength(1);
    expect(deleteButtons).toHaveLength(1);
  });
});
