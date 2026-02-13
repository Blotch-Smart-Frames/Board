import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSprintsQuery } from './useSprintsQuery';

const mockOnSnapshot = vi.fn(() => vi.fn());

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [])),
  };
});

const mockCreateSprint = vi.fn();
const mockUpdateSprint = vi.fn();
const mockDeleteSprint = vi.fn();
const mockCanDeleteSprint = vi.fn();
const mockCalculateNextSprintDates = vi.fn();
const mockUpdateSprintConfig = vi.fn();

vi.mock('../services/sprintService', () => ({
  createSprint: (...args: unknown[]) => mockCreateSprint(...args),
  updateSprint: (...args: unknown[]) => mockUpdateSprint(...args),
  deleteSprint: (...args: unknown[]) => mockDeleteSprint(...args),
  canDeleteSprint: (...args: unknown[]) => mockCanDeleteSprint(...args),
  calculateNextSprintDates: (...args: unknown[]) =>
    mockCalculateNextSprintDates(...args),
  updateSprintConfig: (...args: unknown[]) => mockUpdateSprintConfig(...args),
}));

vi.mock('../queries/firestoreRefs', () => ({
  getBoardSprintsQuery: vi.fn(),
}));

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

describe('useSprintsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
  });

  it('returns empty sprints when boardId is null', () => {
    const { result } = renderHook(() => useSprintsQuery(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.sprints).toEqual([]);
  });

  it('sets up Firestore subscription when boardId is provided', () => {
    renderHook(() => useSprintsQuery('board-1'), {
      wrapper: createWrapper(),
    });

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe when boardId is null', () => {
    renderHook(() => useSprintsQuery(null), {
      wrapper: createWrapper(),
    });

    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('unsubscribes from snapshot on unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useSprintsQuery('board-1'), {
      wrapper: createWrapper(),
    });

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  describe('createSprint', () => {
    it('calls service with boardId and input', async () => {
      mockCreateSprint.mockResolvedValue(undefined);
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-14');

      const { result } = renderHook(() => useSprintsQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.createSprint({
          name: 'Sprint 1',
          startDate,
          endDate,
        });
      });

      expect(mockCreateSprint).toHaveBeenCalledWith('board-1', {
        name: 'Sprint 1',
        startDate,
        endDate,
      });
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useSprintsQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.createSprint({
          name: 'Sprint 1',
          startDate: new Date(),
          endDate: new Date(),
        }),
      ).rejects.toThrow('No board selected');
    });
  });

  describe('updateSprint', () => {
    it('calls service with boardId, sprintId, and updates', async () => {
      mockUpdateSprint.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSprintsQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.updateSprint('sprint-1', { name: 'Sprint 2' });
      });

      expect(mockUpdateSprint).toHaveBeenCalledWith('board-1', 'sprint-1', {
        name: 'Sprint 2',
      });
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useSprintsQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.updateSprint('sprint-1', { name: 'Sprint 2' }),
      ).rejects.toThrow('No board selected');
    });
  });

  describe('deleteSprint', () => {
    it('calls service with boardId and sprintId', async () => {
      mockDeleteSprint.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSprintsQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.deleteSprint('sprint-1');
      });

      expect(mockDeleteSprint).toHaveBeenCalledWith('board-1', 'sprint-1');
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useSprintsQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(result.current.deleteSprint('sprint-1')).rejects.toThrow(
        'No board selected',
      );
    });
  });

  describe('canDeleteSprint', () => {
    it('calls service with boardId and sprintId', async () => {
      mockCanDeleteSprint.mockResolvedValue({ canDelete: true, taskCount: 0 });

      const { result } = renderHook(() => useSprintsQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const response = await result.current.canDeleteSprint('sprint-1');
        expect(response).toEqual({ canDelete: true, taskCount: 0 });
      });

      expect(mockCanDeleteSprint).toHaveBeenCalledWith('board-1', 'sprint-1');
    });

    it('returns false with task count when tasks are assigned', async () => {
      mockCanDeleteSprint.mockResolvedValue({ canDelete: false, taskCount: 3 });

      const { result } = renderHook(() => useSprintsQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const response = await result.current.canDeleteSprint('sprint-1');
        expect(response).toEqual({ canDelete: false, taskCount: 3 });
      });
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useSprintsQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.canDeleteSprint('sprint-1'),
      ).rejects.toThrow('No board selected');
    });
  });

  describe('calculateNextSprintDates', () => {
    it('calls service with boardId', async () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-28');
      mockCalculateNextSprintDates.mockResolvedValue({
        startDate,
        endDate,
        suggestedName: 'Sprint 2',
      });

      const { result } = renderHook(() => useSprintsQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const response = await result.current.calculateNextSprintDates();
        expect(response).toEqual({
          startDate,
          endDate,
          suggestedName: 'Sprint 2',
        });
      });

      expect(mockCalculateNextSprintDates).toHaveBeenCalledWith('board-1');
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useSprintsQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.calculateNextSprintDates(),
      ).rejects.toThrow('No board selected');
    });
  });

  describe('updateSprintConfig', () => {
    it('calls service with boardId and config', async () => {
      mockUpdateSprintConfig.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSprintsQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.updateSprintConfig({ durationDays: 14 });
      });

      expect(mockUpdateSprintConfig).toHaveBeenCalledWith('board-1', {
        durationDays: 14,
      });
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useSprintsQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.updateSprintConfig({ durationDays: 14 }),
      ).rejects.toThrow('No board selected');
    });
  });
});
