import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuthQuery } from './useAuthQuery';

const mockSignInWithGoogle = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthChange = vi.fn();
const mockHandleRedirectResult = vi.fn();
const mockSetAccessToken = vi.fn();

vi.mock('../services/firebase', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthChange: (...args: unknown[]) => mockOnAuthChange(...args),
  handleRedirectResult: (...args: unknown[]) =>
    mockHandleRedirectResult(...args),
}));

vi.mock('../services/calendarService', () => ({
  calendarService: {
    setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
  },
}));

vi.mock('../services/userService', () => ({
  syncUserProfile: vi.fn().mockResolvedValue(undefined),
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
    // Default: onAuthChange immediately calls callback with null (no user)
    mockOnAuthChange.mockImplementation((callback) => {
      // Simulate Firebase calling the callback with null initially
      setTimeout(() => callback(null), 0);
      return vi.fn(); // unsubscribe
    });
    mockHandleRedirectResult.mockResolvedValue(null);
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
      // Call immediately with null to simulate Firebase init
      setTimeout(() => callback(null), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useAuthQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Simulate Firebase auth emitting a user (e.g., after sign in)
    await act(async () => {
      authCallback!(mockUser);
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    expect(result.current.isAuthenticated).toBe(true);
  });

  it('calls signInWithGoogle on login', async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuthQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login();
    });

    expect(mockSignInWithGoogle).toHaveBeenCalled();
  });

  it('handles redirect result on mount', async () => {
    const accessToken = 'mock-access-token';
    mockHandleRedirectResult.mockResolvedValue({ user: mockUser, accessToken });

    // Simulate Firebase detecting user after redirect
    mockOnAuthChange.mockImplementation((callback) => {
      setTimeout(() => callback(mockUser), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useAuthQuery(), {
      wrapper: createWrapper(),
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify the redirect handler was called and access token set
    expect(mockHandleRedirectResult).toHaveBeenCalled();
    expect(mockSetAccessToken).toHaveBeenCalledWith(accessToken);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('logs out successfully', async () => {
    // Start with user logged in via auth state change
    mockOnAuthChange.mockImplementation((callback) => {
      // Start with user authenticated
      setTimeout(() => callback(mockUser), 0);
      return vi.fn();
    });
    mockSignOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuthQuery(), {
      wrapper: createWrapper(),
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
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('shows loading state during login', async () => {
    let resolveLogin!: () => void;
    mockSignInWithGoogle.mockReturnValue(
      new Promise<void>((resolve) => {
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
      resolveLogin();
      await loginPromise;
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
