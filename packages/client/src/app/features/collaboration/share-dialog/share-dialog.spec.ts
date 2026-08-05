import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ShareDialog } from './share-dialog';
import { BoardService } from '../../../core/services/board.service';
import { UserService } from '../../../core/services/user.service';
import type { Collaborator } from '../../../shared/types/board';

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

async function openWith(
  opts: {
    collaborators?: Collaborator[];
    boardService?: Partial<BoardService>;
    userService?: Partial<UserService>;
  } = {},
) {
  const boardService = {
    shareBoard: vi.fn().mockResolvedValue(undefined),
    removeCollaborator: vi.fn().mockResolvedValue(undefined),
    ...opts.boardService,
  };
  const userService = {
    getUserByEmail: vi
      .fn()
      .mockResolvedValue({ id: 'u2', email: 'invited@example.com', name: 'New Person' }),
    ...opts.userService,
  };

  const view = await render(ShareDialog, {
    inputs: {
      boardId: 'board-1',
      boardTitle: 'My Board',
      collaborators: opts.collaborators ?? [fakeCollaborator()],
    },
    providers: [
      { provide: BoardService, useValue: boardService },
      { provide: UserService, useValue: userService },
    ],
  });
  view.fixture.componentInstance.open();
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  return { ...view, boardService, userService };
}

describe('ShareDialog', () => {
  it('lists all collaborators, badging the owner and hiding the remove button on them', async () => {
    await openWith({
      collaborators: [
        fakeCollaborator({ id: 'u1', name: 'Alice', isOwner: true }),
        fakeCollaborator({ id: 'u2', name: 'Bob', isOwner: false, email: 'guest@example.com' }),
      ],
    });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // The owner row includes an "Owner" badge; the guest row does not.
    expect(screen.getByText(/^owner$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove bob/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove alice/i })).toBeNull();
  });

  it('invites by looking up the user and calling shareBoard', async () => {
    const user = userEvent.setup();
    const { boardService, userService } = await openWith();

    await user.type(await screen.findByLabelText('Invite by email'), 'invited@example.com');
    await user.click(screen.getByRole('button', { name: /invite/i }));

    await waitFor(() =>
      expect(userService.getUserByEmail).toHaveBeenCalledWith('invited@example.com'),
    );
    expect(boardService.shareBoard).toHaveBeenCalledWith('board-1', 'u2');
    expect(await screen.findByText(/invitation sent to invited@example.com/i)).toBeInTheDocument();
  });

  it('shows an error when no user matches the invited email and skips shareBoard', async () => {
    const user = userEvent.setup();
    const { boardService } = await openWith({
      userService: { getUserByEmail: vi.fn().mockResolvedValue(null) },
    });

    await user.type(await screen.findByLabelText('Invite by email'), 'ghost@example.com');
    await user.click(screen.getByRole('button', { name: /invite/i }));

    expect(
      await screen.findByText(/no user found with email: ghost@example.com/i),
    ).toBeInTheDocument();
    expect(boardService.shareBoard).not.toHaveBeenCalled();
  });

  it('removes a collaborator via BoardService.removeCollaborator', async () => {
    const user = userEvent.setup();
    const { boardService } = await openWith({
      collaborators: [
        fakeCollaborator({ id: 'u1', name: 'Owner', isOwner: true }),
        fakeCollaborator({ id: 'u2', name: 'Guest', isOwner: false }),
      ],
    });

    await user.click(await screen.findByRole('button', { name: /remove guest/i }));

    await waitFor(() =>
      expect(boardService.removeCollaborator).toHaveBeenCalledWith('board-1', 'u2'),
    );
  });

  it('closes when the "Done" footer button is clicked', async () => {
    const user = userEvent.setup();
    await openWith();

    await user.click(await screen.findByRole('button', { name: /done/i }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /done/i })).not.toBeInTheDocument(),
    );
  });

  it('closes when the invite form emits escape', async () => {
    const user = userEvent.setup();
    await openWith();

    // The invite form escapes on the Escape key.
    await user.type(await screen.findByLabelText('Invite by email'), '{Escape}');

    await waitFor(() => expect(screen.queryByLabelText('Invite by email')).not.toBeInTheDocument());
  });

  it('copies the current URL and surfaces a transient success banner', async () => {
    vi.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true,
      });

      await openWith();

      await user.click(await screen.findByRole('button', { name: /copy board link/i }));

      await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(await screen.findByText(/link copied to clipboard/i)).toBeInTheDocument();

      // The success banner auto-dismisses after 3s.
      vi.advanceTimersByTime(3001);
      await Promise.resolve();
      await vi.waitFor(() =>
        expect(screen.queryByText(/link copied to clipboard/i)).not.toBeInTheDocument(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces an error when the clipboard API rejects', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    await openWith();

    await user.click(await screen.findByRole('button', { name: /copy board link/i }));

    expect(await screen.findByText(/could not copy link/i)).toBeInTheDocument();
  });

  it('shows an error when removing a collaborator fails', async () => {
    const user = userEvent.setup();
    const removeCollaborator = vi.fn().mockRejectedValue(new Error('offline'));
    await openWith({
      collaborators: [
        fakeCollaborator({ id: 'u1', name: 'Owner', isOwner: true }),
        fakeCollaborator({ id: 'u2', name: 'Guest', isOwner: false }),
      ],
      boardService: { removeCollaborator },
    });

    await user.click(await screen.findByRole('button', { name: /remove guest/i }));

    expect(await screen.findByText(/offline/i)).toBeInTheDocument();
  });

  it('clears any pending success timer when a new success arrives', async () => {
    vi.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true,
      });

      await openWith();

      // First success starts the 3s timer.
      await user.click(await screen.findByRole('button', { name: /copy board link/i }));
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

      vi.advanceTimersByTime(1500);
      // Second success clears the first timer and starts a fresh one.
      await user.click(screen.getByRole('button', { name: /copy board link/i }));
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));

      // 1500ms later — first timer would have expired — success is still visible.
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
      expect(screen.getByText(/link copied to clipboard/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
