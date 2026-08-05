import { render, screen } from '@testing-library/angular';
import { UserAvatar } from './user-avatar';

describe('UserAvatar', () => {
  // Note: BrnAvatar only swaps in the projected <img> once it has genuinely
  // finished loading (Radix-style avatar-with-fallback behavior), which
  // never happens under jsdom — so the meaningfully unit-testable path is
  // the fallback, not the loaded-image state (that needs a real browser).
  it('shows initials as a fallback while no photo has loaded', async () => {
    await render(UserAvatar, { inputs: { name: 'Jane Doe', photoURL: null } });

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('derives initials from a single-word name', async () => {
    await render(UserAvatar, { inputs: { name: 'Cher', photoURL: null } });

    expect(screen.getByText('CH')).toBeInTheDocument();
  });

  it('renders the initials fallback even when a photoURL is provided (jsdom never loads the image)', async () => {
    // The photoURL branch is executed; BrnAvatar only swaps in the projected
    // <img> once it finishes loading, which never happens under jsdom. So this
    // spec exercises the truthy photoURL branch while still asserting on the
    // fallback the user actually sees.
    await render(UserAvatar, {
      inputs: { name: 'Jane Doe', photoURL: 'https://example.com/jane.png' },
    });

    expect(screen.getByText('JD')).toBeInTheDocument();
  });
});
