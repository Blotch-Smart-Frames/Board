import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ShareInviteForm } from './share-invite-form';

describe('ShareInviteForm', () => {
  it('rejects invalid emails without invoking the handler', async () => {
    const user = userEvent.setup();
    const inviteHandler = vi.fn().mockResolvedValue('sent');

    await render(ShareInviteForm, {
      inputs: { inviteHandler },
    });

    await user.type(await screen.findByLabelText('Invite by email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /invite/i }));

    expect(inviteHandler).not.toHaveBeenCalled();
    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
  });

  it('resets the email field after a successful invite and emits the message', async () => {
    const user = userEvent.setup();
    const inviteHandler = vi.fn().mockResolvedValue('Invitation sent to invited@example.com');
    const success = vi.fn();

    await render(ShareInviteForm, {
      inputs: { inviteHandler },
      on: { success },
    });

    const emailInput = await screen.findByLabelText('Invite by email');
    await user.type(emailInput, 'invited@example.com');
    await user.click(screen.getByRole('button', { name: /invite/i }));

    await waitFor(() =>
      expect(success).toHaveBeenCalledWith('Invitation sent to invited@example.com'),
    );
    expect(emailInput).toHaveValue('');
  });

  it('emits an error when the handler throws', async () => {
    const user = userEvent.setup();
    const inviteHandler = vi.fn().mockRejectedValue(new Error('No user found'));
    const errorCb = vi.fn();

    await render(ShareInviteForm, {
      inputs: { inviteHandler },
      on: { error: errorCb },
    });

    await user.type(await screen.findByLabelText('Invite by email'), 'ghost@example.com');
    await user.click(screen.getByRole('button', { name: /invite/i }));

    await waitFor(() => expect(errorCb).toHaveBeenCalledWith('No user found'));
  });
});
