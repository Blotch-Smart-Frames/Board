import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCollaboratorsQuery } from './useCollaboratorsQuery';
import type { Board } from '../types/board';
import type { User as FirebaseUser } from 'firebase/auth';

const mockGetUsersByIds = vi.fn();
vi.mock('../services/userService', () => ({
  getUsersByIds: (...args: unknown[]) => mockGetUsersByIds(...args),
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

const createMockBoard = (overrides: Partial<Board> = {}): Board =>
  ({
    id: 'board-1',
    title: 'Test Board',
    ownerId: 'owner-1',
    collaborators: ['user-2', 'user-3'],
    ...overrides,
  }) as Board;

const createMockFirebaseUser = (
  overrides: Partial<FirebaseUser> = {},
): FirebaseUser =>
  ({
    uid: 'owner-1',
    email: 'owner@test.com',
    displayName: 'Owner',
    photoURL: 'https://example.com/owner.jpg',
    ...overrides,
  }) as FirebaseUser;

describe('useCollaboratorsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty collaborators when board is undefined', () => {
    const { result } = renderHook(
      () => useCollaboratorsQuery(undefined, null),
      { wrapper: createWrapper() },
    );

    expect(result.current.collaborators).toEqual([]);
  });

  it('returns collaborators with user data', async () => {
    mockGetUsersByIds.mockResolvedValue([
      { id: 'owner-1', email: 'owner@test.com', displayName: 'Owner', photoURL: null },
      { id: 'user-2', email: 'user2@test.com', displayName: 'User 2', photoURL: null },
      { id: 'user-3', email: 'user3@test.com', displayName: 'User 3', photoURL: null },
    ]);

    const board = createMockBoard();

    const { result } = renderHook(
      () => useCollaboratorsQuery(board, createMockFirebaseUser()),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.collaborators).toHaveLength(3);
    });

    const owner = result.current.collaborators.find((c) => c.isOwner);
    expect(owner?.id).toBe('owner-1');
    expect(owner?.isOwner).toBe(true);
  });

  it('uses current user as fallback for owner when not in users collection', async () => {
    mockGetUsersByIds.mockResolvedValue([]);

    const board = createMockBoard({ collaborators: [] });
    const firebaseUser = createMockFirebaseUser();

    const { result } = renderHook(
      () => useCollaboratorsQuery(board, firebaseUser),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.collaborators).toHaveLength(1);
    });

    expect(result.current.collaborators[0].name).toBe('Owner');
    expect(result.current.collaborators[0].isOwner).toBe(true);
  });

  it('returns Unknown User for non-owner users not in collection', async () => {
    mockGetUsersByIds.mockResolvedValue([]);

    const board = createMockBoard({
      ownerId: 'owner-1',
      collaborators: ['unknown-user'],
    });

    const { result } = renderHook(
      () => useCollaboratorsQuery(board, null),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.collaborators).toHaveLength(2);
    });

    const unknown = result.current.collaborators.find(
      (c) => c.id === 'unknown-user',
    );
    expect(unknown?.name).toBe('Unknown User');
  });
});
