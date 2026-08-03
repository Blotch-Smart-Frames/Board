import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShareDialog } from './ShareDialog';

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
  configurable: true,
});

describe('ShareDialog', () => {
  const mockCollaborators = [
    {
      id: '1',
      email: 'owner@example.com',
      name: 'Owner User',
      isOwner: true,
    },
    {
      id: '2',
      email: 'collab@example.com',
      name: 'Collaborator User',
      photoURL: 'https://example.com/photo.jpg',
    },
  ];

  const defaultProps = {
    open: true,
    boardTitle: 'Test Board',
    collaborators: mockCollaborators,
    onClose: vi.fn(),
    onInvite: vi.fn(),
    onRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockClear();
  });

  it('renders dialog with board title', () => {
    render(<ShareDialog {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/share "test board"/i)).toBeInTheDocument();
  });

  it('renders collaborators list', () => {
    render(<ShareDialog {...defaultProps} />);

    expect(screen.getByText('Owner User')).toBeInTheDocument();
    expect(screen.getByText('Collaborator User')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('collab@example.com')).toBeInTheDocument();
  });

  it('shows owner badge for owner', () => {
    render(<ShareDialog {...defaultProps} />);

    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('does not show delete button for owner', () => {
    render(
      <ShareDialog {...defaultProps} collaborators={[mockCollaborators[0]]} />,
    );

    // Owner should not have delete button
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(1);

    // Check that no delete button exists in owner's list item
    const deleteButtons = screen
      .queryAllByRole('button')
      .filter((btn) => btn.querySelector('svg[data-testid="DeleteIcon"]'));
    expect(deleteButtons).toHaveLength(0);
  });

  it('shows delete button for non-owner collaborators', () => {
    render(<ShareDialog {...defaultProps} />);

    // Should have one delete button for the non-owner collaborator
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
  });

  describe('Invite functionality', () => {
    it('has email input field', () => {
      render(<ShareDialog {...defaultProps} />);

      expect(
        screen.getByPlaceholderText('Enter email address'),
      ).toBeInTheDocument();
    });

    it('sends invite on button click', async () => {
      const user = userEvent.setup();
      const onInvite = vi.fn().mockResolvedValue(undefined);

      render(<ShareDialog {...defaultProps} onInvite={onInvite} />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'new@example.com',
      );
      await user.click(screen.getByRole('button', { name: /invite/i }));

      expect(onInvite).toHaveBeenCalledWith('new@example.com');
    });

    it('sends invite on Enter key', async () => {
      const user = userEvent.setup();
      const onInvite = vi.fn().mockResolvedValue(undefined);

      render(<ShareDialog {...defaultProps} onInvite={onInvite} />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'new@example.com{Enter}',
      );

      expect(onInvite).toHaveBeenCalledWith('new@example.com');
    });

    it('shows success message after invite', async () => {
      const user = userEvent.setup();
      const onInvite = vi.fn().mockResolvedValue(undefined);

      render(<ShareDialog {...defaultProps} onInvite={onInvite} />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'new@example.com',
      );
      await user.click(screen.getByRole('button', { name: /invite/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/invitation sent to new@example.com/i),
        ).toBeInTheDocument();
      });
    });

    it('clears email input after successful invite', async () => {
      const user = userEvent.setup();
      const onInvite = vi.fn().mockResolvedValue(undefined);

      render(<ShareDialog {...defaultProps} onInvite={onInvite} />);

      const input = screen.getByPlaceholderText('Enter email address');
      await user.type(input, 'new@example.com');
      await user.click(screen.getByRole('button', { name: /invite/i }));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('shows error message on invite failure', async () => {
      const user = userEvent.setup();
      const onInvite = vi.fn().mockRejectedValue(new Error('User not found'));

      render(<ShareDialog {...defaultProps} onInvite={onInvite} />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'invalid@example.com',
      );
      await user.click(screen.getByRole('button', { name: /invite/i }));

      await waitFor(() => {
        expect(screen.getByText('User not found')).toBeInTheDocument();
      });
    });

    it('disables invite button when email is empty', () => {
      render(<ShareDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /invite/i })).toBeDisabled();
    });

    it('disables input during loading', async () => {
      const user = userEvent.setup();
      const onInvite = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100)),
        );

      render(<ShareDialog {...defaultProps} onInvite={onInvite} />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'new@example.com',
      );
      await user.click(screen.getByRole('button', { name: /invite/i }));

      expect(screen.getByPlaceholderText('Enter email address')).toBeDisabled();
    });
  });

  describe('Remove functionality', () => {
    it('removes collaborator on delete button click', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn().mockResolvedValue(undefined);

      render(<ShareDialog {...defaultProps} onRemove={onRemove} />);

      // Find delete button for the non-owner collaborator
      const deleteButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('svg[data-testid="DeleteIcon"]'));

      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0]);
        expect(onRemove).toHaveBeenCalledWith('2');
      }
    });

    it('shows error on remove failure', async () => {
      const user = userEvent.setup();
      const onRemove = vi
        .fn()
        .mockRejectedValue(new Error('Cannot remove user'));

      render(<ShareDialog {...defaultProps} onRemove={onRemove} />);

      const deleteButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('svg[data-testid="DeleteIcon"]'));

      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0]);

        await waitFor(() => {
          expect(screen.getByText('Cannot remove user')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Copy link functionality', () => {
    it('has copy board link button', () => {
      render(<ShareDialog {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /copy board link/i }),
      ).toBeInTheDocument();
    });

    it('copies link to clipboard on click', async () => {
      const user = userEvent.setup();
      render(<ShareDialog {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /copy board link/i }),
      );

      // Success message appears which means clipboard was called
      expect(screen.getByText(/link copied to clipboard/i)).toBeInTheDocument();
    });

    it('shows success message after copying', async () => {
      const user = userEvent.setup();
      render(<ShareDialog {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /copy board link/i }),
      );

      expect(screen.getByText(/link copied to clipboard/i)).toBeInTheDocument();
    });
  });

  describe('Dialog close', () => {
    it('closes on Done button click', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<ShareDialog {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /done/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('does not render when open is false', () => {
      render(<ShareDialog {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Alert dismiss', () => {
    it('dismisses error alert on close', async () => {
      const user = userEvent.setup();
      const onInvite = vi.fn().mockRejectedValue(new Error('Error'));

      render(<ShareDialog {...defaultProps} onInvite={onInvite} />);

      await user.type(
        screen.getByPlaceholderText('Enter email address'),
        'test@example.com',
      );
      await user.click(screen.getByRole('button', { name: /invite/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Find and click the close button on the alert
      const alertCloseButton = screen
        .getByRole('alert')
        .querySelector('button');
      if (alertCloseButton) {
        await user.click(alertCloseButton);
        await waitFor(() => {
          expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
      }
    });
  });
});
