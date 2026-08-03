import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AppBar } from './app-bar';

describe('AppBar', () => {
  it('shows the given title', async () => {
    await render(AppBar, { inputs: { title: 'My Board' } });

    expect(screen.getByRole('heading', { name: 'My Board' })).toBeInTheDocument();
  });

  it('only shows the menu button when showMenuButton is true', async () => {
    const { rerender } = await render(AppBar, { inputs: { showMenuButton: false } });
    expect(screen.queryByRole('button', { name: 'menu' })).not.toBeInTheDocument();

    await rerender({ inputs: { showMenuButton: true } });
    expect(screen.getByRole('button', { name: 'menu' })).toBeInTheDocument();
  });

  it('emits menuClick when the menu button is pressed', async () => {
    const user = userEvent.setup();
    const onMenuClick = vi.fn();
    await render(AppBar, {
      inputs: { showMenuButton: true },
      on: { menuClick: onMenuClick },
    });

    await user.click(screen.getByRole('button', { name: 'menu' }));

    expect(onMenuClick).toHaveBeenCalled();
  });

  it('emits viewModeChange when switching between kanban and timeline', async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();
    await render(AppBar, {
      inputs: { viewMode: 'kanban' },
      on: { viewModeChange: onViewModeChange },
    });

    await user.click(screen.getByRole('button', { name: /timeline view/i }));

    expect(onViewModeChange).toHaveBeenCalledWith('timeline');
  });

  it('shows the share button only when showShare is true and emits on click', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    await render(AppBar, { inputs: { showShare: true }, on: { share: onShare } });

    await user.click(screen.getByRole('button', { name: /^share$/i }));

    expect(onShare).toHaveBeenCalled();
  });
});
