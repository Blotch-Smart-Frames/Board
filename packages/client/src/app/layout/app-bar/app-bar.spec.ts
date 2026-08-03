import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthStore } from '../../core/auth/auth.store';
import { ThemeService } from '../../core/theme/theme.service';
import { AppBar } from './app-bar';

function setup(overrides: Partial<Record<string, unknown>> = {}) {
  const user = { uid: 'u1', displayName: 'Jane Doe', email: 'jane@example.com', photoURL: null };
  const logout = vi.fn().mockResolvedValue(undefined);
  return {
    logout,
    providers: [
      { provide: AuthStore, useValue: { user: signal(user), logout, ...overrides } },
      { provide: ThemeService, useValue: { mode: signal('system'), setMode: vi.fn() } },
    ],
  };
}

describe('AppBar', () => {
  it('shows the given title', async () => {
    const { providers } = setup();
    await render(AppBar, { inputs: { title: 'My Board' }, providers });

    expect(screen.getByRole('heading', { name: 'My Board' })).toBeInTheDocument();
  });

  it('only shows the menu button when showMenuButton is true', async () => {
    const { providers } = setup();
    const { rerender } = await render(AppBar, { inputs: { showMenuButton: false }, providers });
    expect(screen.queryByRole('button', { name: 'menu' })).not.toBeInTheDocument();

    await rerender({ inputs: { showMenuButton: true } });
    expect(screen.getByRole('button', { name: 'menu' })).toBeInTheDocument();
  });

  it('emits menuClick when the menu button is pressed', async () => {
    const user = userEvent.setup();
    const { providers } = setup();
    const onMenuClick = vi.fn();
    await render(AppBar, {
      inputs: { showMenuButton: true },
      providers,
      on: { menuClick: onMenuClick },
    });

    await user.click(screen.getByRole('button', { name: 'menu' }));

    expect(onMenuClick).toHaveBeenCalled();
  });

  it('emits viewModeChange when switching between kanban and timeline', async () => {
    const user = userEvent.setup();
    const { providers } = setup();
    const onViewModeChange = vi.fn();
    await render(AppBar, {
      inputs: { viewMode: 'kanban' },
      providers,
      on: { viewModeChange: onViewModeChange },
    });

    await user.click(screen.getByRole('button', { name: /timeline view/i }));

    expect(onViewModeChange).toHaveBeenCalledWith('timeline');
  });

  it('shows the share button only when showShare is true and emits on click', async () => {
    const user = userEvent.setup();
    const { providers } = setup();
    const onShare = vi.fn();
    await render(AppBar, { inputs: { showShare: true }, providers, on: { share: onShare } });

    await user.click(screen.getByRole('button', { name: /^share$/i }));

    expect(onShare).toHaveBeenCalled();
  });

  it('signs out from the account menu', async () => {
    const user = userEvent.setup();
    const { providers, logout } = setup();
    await render(AppBar, { providers });

    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(await screen.findByRole('menuitem', { name: /sign out/i }));

    expect(logout).toHaveBeenCalled();
  });
});
