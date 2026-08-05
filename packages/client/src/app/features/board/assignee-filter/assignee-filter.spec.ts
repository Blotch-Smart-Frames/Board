import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AssigneeFilter } from './assignee-filter';
import type { Collaborator } from '../../../shared/types/board';

// jsdom lacks these; the select's active-descendant key manager and the
// popover overlay touch them as soon as the option list opens.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoViewPolyfill(): void {};

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
  it('shows the placeholder when nothing is selected', async () => {
    await render(AssigneeFilter, { inputs: { collaborators: [fakeCollaborator()] } });

    expect(screen.getByText('Filter by assignee')).toBeInTheDocument();
  });

  it('opens the dropdown to show an option per collaborator', async () => {
    const user = userEvent.setup();
    const collaborators = [fakeCollaborator(), fakeCollaborator({ id: 'u2', name: 'John Smith' })];
    await render(AssigneeFilter, { inputs: { collaborators } });

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByRole('option', { name: /jane doe/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /john smith/i })).toBeInTheDocument();
  });

  it('emits the collaborator id added to the array when an option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(AssigneeFilter, {
      inputs: { collaborators: [fakeCollaborator()] },
      on: { selectedAssigneeIdsChange: onChange },
    });

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /jane doe/i }));

    expect(onChange).toHaveBeenCalledWith(['u1']);
  });

  it('emits the collaborator id removed when an already-selected option is clicked again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(AssigneeFilter, {
      inputs: { collaborators: [fakeCollaborator()], selectedAssigneeIds: ['u1'] },
      on: { selectedAssigneeIdsChange: onChange },
    });

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /jane doe/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows the selected collaborator name on the trigger instead of the placeholder', async () => {
    await render(AssigneeFilter, {
      inputs: { collaborators: [fakeCollaborator()], selectedAssigneeIds: ['u1'] },
    });

    // Both the trigger and the (hidden) option render the name — assert on the
    // trigger by targeting the combobox subtree.
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Jane Doe');
    // hlm-select-placeholder keeps its text in the DOM but marks itself
    // hidden via data-hidden when the select has a value.
    expect(screen.getByText('Filter by assignee')).toHaveAttribute('data-hidden', '');
  });

  it('shows a "(+N more)" hint on the trigger when multiple collaborators are selected', async () => {
    const collaborators = [fakeCollaborator(), fakeCollaborator({ id: 'u2', name: 'John Smith' })];
    await render(AssigneeFilter, {
      inputs: { collaborators, selectedAssigneeIds: ['u1', 'u2'] },
    });

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Jane Doe');
    expect(trigger).toHaveTextContent('(+1 more)');
  });

  it('shows a "No collaborators" hint when the board has none', async () => {
    const user = userEvent.setup();
    await render(AssigneeFilter, { inputs: { collaborators: [] } });

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText(/no collaborators/i)).toBeInTheDocument();
  });

  it('ignores non-array values dispatched to onValueChange (defensive fallback)', async () => {
    const onChange = vi.fn();
    const { fixture } = await render(AssigneeFilter, {
      inputs: { collaborators: [fakeCollaborator()] },
      on: { selectedAssigneeIdsChange: onChange },
    });

    fixture.componentInstance['onValueChange']('single-value');

    expect(onChange).not.toHaveBeenCalled();
  });
});
