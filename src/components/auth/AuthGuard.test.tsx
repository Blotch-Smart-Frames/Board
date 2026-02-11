import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthGuard } from './AuthGuard';

const mockUseAuthQuery = vi.fn();

vi.mock('../../hooks/useAuthQuery', () => ({
  useAuthQuery: () => mockUseAuthQuery(),
}));

// Mock GoogleAuthButton
vi.mock('./GoogleAuthButton', () => ({
  GoogleAuthButton: () => <button>Sign in with Google</button>,
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner when auth is loading', () => {
    mockUseAuthQuery.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows login screen when not authenticated', () => {
    mockUseAuthQuery.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(
      screen.getByRole('heading', { name: /board by blotch/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in with google/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows description text on login screen', () => {
    mockUseAuthQuery.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByText(/organize your tasks/i)).toBeInTheDocument();
    expect(
      screen.getByText(/sign in to access your boards/i),
    ).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseAuthQuery.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /sign in/i }),
    ).not.toBeInTheDocument();
  });

  it('renders multiple children when authenticated', () => {
    mockUseAuthQuery.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <AuthGuard>
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </AuthGuard>,
    );

    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
    expect(screen.getByText('Child 3')).toBeInTheDocument();
  });

  it('shows sign in prompt text', () => {
    mockUseAuthQuery.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(
      screen.getByText(/sign in to access your boards/i),
    ).toBeInTheDocument();
  });

  describe('State transitions', () => {
    it('transitions from loading to authenticated', () => {
      mockUseAuthQuery.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      });

      const { rerender } = render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      mockUseAuthQuery.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      rerender(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('transitions from loading to login screen', () => {
      mockUseAuthQuery.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      });

      const { rerender } = render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      mockUseAuthQuery.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      rerender(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(
        screen.getByRole('button', { name: /sign in/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});
