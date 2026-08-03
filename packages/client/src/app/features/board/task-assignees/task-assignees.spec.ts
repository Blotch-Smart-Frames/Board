import { render, screen } from '@testing-library/angular';
import type { Collaborator } from '../../../shared/types/board';
import { TaskAssignees } from './task-assignees';

function collab(overrides: Partial<Collaborator> = {}): Collaborator {
  return {
    id: 'u1',
    email: 'u1@example.com',
    name: 'Jane Doe',
    isOwner: false,
    photoURL: null,
    ...overrides,
  };
}

describe('TaskAssignees', () => {
  it('renders nothing when the assigned list is empty', async () => {
    const view = await render(TaskAssignees, { inputs: { assignedUsers: [] } });
    expect(view.container.querySelector('.-space-x-2')).toBeNull();
  });

  it('shows up to three avatars in initial-fallback form', async () => {
    await render(TaskAssignees, {
      inputs: {
        assignedUsers: [
          collab({ id: 'a', name: 'Alice Anderson' }),
          collab({ id: 'b', name: 'Bob Baker' }),
          collab({ id: 'c', name: 'Cher' }),
        ],
      },
    });

    expect(screen.getByText('AA')).toBeInTheDocument();
    expect(screen.getByText('BB')).toBeInTheDocument();
    expect(screen.getByText('CH')).toBeInTheDocument();
  });

  it('caps visible avatars at three and shows the overflow count', async () => {
    await render(TaskAssignees, {
      inputs: {
        assignedUsers: [
          collab({ id: 'a', name: 'Alice Anderson' }),
          collab({ id: 'b', name: 'Bob Baker' }),
          collab({ id: 'c', name: 'Cher Cher' }),
          collab({ id: 'd', name: 'Dan Doe' }),
          collab({ id: 'e', name: 'Eve Evans' }),
        ],
      },
    });

    // Three avatars remain visible.
    expect(screen.getByText('AA')).toBeInTheDocument();
    expect(screen.getByText('BB')).toBeInTheDocument();
    expect(screen.getByText('CC')).toBeInTheDocument();
    // Two extras collapsed into a badge with a screen-reader label.
    expect(screen.getByLabelText('2 more assignees')).toHaveTextContent('+2');
    // No fourth avatar rendered.
    expect(screen.queryByText('DD')).not.toBeInTheDocument();
  });

  it('does not show the overflow badge when exactly three are assigned', async () => {
    await render(TaskAssignees, {
      inputs: {
        assignedUsers: [
          collab({ id: 'a', name: 'A A' }),
          collab({ id: 'b', name: 'B B' }),
          collab({ id: 'c', name: 'C C' }),
        ],
      },
    });

    expect(screen.queryByLabelText(/more assignees/)).not.toBeInTheDocument();
  });
});
