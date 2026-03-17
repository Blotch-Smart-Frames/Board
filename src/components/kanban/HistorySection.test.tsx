import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistorySection } from './HistorySection';
import type { HistoryEntry } from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';
import { Timestamp } from 'firebase/firestore';

const mockCollaborators: Collaborator[] = [
  { id: 'user-1', name: 'Alice', email: 'alice@test.com', isOwner: false },
  { id: 'user-2', name: 'Bob', email: 'bob@test.com', isOwner: false },
];

const createEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'history-1',
  action: 'completed',
  userId: 'user-1',
  createdAt: Timestamp.now(),
  ...overrides,
});

let mockHistory: HistoryEntry[] = [];
let mockIsLoading = false;

vi.mock('../../hooks/useHistoryQuery', () => ({
  useHistoryQuery: () => ({
    history: mockHistory,
    isLoading: mockIsLoading,
  }),
}));

describe('HistorySection', () => {
  it('shows empty state when no history', () => {
    mockHistory = [];
    mockIsLoading = false;

    render(
      <HistorySection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockHistory = [];
    mockIsLoading = true;

    render(
      <HistorySection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders completed action', () => {
    mockHistory = [createEntry({ action: 'completed', userId: 'user-1' })];
    mockIsLoading = false;

    render(
      <HistorySection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    expect(screen.getByText('Alice marked as complete')).toBeInTheDocument();
  });

  it('renders reopened action', () => {
    mockHistory = [createEntry({ action: 'reopened', userId: 'user-2' })];
    mockIsLoading = false;

    render(
      <HistorySection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    expect(screen.getByText('Bob reopened')).toBeInTheDocument();
  });

  it('renders label added action', () => {
    mockHistory = [
      createEntry({
        action: 'label_added',
        userId: 'user-1',
        metadata: { labelName: 'Bug', labelColor: '#ff0000' },
      }),
    ];
    mockIsLoading = false;

    render(
      <HistorySection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    expect(screen.getByText('Alice added label Bug')).toBeInTheDocument();
  });

  it('renders moved action', () => {
    mockHistory = [
      createEntry({
        action: 'moved',
        userId: 'user-1',
        metadata: { fromListName: 'To Do', toListName: 'Done' },
      }),
    ];
    mockIsLoading = false;

    render(
      <HistorySection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    expect(
      screen.getByText('Alice moved from To Do to Done'),
    ).toBeInTheDocument();
  });

  it('renders assignee added action', () => {
    mockHistory = [
      createEntry({
        action: 'assignee_added',
        userId: 'user-1',
        metadata: { userName: 'Bob' },
      }),
    ];
    mockIsLoading = false;

    render(
      <HistorySection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    expect(screen.getByText('Alice assigned Bob')).toBeInTheDocument();
  });

  it('renders field changed action', () => {
    mockHistory = [
      createEntry({
        action: 'field_changed',
        field: 'title',
        userId: 'user-1',
        metadata: { oldValue: 'Old', newValue: 'New' },
      }),
    ];
    mockIsLoading = false;

    render(
      <HistorySection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    expect(screen.getByText('Alice changed title')).toBeInTheDocument();
  });

  it('renders multiple entries', () => {
    mockHistory = [
      createEntry({ id: 'h1', action: 'completed', userId: 'user-1' }),
      createEntry({
        id: 'h2',
        action: 'label_added',
        userId: 'user-2',
        metadata: { labelName: 'Feature' },
      }),
    ];
    mockIsLoading = false;

    render(
      <HistorySection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    expect(screen.getByText('Alice marked as complete')).toBeInTheDocument();
    expect(screen.getByText('Bob added label Feature')).toBeInTheDocument();
  });

  it('shows "Someone" for unknown user', () => {
    mockHistory = [
      createEntry({ action: 'completed', userId: 'unknown-user' }),
    ];
    mockIsLoading = false;

    render(
      <HistorySection
        boardId="board-1"
        taskId="task-1"
        collaborators={mockCollaborators}
      />,
    );

    expect(screen.getByText('Someone marked as complete')).toBeInTheDocument();
  });
});
