import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskCalendarDialog } from './TaskCalendarDialog';
import type { Task } from '../../types/board';
import { Timestamp } from 'firebase/firestore';

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  listId: 'list-1',
  title: 'Test Task',
  description: 'Test description',
  order: 'a0',
  calendarSyncEnabled: false,
  createdBy: 'user-1',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

describe('TaskCalendarDialog', () => {
  const defaultProps = {
    open: true,
    task: createMockTask(),
    onClose: vi.fn(),
    onEnableSync: vi.fn(),
    onDisableSync: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when task is null', () => {
    const { container } = render(
      <TaskCalendarDialog {...defaultProps} task={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog with calendar sync title', () => {
    render(<TaskCalendarDialog {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/calendar sync/i)).toBeInTheDocument();
  });

  it('displays task title', () => {
    const task = createMockTask({ title: 'My Test Task' });
    render(<TaskCalendarDialog {...defaultProps} task={task} />);

    expect(screen.getByText('My Test Task')).toBeInTheDocument();
  });

  describe('When task has no due date', () => {
    it('shows warning that due date is required', () => {
      const task = createMockTask({ dueDate: undefined });
      render(<TaskCalendarDialog {...defaultProps} task={task} />);

      expect(
        screen.getByText(/this task needs a due date/i),
      ).toBeInTheDocument();
    });

    it('disables sync toggle', () => {
      const task = createMockTask({ dueDate: undefined });
      render(<TaskCalendarDialog {...defaultProps} task={task} />);

      const toggle = screen.getByRole('checkbox');
      expect(toggle).toBeDisabled();
    });
  });

  describe('When task has due date', () => {
    const dueDate = Timestamp.fromDate(new Date('2024-12-25'));

    it('does not show due date warning', () => {
      const task = createMockTask({ dueDate });
      render(<TaskCalendarDialog {...defaultProps} task={task} />);

      expect(
        screen.queryByText(/this task needs a due date/i),
      ).not.toBeInTheDocument();
    });

    it('enables sync toggle', () => {
      const task = createMockTask({ dueDate });
      render(<TaskCalendarDialog {...defaultProps} task={task} />);

      const toggle = screen.getByRole('checkbox');
      expect(toggle).not.toBeDisabled();
    });

    it('displays formatted due date', () => {
      const task = createMockTask({ dueDate });
      render(<TaskCalendarDialog {...defaultProps} task={task} />);

      // Check that the date is shown
      expect(screen.getByText(/due:/i)).toBeInTheDocument();
    });
  });

  describe('Sync toggle behavior', () => {
    const dueDate = Timestamp.fromDate(new Date('2024-12-25'));

    it("shows 'Enable sync' when sync is disabled", () => {
      const task = createMockTask({ dueDate, calendarSyncEnabled: false });
      render(<TaskCalendarDialog {...defaultProps} task={task} />);

      expect(screen.getByText(/enable sync/i)).toBeInTheDocument();
    });

    it("shows 'Sync enabled' when sync is enabled", () => {
      const task = createMockTask({ dueDate, calendarSyncEnabled: true });
      render(<TaskCalendarDialog {...defaultProps} task={task} />);

      expect(screen.getByText(/sync enabled/i)).toBeInTheDocument();
    });

    it('calls onEnableSync when toggling sync on', async () => {
      const user = userEvent.setup();
      const onEnableSync = vi.fn().mockResolvedValue(undefined);
      const task = createMockTask({ dueDate, calendarSyncEnabled: false });

      render(
        <TaskCalendarDialog
          {...defaultProps}
          task={task}
          onEnableSync={onEnableSync}
        />,
      );

      await user.click(screen.getByRole('checkbox'));

      expect(onEnableSync).toHaveBeenCalledWith(task);
    });

    it('calls onDisableSync when toggling sync off', async () => {
      const user = userEvent.setup();
      const onDisableSync = vi.fn().mockResolvedValue(undefined);
      const task = createMockTask({ dueDate, calendarSyncEnabled: true });

      render(
        <TaskCalendarDialog
          {...defaultProps}
          task={task}
          onDisableSync={onDisableSync}
        />,
      );

      await user.click(screen.getByRole('checkbox'));

      expect(onDisableSync).toHaveBeenCalledWith(task);
    });

    it('closes dialog after successful toggle', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onEnableSync = vi.fn().mockResolvedValue(undefined);
      const task = createMockTask({ dueDate, calendarSyncEnabled: false });

      render(
        <TaskCalendarDialog
          {...defaultProps}
          task={task}
          onClose={onClose}
          onEnableSync={onEnableSync}
        />,
      );

      await user.click(screen.getByRole('checkbox'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Loading state', () => {
    const dueDate = Timestamp.fromDate(new Date('2024-12-25'));

    it('shows loading indicator while updating', async () => {
      const user = userEvent.setup();
      const onEnableSync = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100)),
        );
      const task = createMockTask({ dueDate, calendarSyncEnabled: false });

      render(
        <TaskCalendarDialog
          {...defaultProps}
          task={task}
          onEnableSync={onEnableSync}
        />,
      );

      await user.click(screen.getByRole('checkbox'));

      expect(screen.getByText(/updating/i)).toBeInTheDocument();
    });

    it('disables toggle during loading', async () => {
      const user = userEvent.setup();
      const onEnableSync = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100)),
        );
      const task = createMockTask({ dueDate, calendarSyncEnabled: false });

      render(
        <TaskCalendarDialog
          {...defaultProps}
          task={task}
          onEnableSync={onEnableSync}
        />,
      );

      await user.click(screen.getByRole('checkbox'));

      expect(screen.getByRole('checkbox')).toBeDisabled();
    });
  });

  describe('Error handling', () => {
    const dueDate = Timestamp.fromDate(new Date('2024-12-25'));

    it('displays error message on failure', async () => {
      const user = userEvent.setup();
      const onEnableSync = vi.fn().mockRejectedValue(new Error('Sync failed'));
      const task = createMockTask({ dueDate, calendarSyncEnabled: false });

      render(
        <TaskCalendarDialog
          {...defaultProps}
          task={task}
          onEnableSync={onEnableSync}
        />,
      );

      await user.click(screen.getByRole('checkbox'));

      await waitFor(() => {
        expect(screen.getByText('Sync failed')).toBeInTheDocument();
      });
    });

    it('shows generic error message for non-Error exceptions', async () => {
      const user = userEvent.setup();
      const onEnableSync = vi.fn().mockRejectedValue('Unknown error');
      const task = createMockTask({ dueDate, calendarSyncEnabled: false });

      render(
        <TaskCalendarDialog
          {...defaultProps}
          task={task}
          onEnableSync={onEnableSync}
        />,
      );

      await user.click(screen.getByRole('checkbox'));

      await waitFor(() => {
        expect(
          screen.getByText(/failed to update sync settings/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Calendar event link', () => {
    const dueDate = Timestamp.fromDate(new Date('2024-12-25'));

    it('shows linked calendar event info when calendarEventId exists', () => {
      const task = createMockTask({
        dueDate,
        calendarSyncEnabled: true,
        calendarEventId: 'event-123',
      });

      render(<TaskCalendarDialog {...defaultProps} task={task} />);

      expect(screen.getByText(/linked to calendar event/i)).toBeInTheDocument();
    });

    it('does not show linked info when no calendarEventId', () => {
      const task = createMockTask({
        dueDate,
        calendarSyncEnabled: true,
        calendarEventId: undefined,
      });

      render(<TaskCalendarDialog {...defaultProps} task={task} />);

      expect(
        screen.queryByText(/linked to calendar event/i),
      ).not.toBeInTheDocument();
    });
  });

  describe('Close button', () => {
    it('closes dialog on close button click', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<TaskCalendarDialog {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /close/i }));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
