import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AssigneePicker } from './assignee-picker';
import type { Collaborator } from '../../../shared/types/board';

function fakeCollaborator(overrides: Partial<Collaborator> = {}): Collaborator {
  return {
    id: 'u1',
    email: 'jane@example.com',
    name: 'Jane Doe',
    photoURL: null,
    isOwner: false,
    ...overrides,
  };
}

describe('AssigneePicker', () => {
  it('renders a row for each collaborator', async () => {
    const collaborators = [
      fakeCollaborator({ id: 'u1', name: 'Alice' }),
      fakeCollaborator({ id: 'u2', name: 'Bob' }),
    ];
    await render(AssigneePicker, { inputs: { collaborators } });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('sorts owners before non-owners regardless of input order', async () => {
    const collaborators = [
      fakeCollaborator({ id: 'u1', name: 'Bob', isOwner: false }),
      fakeCollaborator({ id: 'u2', name: 'Alice', isOwner: true }),
    ];
    await render(AssigneePicker, { inputs: { collaborators } });

    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Alice');
    expect(rows[1]).toHaveTextContent('Bob');
  });

  it('emits the collaborator id added when an unselected row is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const collaborators = [fakeCollaborator({ id: 'u1', name: 'Alice' })];
    await render(AssigneePicker, {
      inputs: { collaborators, selectedUserIds: [] },
      on: { selectedUserIdsChange: onChange },
    });

    await user.click(screen.getByRole('button'));

    expect(onChange).toHaveBeenCalledWith(['u1']);
  });

  it('emits the collaborator id removed when an already-selected row is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const collaborators = [
      fakeCollaborator({ id: 'u1', name: 'Alice' }),
      fakeCollaborator({ id: 'u2', name: 'Bob' }),
    ];
    await render(AssigneePicker, {
      inputs: { collaborators, selectedUserIds: ['u1', 'u2'] },
      on: { selectedUserIdsChange: onChange },
    });

    const [aliceRow] = screen.getAllByRole('button');
    await user.click(aliceRow);

    expect(onChange).toHaveBeenCalledWith(['u2']);
  });

  it('renders nothing when there are no collaborators', async () => {
    await render(AssigneePicker, { inputs: { collaborators: [] } });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sorts within the same owner group alphabetically', async () => {
    const collaborators = [
      fakeCollaborator({ id: 'u1', name: 'Charlie', isOwner: false }),
      fakeCollaborator({ id: 'u2', name: 'Alice', isOwner: false }),
      fakeCollaborator({ id: 'u3', name: 'Bob', isOwner: false }),
    ];
    await render(AssigneePicker, { inputs: { collaborators } });

    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Alice');
    expect(rows[1]).toHaveTextContent('Bob');
    expect(rows[2]).toHaveTextContent('Charlie');
  });
});
