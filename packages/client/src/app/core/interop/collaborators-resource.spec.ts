import { TestBed } from '@angular/core/testing';
import type { Timestamp } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { UserService } from '../services/user.service';
import { collaboratorsResource } from './collaborators-resource';
import type { Board } from '../../shared/types/board';

function fakeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 'board-1',
    title: 'Board',
    ownerId: 'owner-1',
    collaborators: [],
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

describe('collaboratorsResource', () => {
  let userService: { getUsersByIds: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    userService = { getUsersByIds: vi.fn().mockResolvedValue([]) };
    TestBed.configureTestingModule({
      providers: [{ provide: UserService, useValue: userService }],
    });
  });

  async function settle() {
    TestBed.flushEffects();
    await Promise.resolve();
    await Promise.resolve();
    TestBed.flushEffects();
  }

  it('returns an empty array when there is no board', async () => {
    const result = TestBed.runInInjectionContext(() =>
      collaboratorsResource(
        () => null,
        () => null,
      ),
    );
    await settle();

    expect(result()).toEqual([]);
    expect(userService.getUsersByIds).not.toHaveBeenCalled();
  });

  it('resolves collaborators from fetched user profiles', async () => {
    userService.getUsersByIds.mockResolvedValue([
      { id: 'owner-1', email: 'owner@x.com', displayName: 'Owner', photoURL: null },
    ]);
    const board = fakeBoard();

    const result = TestBed.runInInjectionContext(() =>
      collaboratorsResource(
        () => board,
        () => null,
      ),
    );
    await settle();

    expect(result()).toEqual([
      { id: 'owner-1', email: 'owner@x.com', name: 'Owner', photoURL: null, isOwner: true },
    ]);
  });

  it('falls back to the live currentUser for an owner not yet synced to the users collection', async () => {
    const board = fakeBoard();
    const currentUser = {
      uid: 'owner-1',
      email: 'me@x.com',
      displayName: 'Me',
      photoURL: 'me.png',
    } as FirebaseUser;

    const result = TestBed.runInInjectionContext(() =>
      collaboratorsResource(
        () => board,
        () => currentUser,
      ),
    );
    await settle();

    expect(result()).toEqual([
      { id: 'owner-1', email: 'me@x.com', name: 'Me', photoURL: 'me.png', isOwner: true },
    ]);
  });

  it('falls back to a generic placeholder for an unknown non-owner user', async () => {
    const board = fakeBoard({ collaborators: ['ghost'] });

    const result = TestBed.runInInjectionContext(() =>
      collaboratorsResource(
        () => board,
        () => null,
      ),
    );
    await settle();

    expect(result()).toContainEqual({
      id: 'ghost',
      email: '',
      name: 'Unknown User',
      photoURL: null,
      isOwner: false,
    });
  });
});
