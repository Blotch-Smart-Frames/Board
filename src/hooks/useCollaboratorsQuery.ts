import { useQuery } from '@tanstack/react-query';
import type { User as FirebaseUser } from 'firebase/auth';
import { queryKeys } from '../queries/queryKeys';
import { getUsersByIds } from '../services/userService';
import type { Board } from '../types/board';

export type Collaborator = {
  id: string;
  email: string;
  name: string;
  photoURL?: string | null;
  isOwner: boolean;
};

export const useCollaboratorsQuery = (
  board: Board | undefined,
  currentUser: FirebaseUser | null
) => {
  const allUserIds = board
    ? [board.ownerId, ...board.collaborators]
    : [];

  const { data: users = [], isLoading } = useQuery({
    queryKey: queryKeys.users.byIds(allUserIds),
    queryFn: () => getUsersByIds(allUserIds),
    enabled: allUserIds.length > 0,
  });

  const collaborators: Collaborator[] = board
    ? allUserIds.map((userId) => {
        const user = users.find((u) => u.id === userId);
        const isOwner = userId === board.ownerId;

        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.displayName,
            photoURL: user.photoURL,
            isOwner,
          };
        }

        // Fallback for users not yet synced to users collection
        if (isOwner && currentUser) {
          return {
            id: userId,
            email: currentUser.email || '',
            name: currentUser.displayName || 'Owner',
            photoURL: currentUser.photoURL,
            isOwner: true,
          };
        }

        return {
          id: userId,
          email: '',
          name: 'Unknown User',
          photoURL: null,
          isOwner,
        };
      })
    : [];

  return { collaborators, isLoading };
};
