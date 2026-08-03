import { computed, inject, resource, type Signal } from '@angular/core';
import type { User as FirebaseUser } from 'firebase/auth';
import { UserService } from '../services/user.service';
import type { Board, Collaborator } from '../../shared/types/board';

/**
 * Resolves a board's owner + collaborators into full profiles, with fallbacks
 * for an owner not yet synced to the users collection and for unknown users.
 * Must be called from an injection context (e.g. a component/store field).
 */
export function collaboratorsResource(
  boardFn: () => Board | null | undefined,
  currentUserFn: () => FirebaseUser | null | undefined,
): Signal<Collaborator[]> {
  const userService = inject(UserService);

  const allUserIds = computed(() => {
    const board = boardFn();
    return board ? [board.ownerId, ...board.collaborators] : [];
  });

  const usersResource = resource({
    params: () => (allUserIds().length > 0 ? { userIds: allUserIds() } : undefined),
    loader: ({ params }) => userService.getUsersByIds(params.userIds),
  });

  return computed<Collaborator[]>(() => {
    const board = boardFn();
    if (!board) return [];

    const currentUser = currentUserFn();
    const users = usersResource.value() ?? [];

    return allUserIds().map((userId): Collaborator => {
      const user = users.find((u) => u.id === userId);
      const isOwner = userId === board.ownerId;

      if (user) {
        return { id: user.id, email: user.email, name: user.displayName, photoURL: user.photoURL, isOwner };
      }
      if (isOwner && currentUser) {
        return {
          id: userId,
          email: currentUser.email ?? '',
          name: currentUser.displayName ?? 'Owner',
          photoURL: currentUser.photoURL,
          isOwner: true,
        };
      }
      return { id: userId, email: '', name: 'Unknown User', photoURL: null, isOwner };
    });
  });
}
