import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppBar } from './AppBar';

const mockLogout = vi.fn();
const mockUseAuthQuery = vi.fn();

vi.mock('../../hooks/useAuthQuery', () => ({
  useAuthQuery: () => mockUseAuthQuery(),
}));

describe('AppBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('When not authenticated', () => {
    beforeEach(() => {
      mockUseAuthQuery.mockReturnValue({
        user: null,
        isAuthenticated: false,
        logout: mockLogout,
      });
    });

    it('displays app title', () => {
      render(<AppBar />);

      expect(screen.getByText('Board by Blotch')).toBeInTheDocument();
    });

    it('displays custom title', () => {
      render(<AppBar title="My Custom Board" />);

      expect(screen.getByText('My Custom Board')).toBeInTheDocument();
    });

    it('does not show user avatar', () => {
      render(<AppBar />);

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('When authenticated', () => {
    const mockUser = {
      displayName: 'John Doe',
      email: 'john@example.com',
      photoURL: 'https://example.com/photo.jpg',
    };

    beforeEach(() => {
      mockUseAuthQuery.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        logout: mockLogout,
      });
    });

    it('shows user avatar', () => {
      render(<AppBar />);

      expect(screen.getByRole('img', { name: 'John Doe' })).toBeInTheDocument();
    });

    it('opens menu on avatar click', async () => {
      const user = userEvent.setup();
      render(<AppBar />);

      await user.click(screen.getByRole('img', { name: 'John Doe' }));

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('shows user info in menu', async () => {
      const user = userEvent.setup();
      render(<AppBar />);

      await user.click(screen.getByRole('img', { name: 'John Doe' }));

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('shows Sign out menu item', async () => {
      const user = userEvent.setup();
      render(<AppBar />);

      await user.click(screen.getByRole('img', { name: 'John Doe' }));

      expect(
        screen.getByRole('menuitem', { name: /sign out/i }),
      ).toBeInTheDocument();
    });

    it('calls logout on Sign out click', async () => {
      const user = userEvent.setup();
      render(<AppBar />);

      await user.click(screen.getByRole('img', { name: 'John Doe' }));
      await user.click(screen.getByRole('menuitem', { name: /sign out/i }));

      expect(mockLogout).toHaveBeenCalled();
    });

    it('closes menu after logout', async () => {
      const user = userEvent.setup();
      mockLogout.mockResolvedValue(undefined);
      render(<AppBar />);

      await user.click(screen.getByRole('img', { name: 'John Doe' }));
      await user.click(screen.getByRole('menuitem', { name: /sign out/i }));

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('Menu button', () => {
    beforeEach(() => {
      mockUseAuthQuery.mockReturnValue({
        user: null,
        isAuthenticated: false,
        logout: mockLogout,
      });
    });

    it('shows menu button when onMenuClick provided', () => {
      render(<AppBar onMenuClick={() => {}} />);

      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
    });

    it('does not show menu button when onMenuClick not provided', () => {
      render(<AppBar />);

      expect(
        screen.queryByRole('button', { name: /menu/i }),
      ).not.toBeInTheDocument();
    });

    it('calls onMenuClick when menu button clicked', async () => {
      const user = userEvent.setup();
      const onMenuClick = vi.fn();
      render(<AppBar onMenuClick={onMenuClick} />);

      await user.click(screen.getByRole('button', { name: /menu/i }));

      expect(onMenuClick).toHaveBeenCalled();
    });
  });

  describe('Share button', () => {
    beforeEach(() => {
      mockUseAuthQuery.mockReturnValue({
        user: null,
        isAuthenticated: false,
        logout: mockLogout,
      });
    });

    it('shows share button when showShare is true and onShare provided', () => {
      render(<AppBar showShare onShare={() => {}} />);

      expect(
        screen.getByRole('button', { name: /share/i }),
      ).toBeInTheDocument();
    });

    it('does not show share button when showShare is false', () => {
      render(<AppBar showShare={false} onShare={() => {}} />);

      expect(
        screen.queryByRole('button', { name: /share/i }),
      ).not.toBeInTheDocument();
    });

    it('does not show share button when onShare not provided', () => {
      render(<AppBar showShare />);

      expect(
        screen.queryByRole('button', { name: /share/i }),
      ).not.toBeInTheDocument();
    });

    it('calls onShare when share button clicked', async () => {
      const user = userEvent.setup();
      const onShare = vi.fn();
      render(<AppBar showShare onShare={onShare} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      expect(onShare).toHaveBeenCalled();
    });
  });

  describe('With user without displayName', () => {
    it('falls back to email for avatar name', () => {
      mockUseAuthQuery.mockReturnValue({
        user: {
          displayName: null,
          email: 'user@example.com',
          photoURL: null,
        },
        isAuthenticated: true,
        logout: mockLogout,
      });

      const { container } = render(<AppBar />);

      // Avatar with initials from email
      const avatar = container.querySelector('.MuiAvatar-root');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveTextContent('US'); // user@example.com -> US
    });

    it("falls back to 'User' when no name or email", () => {
      mockUseAuthQuery.mockReturnValue({
        user: {
          displayName: null,
          email: null,
          photoURL: null,
        },
        isAuthenticated: true,
        logout: mockLogout,
      });

      const { container } = render(<AppBar />);

      // Avatar should show initials from "User"
      const avatar = container.querySelector('.MuiAvatar-root');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveTextContent('US'); // User -> US
    });
  });
});
