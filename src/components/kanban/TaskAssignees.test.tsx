import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TaskAssignees } from './TaskAssignees';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

const createUser = (overrides: Partial<Collaborator> = {}): Collaborator => ({
  id: 'user-1',
  email: 'user@test.com',
  name: 'Test User',
  photoURL: null,
  isOwner: false,
  ...overrides,
});

describe('TaskAssignees', () => {
  it('renders nothing when no assigned users', () => {
    const { container } = render(<TaskAssignees assignedUsers={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders avatars for assigned users', () => {
    const users = [
      createUser({ id: 'u1', name: 'Alice', photoURL: 'https://example.com/alice.jpg' }),
      createUser({ id: 'u2', name: 'Bob', photoURL: 'https://example.com/bob.jpg' }),
    ];

    render(<TaskAssignees assignedUsers={users} />);

    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it('renders avatar group with max 3', () => {
    const users = [
      createUser({ id: 'u1', name: 'Alice' }),
      createUser({ id: 'u2', name: 'Bob' }),
      createUser({ id: 'u3', name: 'Charlie' }),
      createUser({ id: 'u4', name: 'Diana' }),
    ];

    const { container } = render(<TaskAssignees assignedUsers={users} />);

    // MUI AvatarGroup with max=3 shows 3 + overflow indicator
    const avatarGroup = container.querySelector('.MuiAvatarGroup-root');
    expect(avatarGroup).toBeInTheDocument();
  });
});
