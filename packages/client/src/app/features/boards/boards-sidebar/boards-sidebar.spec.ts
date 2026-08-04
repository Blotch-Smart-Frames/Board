import { signal } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { provideRouter, Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { UserBoardsStore, type BoardWithOrder } from '../data/user-boards.store';
import { BoardsSidebar } from './boards-sidebar';

function fakeBoard(id: string, title: string): BoardWithOrder {
  return {
    id,
    title,
    ownerId: 'u1',
    collaborators: [],
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
  };
}

function setup(boards: BoardWithOrder[], isLoading = false) {
  const store = {
    boards: signal(boards),
    isLoading: signal(isLoading),
    createBoard: vi.fn().mockResolvedValue(fakeBoard('new-board', 'New Board')),
    renameBoard: vi.fn().mockResolvedValue(undefined),
    deleteBoard: vi.fn().mockResolvedValue(undefined),
  };
  return {
    store,
    providers: [provideRouter([]), { provide: UserBoardsStore, useValue: store }],
  };
}

describe('BoardsSidebar', () => {
  it('lists the user boards', async () => {
    const { providers } = setup([fakeBoard('1', 'Alpha'), fakeBoard('2', 'Beta')]);
    await render(BoardsSidebar, { providers });

    expect(screen.getByRole('link', { name: /alpha/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /beta/i })).toBeInTheDocument();
  });

  it('shows an empty state when there are no boards', async () => {
    const { providers } = setup([]);
    await render(BoardsSidebar, { providers });

    expect(screen.getByText(/no boards yet/i)).toBeInTheDocument();
  });

  it('shows a spinner while boards are loading', async () => {
    const { providers } = setup([], true);
    await render(BoardsSidebar, { providers });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('creates a board and navigates to it', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup([]);
    const { fixture } = await render(BoardsSidebar, { providers });
    const navigate = vi.spyOn(fixture.debugElement.injector.get(Router), 'navigate').mockResolvedValue(true);

    await user.click(screen.getByRole('button', { name: /create board/i }));
    await user.type(await screen.findByLabelText(/board title/i), 'Gamma');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(store.createBoard).toHaveBeenCalledWith({ title: 'Gamma' });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(['/board', 'new-board']));
  });

  it('renames a board through the item menu', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup([fakeBoard('1', 'Alpha')]);
    await render(BoardsSidebar, { providers });

    await user.click(screen.getByRole('button', { name: /options for alpha/i }));
    await user.click(await screen.findByRole('menuitem', { name: /rename/i }));

    const input = await screen.findByLabelText(/board title/i);
    expect(input).toHaveValue('Alpha');
    await user.clear(input);
    await user.type(input, 'Alpha Renamed');
    await user.click(screen.getByRole('button', { name: /^rename$/i }));

    expect(store.renameBoard).toHaveBeenCalledWith('1', 'Alpha Renamed');
  });

  it('deletes a board through the item menu', async () => {
    const user = userEvent.setup();
    const { store, providers } = setup([fakeBoard('1', 'Alpha')]);
    await render(BoardsSidebar, { providers });

    await user.click(screen.getByRole('button', { name: /options for alpha/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));

    expect(store.deleteBoard).toHaveBeenCalledWith('1');
  });
});
