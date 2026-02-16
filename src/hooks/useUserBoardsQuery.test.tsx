import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUserBoardsQuery } from './useUserBoardsQuery';

const mockOnSnapshot = vi.fn(() => vi.fn());

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [])),
  };
});

const mockCreateBoard = vi.fn();

vi.mock('../services/boardService', () => ({
  createBoard: (...args: unknown[]) => mockCreateBoard(...args),
}));

vi.mock('../queries/firestoreRefs', () => ({
  getUserBoardsQuery: vi.fn(),
  getCollaboratorBoardsQuery: vi.fn(),
}));

let mockUser: { uid: string } | null = null;
let mockIsAuthLoading = false;

vi.mock('./useAuthQuery', () => ({
  useAuthQuery: () => ({
    user: mockUser,
    accessToken: null,
    isLoading: mockIsAuthLoading,
    isAuthenticated: !!mockUser,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useUserBoardsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockUser = null;
    mockIsAuthLoading = false;
  });

  it('returns empty boards when user is not authenticated', () => {
    const { result } = renderHook(() => useUserBoardsQuery(), {
      wrapper: createWrapper(),
    });

    expect(result.current.boards).toEqual([]);
  });

  it('sets up Firestore subscriptions when user is authenticated', () => {
    mockUser = { uid: 'user-123' };

    renderHook(() => useUserBoardsQuery(), {
      wrapper: createWrapper(),
    });

    // One for owned boards, one for collaborator boards
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  it('does not subscribe when user is null', () => {
    mockUser = null;

    renderHook(() => useUserBoardsQuery(), {
      wrapper: createWrapper(),
    });

    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('does not subscribe while auth is still loading', () => {
    mockUser = null;
    mockIsAuthLoading = true;

    renderHook(() => useUserBoardsQuery(), {
      wrapper: createWrapper(),
    });

    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('unsubscribes from both snapshots on unmount', () => {
    mockUser = { uid: 'user-123' };
    const unsubOwned = vi.fn();
    const unsubCollaborated = vi.fn();
    mockOnSnapshot
      .mockReturnValueOnce(unsubOwned)
      .mockReturnValueOnce(unsubCollaborated);

    const { unmount } = renderHook(() => useUserBoardsQuery(), {
      wrapper: createWrapper(),
    });

    unmount();

    expect(unsubOwned).toHaveBeenCalled();
    expect(unsubCollaborated).toHaveBeenCalled();
  });

  it('shows loading when auth is loading', () => {
    mockIsAuthLoading = true;

    const { result } = renderHook(() => useUserBoardsQuery(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  describe('createBoard', () => {
    it('calls service with input and userId', async () => {
      mockUser = { uid: 'user-123' };
      const newBoard = {
        id: 'board-new',
        title: 'New Board',
        ownerId: 'user-123',
        collaborators: [],
      };
      mockCreateBoard.mockResolvedValue(newBoard);

      const { result } = renderHook(() => useUserBoardsQuery(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.createBoard({ title: 'New Board' });
      });

      expect(mockCreateBoard).toHaveBeenCalledWith(
        { title: 'New Board' },
        'user-123',
      );
    });

    it('throws when user is not authenticated', async () => {
      mockUser = null;

      const { result } = renderHook(() => useUserBoardsQuery(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.createBoard({ title: 'New Board' }),
      ).rejects.toThrow('Not authenticated');
    });
  });

  it('returns error as null', () => {
    const { result } = renderHook(() => useUserBoardsQuery(), {
      wrapper: createWrapper(),
    });

    expect(result.current.error).toBeNull();
  });
});
