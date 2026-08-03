import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AssigneePicker } from './AssigneePicker';
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

describe('AssigneePicker', () => {
  it('renders nothing when collaborators is empty', () => {
    const { container } = render(
      <AssigneePicker
        collaborators={[]}
        selectedUserIds={[]}
        onChange={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders assignees label', () => {
    const collaborators = [createCollaborator()];
    render(
      <AssigneePicker
        collaborators={collaborators}
        selectedUserIds={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Assignees')).toBeInTheDocument();
  });

  it('renders collaborator names', () => {
    const collaborators = [
      createCollaborator({ id: 'u1', name: 'Alice' }),
      createCollaborator({ id: 'u2', name: 'Bob' }),
    ];
    render(
      <AssigneePicker
        collaborators={collaborators}
        selectedUserIds={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows checkboxes checked for selected users', () => {
    const collaborators = [
      createCollaborator({ id: 'u1', name: 'Alice' }),
      createCollaborator({ id: 'u2', name: 'Bob' }),
    ];
    render(
      <AssigneePicker
        collaborators={collaborators}
        selectedUserIds={['u1']}
        onChange={vi.fn()}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('calls onChange to add user when clicking unchecked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const collaborators = [createCollaborator({ id: 'u1', name: 'Alice' })];

    render(
      <AssigneePicker
        collaborators={collaborators}
        selectedUserIds={[]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByText('Alice'));

    expect(onChange).toHaveBeenCalledWith(['u1']);
  });

  it('calls onChange to remove user when clicking checked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const collaborators = [createCollaborator({ id: 'u1', name: 'Alice' })];

    render(
      <AssigneePicker
        collaborators={collaborators}
        selectedUserIds={['u1']}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByText('Alice'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('sorts owners before non-owners', () => {
    const collaborators = [
      createCollaborator({ id: 'u1', name: 'Zara', isOwner: false }),
      createCollaborator({ id: 'u2', name: 'Alice', isOwner: true }),
    ];

    render(
      <AssigneePicker
        collaborators={collaborators}
        selectedUserIds={[]}
        onChange={vi.fn()}
      />,
    );

    const names = screen.getAllByText(/Alice|Zara/);
    expect(names[0]).toHaveTextContent('Alice');
    expect(names[1]).toHaveTextContent('Zara');
  });
});
