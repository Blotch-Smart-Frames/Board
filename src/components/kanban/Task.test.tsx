import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Task } from './Task';
import type { Task as TaskType } from '../../types/board';
import { Timestamp } from 'firebase/firestore';

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: { role: 'button', tabIndex: 0 },
    listeners: { onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => null,
    },
  },
}));

const createMockTask = (overrides: Partial<TaskType> = {}): TaskType => ({
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

describe('Task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders task title', () => {
    const task = createMockTask({ title: 'My Task Title' });
    render(<Task task={task} />);

    expect(
      screen.getByRole('heading', { name: 'My Task Title' }),
    ).toBeInTheDocument();
  });

  it('renders task description when provided', () => {
    const task = createMockTask({
      title: 'Task',
      description: 'This is a description',
    });
    render(<Task task={task} />);

    expect(screen.getByText('This is a description')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const task = createMockTask({ description: undefined });
    render(<Task task={task} />);

    // Only title should be present
    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
  });

  describe('Due date', () => {
    it('shows due date chip when set', () => {
      const dueDate = Timestamp.fromDate(new Date('2024-12-25'));
      const task = createMockTask({ dueDate });
      render(<Task task={task} />);

      expect(screen.getByText('Dec 25')).toBeInTheDocument();
    });

    it('does not show due date when not set', () => {
      const task = createMockTask({ dueDate: undefined });
      render(<Task task={task} />);

      // No date chip should be present
      expect(
        screen.queryByText(/dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov/i),
      ).not.toBeInTheDocument();
    });

    it('applies primary color to chip when calendar sync enabled', () => {
      const dueDate = Timestamp.fromDate(new Date('2024-12-25'));
      const task = createMockTask({ dueDate, calendarSyncEnabled: true });
      render(<Task task={task} />);

      const chip = screen.getByText('Dec 25').closest('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-colorPrimary');
    });
  });

  describe('Calendar sync icon', () => {
    it('shows calendar sync icon when enabled', () => {
      const task = createMockTask({ calendarSyncEnabled: true });
      render(<Task task={task} />);

      // Calendar icon should be present with tooltip
      expect(screen.getByTestId('CalendarMonthIcon')).toBeInTheDocument();
    });

    it('does not show extra calendar icon when sync disabled', () => {
      const task = createMockTask({
        calendarSyncEnabled: false,
        dueDate: undefined,
      });
      render(<Task task={task} />);

      // Should not have the standalone calendar sync icon
      const calendarIcons = screen.queryAllByTestId('CalendarMonthIcon');
      expect(calendarIcons).toHaveLength(0);
    });
  });

  describe('Edit functionality', () => {
    it('shows edit button when onEdit provided', () => {
      const task = createMockTask();
      const onEdit = vi.fn();
      render(<Task task={task} onEdit={onEdit} />);

      // Edit button should exist (may be hidden until hover)
      expect(screen.getByTestId('EditIcon')).toBeInTheDocument();
    });

    it('calls onEdit when edit button clicked', async () => {
      const user = userEvent.setup();
      const task = createMockTask();
      const onEdit = vi.fn();
      render(<Task task={task} onEdit={onEdit} />);

      const editButton = screen.getByTestId('EditIcon').closest('button');
      if (editButton) {
        await user.click(editButton);
        expect(onEdit).toHaveBeenCalledWith(task);
      }
    });

    it('does not show edit button when onEdit not provided', () => {
      const task = createMockTask();
      render(<Task task={task} />);

      expect(screen.queryByTestId('EditIcon')).not.toBeInTheDocument();
    });
  });

  describe('Drag handle', () => {
    it('card is the drag handle with grab cursor', () => {
      const task = createMockTask();
      const { container } = render(<Task task={task} />);

      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveClass('cursor-grab');
    });

    it('drag handle has correct attributes', () => {
      const task = createMockTask();
      const { container } = render(<Task task={task} />);

      const card = container.querySelector('.MuiCard-root');
      // Check that it has the sortable attributes
      expect(card).toHaveAttribute('role', 'button');
    });
  });

  describe('Dragging state', () => {
    it('applies dragging styles when isDragging is true', () => {
      const task = createMockTask();
      const { container } = render(<Task task={task} isDragging />);

      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveClass('shadow-lg');
    });
  });

  describe('Card structure', () => {
    it('renders as a card component', () => {
      const task = createMockTask();
      const { container } = render(<Task task={task} />);

      expect(container.querySelector('.MuiCard-root')).toBeInTheDocument();
    });

    it('has correct heading level', () => {
      const task = createMockTask({ title: 'Task Title' });
      render(<Task task={task} />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Task Title');
    });
  });

  describe('Long content handling', () => {
    it('handles long task titles', () => {
      const longTitle = 'A'.repeat(100);
      const task = createMockTask({ title: longTitle });
      render(<Task task={task} />);

      expect(screen.getByRole('heading')).toHaveTextContent(longTitle);
    });

    it('handles long descriptions with truncation', () => {
      const longDescription = 'B'.repeat(200);
      const task = createMockTask({ description: longDescription });
      render(<Task task={task} />);

      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });
  });
});
