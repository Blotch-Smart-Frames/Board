import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

const mockSetMode = vi.fn();
let mockMode: string | undefined = 'system';

vi.mock('@mui/material/styles', () => ({
  useColorScheme: () => ({
    mode: mockMode,
    setMode: mockSetMode,
  }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMode = 'system';
  });

  it('renders the toggle button', () => {
    render(<ThemeToggle />);

    expect(
      screen.getByRole('button', { name: 'theme toggle' }),
    ).toBeInTheDocument();
  });

  it('returns null when mode is undefined', () => {
    mockMode = undefined;
    const { container } = render(<ThemeToggle />);

    expect(container.firstChild).toBeNull();
  });

  it('opens menu on click', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'theme toggle' }));

    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('calls setMode when option selected', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'theme toggle' }));
    await user.click(screen.getByText('Dark'));

    expect(mockSetMode).toHaveBeenCalledWith('dark');
  });

  it('closes menu after selection', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'theme toggle' }));
    await user.click(screen.getByText('Light'));

    // Menu should close (items should not be visible as menuitem role)
    expect(screen.queryByRole('menuitem', { name: 'Light' })).not.toBeInTheDocument();
  });
});
