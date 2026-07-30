import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ThemeService } from '../../core/theme/theme.service';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  it('opens a menu of light/dark/system options and applies the chosen one', async () => {
    const user = userEvent.setup();
    const setMode = vi.fn();
    const mode = signal<'light' | 'dark' | 'system'>('system');

    await render(ThemeToggle, {
      providers: [{ provide: ThemeService, useValue: { mode, setMode } }],
    });

    await user.click(screen.getByRole('button', { name: /theme/i }));
    await user.click(await screen.findByRole('menuitem', { name: /dark/i }));

    expect(setMode).toHaveBeenCalledWith('dark');
  });
});
