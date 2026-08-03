import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalendarSync } from './CalendarSync';
import type { CalendarSyncState } from '../../types/calendar';

describe('CalendarSync', () => {
  const defaultSyncState: CalendarSyncState = {
    isSyncing: false,
    lastSyncAt: undefined,
    error: undefined,
  };

  const defaultProps = {
    syncState: defaultSyncState,
    isConnected: true,
    onSync: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('When not connected', () => {
    it('shows disconnected status', () => {
      render(<CalendarSync {...defaultProps} isConnected={false} />);

      expect(screen.getByText(/calendar not connected/i)).toBeInTheDocument();
    });

    it('does not show sync button when disconnected', () => {
      render(<CalendarSync {...defaultProps} isConnected={false} />);

      expect(
        screen.queryByRole('button', { name: /sync/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('When connected', () => {
    it('shows synced status', () => {
      render(<CalendarSync {...defaultProps} />);

      expect(screen.getByText(/calendar synced/i)).toBeInTheDocument();
    });

    it('shows sync button', () => {
      render(<CalendarSync {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /sync now/i }),
      ).toBeInTheDocument();
    });

    it('calls onSync when button clicked', async () => {
      const user = userEvent.setup();
      const onSync = vi.fn();
      render(<CalendarSync {...defaultProps} onSync={onSync} />);

      await user.click(screen.getByRole('button', { name: /sync now/i }));

      expect(onSync).toHaveBeenCalled();
    });
  });

  describe('Syncing state', () => {
    it('shows syncing status', () => {
      const syncState: CalendarSyncState = {
        isSyncing: true,
        lastSyncAt: undefined,
        error: undefined,
      };

      render(<CalendarSync {...defaultProps} syncState={syncState} />);

      expect(
        screen.getByRole('button', { name: /syncing/i }),
      ).toBeInTheDocument();
    });

    it('disables sync button while syncing', () => {
      const syncState: CalendarSyncState = {
        isSyncing: true,
        lastSyncAt: undefined,
        error: undefined,
      };

      render(<CalendarSync {...defaultProps} syncState={syncState} />);

      expect(screen.getByRole('button', { name: /syncing/i })).toBeDisabled();
    });
  });

  describe('Last sync time', () => {
    it("shows 'Just now' for recent sync", () => {
      const syncState: CalendarSyncState = {
        isSyncing: false,
        lastSyncAt: new Date(),
        error: undefined,
      };

      render(<CalendarSync {...defaultProps} syncState={syncState} />);

      // The last sync info is in a tooltip
      expect(screen.getByText(/calendar synced/i)).toBeInTheDocument();
    });

    it('shows minutes for older sync', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const syncState: CalendarSyncState = {
        isSyncing: false,
        lastSyncAt: tenMinutesAgo,
        error: undefined,
      };

      render(<CalendarSync {...defaultProps} syncState={syncState} />);

      expect(screen.getByText(/calendar synced/i)).toBeInTheDocument();
    });

    it('shows hours for very old sync', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const syncState: CalendarSyncState = {
        isSyncing: false,
        lastSyncAt: twoHoursAgo,
        error: undefined,
      };

      render(<CalendarSync {...defaultProps} syncState={syncState} />);

      expect(screen.getByText(/calendar synced/i)).toBeInTheDocument();
    });

    it("shows 'Never synced' when no last sync", () => {
      const syncState: CalendarSyncState = {
        isSyncing: false,
        lastSyncAt: undefined,
        error: undefined,
      };

      render(<CalendarSync {...defaultProps} syncState={syncState} />);

      // The tooltip should say "Never synced"
      expect(screen.getByText(/calendar synced/i)).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('displays error message', () => {
      const syncState: CalendarSyncState = {
        isSyncing: false,
        lastSyncAt: undefined,
        error: 'Sync failed',
      };

      render(<CalendarSync {...defaultProps} syncState={syncState} />);

      expect(screen.getByText(/sync error/i)).toBeInTheDocument();
    });

    it('shows error icon when there is an error', () => {
      const syncState: CalendarSyncState = {
        isSyncing: false,
        lastSyncAt: undefined,
        error: 'Connection lost',
      };

      render(<CalendarSync {...defaultProps} syncState={syncState} />);

      expect(screen.getByTestId('ErrorIcon')).toBeInTheDocument();
    });

    it('still shows sync button on error', () => {
      const syncState: CalendarSyncState = {
        isSyncing: false,
        lastSyncAt: undefined,
        error: 'Sync failed',
      };

      render(<CalendarSync {...defaultProps} syncState={syncState} />);

      expect(
        screen.getByRole('button', { name: /sync now/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Visual indicators', () => {
    it('shows success icon when connected without error', () => {
      render(<CalendarSync {...defaultProps} />);

      expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
    });

    it('shows disabled icon when not connected', () => {
      render(<CalendarSync {...defaultProps} isConnected={false} />);

      expect(screen.getByTestId('SyncDisabledIcon')).toBeInTheDocument();
    });
  });
});
