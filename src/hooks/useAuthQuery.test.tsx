import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuthQuery } from './useAuthQuery';

const mockSignInWithGoogle = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthChange = vi.fn();
const mockSetAccessToken = vi.fn();

vi.mock('../services/firebase', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthChange: (...args: unknown[]) => mockOnAuthChange(...args),
}));

vi.mock('../services/calendarService', () => ({
  calendarService: {
    setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
  },
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

const mockUser = {
  uid: 'user-123',
  email: 'test@example.com',
  displayName: 'Test User',
};

describe('useAuthQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthChange.mockReturnValue(vi.fn());
  });

  it('initializes with no user and not authenticated', async () => {
    const { result } = renderHook(() => useAuthQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('subscribes to auth state changes on mount', () => {
    renderHook(() => useAuthQuery(), { wrapper: createWrapper() });

    expect(mockOnAuthChange).toHaveBeenCalledWith(expect.any(Function));
  });

  it('unsubscribes from auth state on unmount', () => {
    const unsubscribe = vi.fn();
    mockOnAuthChange.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useAuthQuery(), {
      wrapper: createWrapper(),
    });

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('updates user when auth state changes', async () => {
    let authCallback: ((user: unknown) => void) | null = null;
    mockOnAuthChange.mockImplementation((callback) => {
      authCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useAuthQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Simulate Firebase auth emitting a user
    act(() => {
      authCallback!(mockUser);
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    expect(result.current.isAuthenticated).toBe(true);
  });

  it('logs in successfully via signInWithGoogle', async () => {
    const accessToken = 'mock-access-token';
    mockSignInWithGoogle.mockResolvedValue({ user: mockUser, accessToken });

    const { result } = renderHook(() => useAuthQuery(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.login();
    });

    expect(mockSignInWithGoogle).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    expect(result.current.accessToken).toBe(accessToken);
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockSetAccessToken).toHaveBeenCalledWith(accessToken);
  });

  it('logs out successfully', async () => {
    mockSignInWithGoogle.mockResolvedValue({
      user: mockUser,
      accessToken: 'token',
    });
    mockSignOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuthQuery(), {
      wrapper: createWrapper(),
    });

    // Login first
    await act(async () => {
      await result.current.login();
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    // Then logout
    await act(async () => {
      await result.current.logout();
    });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('shows loading state during login', async () => {
    let resolveLogin!: (value: unknown) => void;
    mockSignInWithGoogle.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

    const { result } = renderHook(() => useAuthQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let loginPromise: Promise<unknown>;
    act(() => {
      loginPromise = result.current.login().catch(() => {});
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    await act(async () => {
      resolveLogin({ user: mockUser, accessToken: 'token' });
      await loginPromise;
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
