import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useLabelsQuery } from './useLabelsQuery';

const mockOnSnapshot = vi.fn(() => vi.fn());

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [])),
  };
});

const mockCreateLabel = vi.fn();
const mockUpdateLabel = vi.fn();
const mockDeleteLabel = vi.fn();
const mockInitializeDefaultLabels = vi.fn();

vi.mock('../services/labelService', () => ({
  createLabel: (...args: unknown[]) => mockCreateLabel(...args),
  updateLabel: (...args: unknown[]) => mockUpdateLabel(...args),
  deleteLabel: (...args: unknown[]) => mockDeleteLabel(...args),
  initializeDefaultLabels: (...args: unknown[]) =>
    mockInitializeDefaultLabels(...args),
}));

vi.mock('../queries/firestoreRefs', () => ({
  getBoardLabelsQuery: vi.fn(),
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

describe('useLabelsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
  });

  it('returns empty labels when boardId is null', () => {
    const { result } = renderHook(() => useLabelsQuery(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.labels).toEqual([]);
  });

  it('sets up Firestore subscription when boardId is provided', () => {
    renderHook(() => useLabelsQuery('board-1'), {
      wrapper: createWrapper(),
    });

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe when boardId is null', () => {
    renderHook(() => useLabelsQuery(null), {
      wrapper: createWrapper(),
    });

    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('unsubscribes from snapshot on unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useLabelsQuery('board-1'), {
      wrapper: createWrapper(),
    });

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  describe('createLabel', () => {
    it('calls service with boardId and input', async () => {
      mockCreateLabel.mockResolvedValue(undefined);

      const { result } = renderHook(() => useLabelsQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.createLabel({ name: 'Bug', color: '#ff0000' });
      });

      expect(mockCreateLabel).toHaveBeenCalledWith('board-1', {
        name: 'Bug',
        color: '#ff0000',
      });
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useLabelsQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.createLabel({ name: 'Bug', color: '#ff0000' }),
      ).rejects.toThrow('No board selected');
    });
  });

  describe('updateLabel', () => {
    it('calls service with boardId, labelId, and updates', async () => {
      mockUpdateLabel.mockResolvedValue(undefined);

      const { result } = renderHook(() => useLabelsQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.updateLabel('label-1', { name: 'Feature' });
      });

      expect(mockUpdateLabel).toHaveBeenCalledWith('board-1', 'label-1', {
        name: 'Feature',
      });
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useLabelsQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.updateLabel('label-1', { name: 'Feature' }),
      ).rejects.toThrow('No board selected');
    });
  });

  describe('deleteLabel', () => {
    it('calls service with boardId and labelId', async () => {
      mockDeleteLabel.mockResolvedValue(undefined);

      const { result } = renderHook(() => useLabelsQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.deleteLabel('label-1');
      });

      expect(mockDeleteLabel).toHaveBeenCalledWith('board-1', 'label-1');
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useLabelsQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(result.current.deleteLabel('label-1')).rejects.toThrow(
        'No board selected',
      );
    });
  });

  describe('initializeDefaultLabels', () => {
    it('calls service with boardId', async () => {
      mockInitializeDefaultLabels.mockResolvedValue(undefined);

      const { result } = renderHook(() => useLabelsQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.initializeDefaultLabels();
      });

      expect(mockInitializeDefaultLabels).toHaveBeenCalledWith('board-1');
    });

    it('throws when boardId is null', async () => {
      const { result } = renderHook(() => useLabelsQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(result.current.initializeDefaultLabels()).rejects.toThrow(
        'No board selected',
      );
    });
  });
});
