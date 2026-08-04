import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AssigneeFilter } from './AssigneeFilter';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

const createCollaborator = (
  overrides: Partial<Collaborator> = {},
): Collaborator => ({
  id: 'user-1',
  email: 'user@test.com',
  name: 'Test User',
  photoURL: null,
  isOwner: false,
  ...overrides,
});

describe('AssigneeFilter', () => {
  it('renders "All" chip and one chip per collaborator', () => {
    const collaborators = [
      createCollaborator({ id: 'u1', name: 'Alice' }),
      createCollaborator({ id: 'u2', name: 'Bob' }),
    ];

    render(
      <AssigneeFilter
        collaborators={collaborators}
        selectedAssigneeId={null}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('"All" is selected by default when selectedAssigneeId is null', () => {
    render(
      <AssigneeFilter
        collaborators={[createCollaborator({ id: 'u1', name: 'Alice' })]}
        selectedAssigneeId={null}
        onFilterChange={vi.fn()}
      />,
    );

    const allChip = screen.getByText('All').closest('.MuiChip-root');
    expect(allChip).toHaveClass('MuiChip-filled');
    expect(allChip).toHaveClass('MuiChip-colorPrimary');
  });

  it('clicking a collaborator chip calls onFilterChange with their ID', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const collaborators = [createCollaborator({ id: 'u1', name: 'Alice' })];

    render(
      <AssigneeFilter
        collaborators={collaborators}
        selectedAssigneeId={null}
        onFilterChange={onFilterChange}
      />,
    );

    await user.click(screen.getByText('Alice'));

    expect(onFilterChange).toHaveBeenCalledWith('u1');
  });

  it('clicking "All" calls onFilterChange with null', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    render(
      <AssigneeFilter
        collaborators={[createCollaborator({ id: 'u1', name: 'Alice' })]}
        selectedAssigneeId="u1"
        onFilterChange={onFilterChange}
      />,
    );

    await user.click(screen.getByText('All'));

    expect(onFilterChange).toHaveBeenCalledWith(null);
  });

  it('handles empty collaborators array', () => {
    render(
      <AssigneeFilter
        collaborators={[]}
        selectedAssigneeId={null}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByText('All')).toBeInTheDocument();
  });
});
