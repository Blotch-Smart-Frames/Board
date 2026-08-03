import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Timestamp } from 'firebase/firestore';
import { useCalendarSync } from './useCalendarSync';
import type { Task } from '../types/board';

const mockSyncTaskToCalendar = vi.fn();
const mockEnableCalendarSync = vi.fn();
const mockDisableCalendarSync = vi.fn();
const mockSyncCalendarToTasks = vi.fn();
const mockSetAccessToken = vi.fn();

vi.mock('../services/syncService', () => ({
  syncService: {
    syncTaskToCalendar: (...args: unknown[]) => mockSyncTaskToCalendar(...args),
    enableCalendarSync: (...args: unknown[]) => mockEnableCalendarSync(...args),
    disableCalendarSync: (...args: unknown[]) =>
      mockDisableCalendarSync(...args),
    syncCalendarToTasks: (...args: unknown[]) =>
      mockSyncCalendarToTasks(...args),
  },
}));

vi.mock('../services/calendarService', () => ({
  calendarService: {
    setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
  },
}));

let mockAccessToken: string | null = null;
let mockUser: { uid: string } | null = null;

vi.mock('./useAuthQuery', () => ({
  useAuthQuery: () => ({
    accessToken: mockAccessToken,
    user: mockUser,
    isLoading: false,
    isAuthenticated: !!mockUser,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const mockTimestamp = {
  toDate: () => new Date(),
} as Timestamp;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockTask: Task = {
  id: 'task-1',
  listId: 'list-1',
  title: 'Test Task',
  order: 'a0',
  calendarSyncEnabled: false,
  createdBy: 'user-123',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

describe('useCalendarSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccessToken = null;
    mockUser = null;
  });

  it('initializes with default sync state', () => {
    const { result } = renderHook(
      () => useCalendarSync('board-1', [mockTask]),
      { wrapper: createWrapper() },
    );

    expect(result.current.syncState).toEqual({ isSyncing: false });
    expect(result.current.isCalendarConnected).toBe(false);
  });

  it('reports calendar as connected when access token is available', () => {
    mockAccessToken = 'mock-token';

    const { result } = renderHook(
      () => useCalendarSync('board-1', [mockTask]),
      { wrapper: createWrapper() },
    );

    expect(result.current.isCalendarConnected).toBe(true);
  });

  it('sets access token on calendar service when token is available', () => {
    mockAccessToken = 'mock-token';

    renderHook(() => useCalendarSync('board-1', [mockTask]), {
      wrapper: createWrapper(),
    });

    expect(mockSetAccessToken).toHaveBeenCalledWith('mock-token');
  });

  describe('syncTaskToCalendar', () => {
    it('syncs a task and returns event id', async () => {
      mockSyncTaskToCalendar.mockResolvedValue('event-123');

      const { result } = renderHook(
        () => useCalendarSync('board-1', [mockTask]),
        { wrapper: createWrapper() },
      );

      let eventId: string | null | undefined;
      await act(async () => {
        eventId = await result.current.syncTaskToCalendar(mockTask);
      });

      expect(eventId).toBe('event-123');
      expect(mockSyncTaskToCalendar).toHaveBeenCalledWith('board-1', mockTask);
      expect(result.current.syncState.isSyncing).toBe(false);
      expect(result.current.syncState.lastSyncAt).toBeInstanceOf(Date);
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useCalendarSync(null, [mockTask]), {
        wrapper: createWrapper(),
      });

      await expect(result.current.syncTaskToCalendar(mockTask)).rejects.toThrow(
        'No board selected',
      );
    });

    it('sets error state on failure', async () => {
      mockSyncTaskToCalendar.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(
        () => useCalendarSync('board-1', [mockTask]),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        try {
          await result.current.syncTaskToCalendar(mockTask);
        } catch {
          // expected
        }
      });

      expect(result.current.syncState.isSyncing).toBe(false);
      expect(result.current.syncState.error).toBe('Network error');
    });
  });

  describe('enableSync', () => {
    it('enables calendar sync for a task', async () => {
      mockEnableCalendarSync.mockResolvedValue('event-456');

      const { result } = renderHook(
        () => useCalendarSync('board-1', [mockTask]),
        { wrapper: createWrapper() },
      );

      let eventId: string | null | undefined;
      await act(async () => {
        eventId = await result.current.enableSync(mockTask);
      });

      expect(eventId).toBe('event-456');
      expect(mockEnableCalendarSync).toHaveBeenCalledWith('board-1', mockTask);
      expect(result.current.syncState.isSyncing).toBe(false);
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useCalendarSync(null, [mockTask]), {
        wrapper: createWrapper(),
      });

      await expect(result.current.enableSync(mockTask)).rejects.toThrow(
        'No board selected',
      );
    });

    it('sets error on failure', async () => {
      mockEnableCalendarSync.mockRejectedValue(new Error('API error'));

      const { result } = renderHook(
        () => useCalendarSync('board-1', [mockTask]),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        try {
          await result.current.enableSync(mockTask);
        } catch {
          // expected
        }
      });

      expect(result.current.syncState.error).toBe('API error');
    });
  });

  describe('disableSync', () => {
    it('disables calendar sync for a task', async () => {
      mockDisableCalendarSync.mockResolvedValue(undefined);

      const { result } = renderHook(
        () => useCalendarSync('board-1', [mockTask]),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.disableSync(mockTask);
      });

      expect(mockDisableCalendarSync).toHaveBeenCalledWith('board-1', mockTask);
      expect(result.current.syncState.isSyncing).toBe(false);
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useCalendarSync(null, [mockTask]), {
        wrapper: createWrapper(),
      });

      await expect(result.current.disableSync(mockTask)).rejects.toThrow(
        'No board selected',
      );
    });

    it('sets error on failure', async () => {
      mockDisableCalendarSync.mockRejectedValue(new Error('Disable failed'));

      const { result } = renderHook(
        () => useCalendarSync('board-1', [mockTask]),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        try {
          await result.current.disableSync(mockTask);
        } catch {
          // expected
        }
      });

      expect(result.current.syncState.error).toBe('Disable failed');
    });
  });

  describe('syncFromCalendar', () => {
    it('returns null when boardId is null', async () => {
      const { result } = renderHook(() => useCalendarSync(null, [mockTask]), {
        wrapper: createWrapper(),
      });

      let syncResult: unknown;
      await act(async () => {
        syncResult = await result.current.syncFromCalendar();
      });

      expect(syncResult).toBeNull();
    });

    it('returns null when user is not authenticated', async () => {
      mockUser = null;

      const { result } = renderHook(
        () => useCalendarSync('board-1', [mockTask]),
        { wrapper: createWrapper() },
      );

      let syncResult: unknown;
      await act(async () => {
        syncResult = await result.current.syncFromCalendar();
      });

      expect(syncResult).toBeNull();
    });

    it('syncs from calendar when user and boardId are available', async () => {
      mockUser = { uid: 'user-123' };
      const syncResultData = {
        created: ['task-new'],
        updated: [],
        deleted: [],
        errors: [],
      };
      mockSyncCalendarToTasks.mockResolvedValue(syncResultData);

      const { result } = renderHook(
        () => useCalendarSync('board-1', [mockTask]),
        { wrapper: createWrapper() },
      );

      let syncResult: unknown;
      await act(async () => {
        syncResult = await result.current.syncFromCalendar();
      });

      expect(syncResult).toEqual(syncResultData);
      expect(mockSyncCalendarToTasks).toHaveBeenCalledWith(
        'board-1',
        [mockTask],
        'user-123',
      );
      expect(result.current.syncState.isSyncing).toBe(false);
      expect(result.current.syncState.lastSyncAt).toBeInstanceOf(Date);
    });

    it('sets error on failure', async () => {
      mockUser = { uid: 'user-123' };
      mockSyncCalendarToTasks.mockRejectedValue(new Error('Sync failed'));

      const { result } = renderHook(
        () => useCalendarSync('board-1', [mockTask]),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        try {
          await result.current.syncFromCalendar();
        } catch {
          // expected
        }
      });

      expect(result.current.syncState.error).toBe('Sync failed');
    });
  });

  it('handles non-Error thrown objects gracefully', async () => {
    mockSyncTaskToCalendar.mockRejectedValue('string error');

    const { result } = renderHook(
      () => useCalendarSync('board-1', [mockTask]),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      try {
        await result.current.syncTaskToCalendar(mockTask);
      } catch {
        // expected
      }
    });

    expect(result.current.syncState.error).toBe('Sync failed');
  });
});
