import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthStore } from '../../core/auth/auth.store';
import { GoogleAuthButton } from './google-auth-button';

describe('GoogleAuthButton', () => {
  it('calls login on click and shows a loading state until it resolves', async () => {
    const user = userEvent.setup();
    let resolveLogin!: () => void;
    const login = vi.fn(() => new Promise<void>((resolve) => (resolveLogin = resolve)));

    await render(GoogleAuthButton, {
      providers: [{ provide: AuthStore, useValue: { login } }],
    });

    await user.click(screen.getByRole('button', { name: /sign in with google/i }));

    expect(login).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();

    resolveLogin();
    await screen.findByRole('button', { name: /sign in with google/i });
  });

  it('logs and recovers from a failed sign-in without leaving the button stuck disabled', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const login = vi.fn().mockRejectedValue(new Error('popup closed'));

    await render(GoogleAuthButton, { providers: [{ provide: AuthStore, useValue: { login } }] });

    await user.click(screen.getByRole('button', { name: /sign in with google/i }));
    await screen.findByRole('button', { name: /sign in with google/i, hidden: false });

    expect(screen.getByRole('button')).not.toBeDisabled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
