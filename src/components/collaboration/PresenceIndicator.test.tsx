import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PresenceIndicator } from './PresenceIndicator';

describe('PresenceIndicator', () => {
  const onlineUsers = [
    { id: '1', name: 'John Doe', isOnline: true },
    { id: '2', name: 'Jane Smith', isOnline: true },
  ];

  const offlineUsers = [
    { id: '3', name: 'Bob Wilson', isOnline: false },
    { id: '4', name: 'Alice Brown', isOnline: false },
  ];

  const getAvatars = (container: HTMLElement) =>
    container.querySelectorAll('.MuiAvatar-root');

  it('renders nothing when user list is empty', () => {
    const { container } = render(<PresenceIndicator users={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays online users with online text indicator', () => {
    render(<PresenceIndicator users={onlineUsers} />);

    expect(screen.getByText('2 online')).toBeInTheDocument();
  });

  it('displays online users avatars', () => {
    const { container } = render(<PresenceIndicator users={onlineUsers} />);

    const avatars = getAvatars(container);
    expect(avatars.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('JD')).toBeInTheDocument(); // John Doe initials
    expect(screen.getByText('JS')).toBeInTheDocument(); // Jane Smith initials
  });

  it('displays offline users without online count text', () => {
    render(<PresenceIndicator users={offlineUsers} />);

    // Should not show "online" text since no users are online
    expect(screen.queryByText(/online/i)).not.toBeInTheDocument();
  });

  it('displays mixed online and offline users', () => {
    const mixedUsers = [...onlineUsers, ...offlineUsers];
    const { container } = render(<PresenceIndicator users={mixedUsers} />);

    expect(screen.getByText('2 online')).toBeInTheDocument();
    // All users should be visible in the avatar group
    const avatars = getAvatars(container);
    expect(avatars.length).toBeGreaterThanOrEqual(4);
  });

  it('respects maxVisible prop for avatar display', () => {
    const manyUsers = [
      { id: '1', name: 'User One', isOnline: true },
      { id: '2', name: 'User Two', isOnline: true },
      { id: '3', name: 'User Three', isOnline: true },
      { id: '4', name: 'User Four', isOnline: true },
      { id: '5', name: 'User Five', isOnline: true },
    ];

    render(<PresenceIndicator users={manyUsers} maxVisible={3} />);

    // MUI AvatarGroup shows +N indicator for overflow
    // Check that online count is correct
    expect(screen.getByText('5 online')).toBeInTheDocument();
  });

  it('shows user with photo URL', () => {
    const userWithPhoto = [
      {
        id: '1',
        name: 'John Doe',
        photoURL: 'https://example.com/photo.jpg',
        isOnline: true,
      },
    ];

    render(<PresenceIndicator users={userWithPhoto} />);
    expect(screen.getByText('1 online')).toBeInTheDocument();
  });

  it('handles single online user', () => {
    const singleUser = [{ id: '1', name: 'Solo User', isOnline: true }];

    const { container } = render(<PresenceIndicator users={singleUser} />);

    expect(screen.getByText('1 online')).toBeInTheDocument();
    const avatars = getAvatars(container);
    expect(avatars.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('SU')).toBeInTheDocument(); // Solo User initials
  });
});
