import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { User as FirebaseUser } from 'firebase/auth';
import { signInWithGoogle, signOut as firebaseSignOut, onAuthChange } from '../services/firebase';
import { calendarService } from '../services/calendarService';
import { syncUserProfile } from '../services/userService';
import { queryKeys } from '../queries/queryKeys';

type AuthData = {
  user: FirebaseUser | null;
  accessToken: string | null;
};

export const useAuthQuery = () => {
  const queryClient = useQueryClient();

  // Main auth query - the data is populated via the subscription effect
  const { data, isLoading } = useQuery<AuthData>({
    queryKey: queryKeys.auth,
    queryFn: () => {
      // Return current cached data or default
      const cached = queryClient.getQueryData<AuthData>(queryKeys.auth);
      return cached ?? { user: null, accessToken: null };
    },
    staleTime: Infinity,
  });

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      queryClient.setQueryData<AuthData>(queryKeys.auth, (prev) => ({
        user,
        accessToken: prev?.accessToken ?? null,
      }));
    });

    return () => unsubscribe();
  }, [queryClient]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: signInWithGoogle,
    onSuccess: async ({ user, accessToken }) => {
      queryClient.setQueryData<AuthData>(queryKeys.auth, { user, accessToken });
      calendarService.setAccessToken(accessToken);
      await syncUserProfile(user);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: firebaseSignOut,
    onSuccess: () => {
      queryClient.setQueryData<AuthData>(queryKeys.auth, { user: null, accessToken: null });
      // Invalidate all board-related queries on logout
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.all });
    },
  });

  const login = async () => {
    return loginMutation.mutateAsync();
  };

  const logout = async () => {
    return logoutMutation.mutateAsync();
  };

  return {
    user: data?.user ?? null,
    accessToken: data?.accessToken ?? null,
    isLoading: isLoading || loginMutation.isPending,
    isAuthenticated: !!data?.user,
    login,
    logout,
  };
};
