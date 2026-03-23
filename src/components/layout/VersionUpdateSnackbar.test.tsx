import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { VersionUpdateSnackbar } from './VersionUpdateSnackbar';

describe('VersionUpdateSnackbar', () => {
  it('renders when open', () => {
    render(<VersionUpdateSnackbar open onRefresh={() => {}} />);

    expect(screen.getByText('A new version is available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<VersionUpdateSnackbar open={false} onRefresh={() => {}} />);

    expect(screen.queryByText('A new version is available.')).not.toBeInTheDocument();
  });

  it('calls onRefresh when Refresh button is clicked', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(<VersionUpdateSnackbar open onRefresh={onRefresh} />);

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
