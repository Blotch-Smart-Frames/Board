import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ShareCollaboratorList } from './share-collaborator-list';
import type { Collaborator } from '../../../../shared/types/board';

function fakeCollaborator(overrides: Partial<Collaborator> = {}): Collaborator {
  return {
    id: 'u1',
    email: 'owner@example.com',
    name: 'Owner Person',
    photoURL: null,
    isOwner: true,
    ...overrides,
  };
}

describe('ShareCollaboratorList', () => {
  it('badges the owner and hides the remove button for owners', async () => {
    await render(ShareCollaboratorList, {
      inputs: {
        collaborators: [
          fakeCollaborator({ id: 'u1', name: 'Alice', isOwner: true }),
          fakeCollaborator({ id: 'u2', name: 'Bob', isOwner: false, email: 'bob@example.com' }),
        ],
        removeHandler: vi.fn().mockResolvedValue(undefined),
      },
    });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/^owner$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove bob/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove alice/i })).toBeNull();
  });

  it('delegates removal to the handler', async () => {
    const user = userEvent.setup();
    const removeHandler = vi.fn().mockResolvedValue(undefined);

    await render(ShareCollaboratorList, {
      inputs: {
        collaborators: [
          fakeCollaborator({ id: 'u1', name: 'Owner', isOwner: true }),
          fakeCollaborator({ id: 'u2', name: 'Guest', isOwner: false }),
        ],
        removeHandler,
      },
    });

    await user.click(await screen.findByRole('button', { name: /remove guest/i }));

    await waitFor(() => expect(removeHandler).toHaveBeenCalledWith('u2'));
  });

  it('emits an error when the remove handler throws', async () => {
    const user = userEvent.setup();
    const removeHandler = vi.fn().mockRejectedValue(new Error('Permission denied'));
    const errorCb = vi.fn();

    await render(ShareCollaboratorList, {
      inputs: {
        collaborators: [fakeCollaborator({ id: 'u2', name: 'Guest', isOwner: false })],
        removeHandler,
      },
      on: { error: errorCb },
    });

    await user.click(await screen.findByRole('button', { name: /remove guest/i }));

    await waitFor(() => expect(errorCb).toHaveBeenCalledWith('Permission denied'));
  });

  it('falls back to a generic error message when the remove handler rejects with a non-Error', async () => {
    const user = userEvent.setup();
    const removeHandler = vi.fn().mockRejectedValue('kaboom');
    const errorCb = vi.fn();

    await render(ShareCollaboratorList, {
      inputs: {
        collaborators: [fakeCollaborator({ id: 'u2', name: 'Guest', isOwner: false })],
        removeHandler,
      },
      on: { error: errorCb },
    });

    await user.click(await screen.findByRole('button', { name: /remove guest/i }));

    await waitFor(() => expect(errorCb).toHaveBeenCalledWith('Failed to remove collaborator'));
  });
});
