import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthStore } from '../../core/auth/auth.store';
import { MainNav } from './main-nav';

function setup(user: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null } | null) {
  const logout = vi.fn().mockResolvedValue(undefined);
  return {
    logout,
    providers: [
      provideRouter([]),
      { provide: AuthStore, useValue: { user: signal(user), logout } },
    ],
  };
}

describe('MainNav', () => {
  it('renders the primary navigation links', async () => {
    const { providers } = setup(null);
    await render(MainNav, { providers });

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /agenda/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^board$/i })).toBeInTheDocument();
  });

  it('does not render the account menu when the user is signed out', async () => {
    const { providers } = setup(null);
    await render(MainNav, { providers });

    expect(screen.queryByRole('button', { name: /account menu/i })).not.toBeInTheDocument();
  });

  it('renders the account menu when the user is signed in and signs the user out', async () => {
    const user = userEvent.setup();
    const { providers, logout } = setup({
      uid: 'u1',
      displayName: 'Alice',
      email: 'alice@example.com',
      photoURL: null,
    });
    await render(MainNav, { providers });

    await user.click(screen.getByRole('button', { name: /account menu/i }));

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));

    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('falls back to a generic label when the user has no display name or email', async () => {
    const user = userEvent.setup();
    const { providers } = setup({ uid: 'u1', displayName: null, email: null, photoURL: null });
    await render(MainNav, { providers });

    await user.click(screen.getByRole('button', { name: /account menu/i }));

    // Header falls back to "User" when displayName is missing.
    expect(await screen.findAllByText('User')).not.toHaveLength(0);
  });
});
