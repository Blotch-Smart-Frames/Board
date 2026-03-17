import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TaskDetailDialog } from './TaskDetailDialog';
import type { Task, Label } from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';
import { Timestamp } from 'firebase/firestore';

vi.mock('../../hooks/useCommentsQuery', () => ({
  useCommentsQuery: () => ({
    comments: [],
    isLoading: false,
    addComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
  }),
}));

vi.mock('../../hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({
    user: { uid: 'user-1' },
    isAuthenticated: true,
  }),
}));

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  listId: 'list-1',
  title: 'Test Task',
  order: 'a0',
  calendarSyncEnabled: false,
  createdBy: 'user-1',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

const mockLabels: Label[] = [
  {
    id: 'label-1',
    name: 'Bug',
    color: '#ff0000',
    order: 'a0',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
];

const mockCollaborators: Collaborator[] = [
  {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@test.com',
    isOwner: false,
  },
];

describe('TaskDetailDialog', () => {
  it('renders task title', () => {
    const task = createMockTask({ title: 'My Task' });
    render(
      <TaskDetailDialog
        open
        boardId="board-1"
        task={task}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('My Task')).toBeInTheDocument();
  });

  it('renders task description', () => {
    const task = createMockTask({ description: 'Some description' });
    render(
      <TaskDetailDialog
        open
        boardId="board-1"
        task={task}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Some description')).toBeInTheDocument();
  });

  it('renders labels when present', () => {
    const task = createMockTask({ labelIds: ['label-1'] });
    render(
      <TaskDetailDialog
        open
        boardId="board-1"
        task={task}
        labels={mockLabels}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Bug')).toBeInTheDocument();
  });

  it('renders assignees when present', () => {
    const task = createMockTask({ assignedTo: ['user-1'] });
    render(
      <TaskDetailDialog
        open
        boardId="board-1"
        task={task}
        collaborators={mockCollaborators}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Assignees')).toBeInTheDocument();
  });

  it('renders due date when present', () => {
    const dueDate = Timestamp.fromDate(new Date('2024-12-25'));
    const task = createMockTask({ dueDate });
    render(
      <TaskDetailDialog
        open
        boardId="board-1"
        task={task}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText(/Due:.*Dec/)).toBeInTheDocument();
  });

  it('renders the comments section', () => {
    const task = createMockTask();
    render(
      <TaskDetailDialog
        open
        boardId="board-1"
        task={task}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByText('No comments yet')).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const task = createMockTask();
    render(
      <TaskDetailDialog
        open
        boardId="board-1"
        task={task}
        onClose={onClose}
        onEdit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onEdit when Edit button is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const task = createMockTask();
    render(
      <TaskDetailDialog
        open
        boardId="board-1"
        task={task}
        onClose={vi.fn()}
        onEdit={onEdit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('renders nothing when task is null', () => {
    const { container } = render(
      <TaskDetailDialog
        open
        boardId="board-1"
        task={null}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(container.querySelector('.MuiDialog-root')).not.toBeInTheDocument();
  });
});
