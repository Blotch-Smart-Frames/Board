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
});
