import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AssigneeFilter } from './assignee-filter';
import type { Collaborator } from '../../../shared/types/board';

function fakeCollaborator(overrides: Partial<Collaborator> = {}): Collaborator {
  return {
    id: 'u1',
    email: 'jane@example.com',
    name: 'Jane Doe',
    isOwner: false,
    ...overrides,
  };
}

describe('AssigneeFilter', () => {
  it('renders All plus each collaborator name', async () => {
    const collaborators = [fakeCollaborator(), fakeCollaborator({ id: 'u2', name: 'John Smith' })];
    await render(AssigneeFilter, { inputs: { collaborators } });

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Jane Doe/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /John Smith/ })).toBeInTheDocument();
  });

  it('emits the collaborator id when their button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(AssigneeFilter, {
      inputs: { collaborators: [fakeCollaborator()] },
      on: { selectedAssigneeIdChange: onChange },
    });

    await user.click(screen.getByRole('button', { name: /Jane Doe/ }));

    expect(onChange).toHaveBeenCalledWith('u1');
  });

  it('emits null when All is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(AssigneeFilter, {
      inputs: { collaborators: [fakeCollaborator()], selectedAssigneeId: 'u1' },
      on: { selectedAssigneeIdChange: onChange },
    });

    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
