import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  signInWithGoogle,
  signOut as firebaseSignOut,
  onAuthChange,
} from '../services/firebase';
import { calendarService } from '../services/calendarService';
import { syncUserProfile } from '../services/userService';
import { queryKeys } from '../queries/queryKeys';

type AuthData = {
  user: FirebaseUser | null;
  accessToken: string | null;
};

export const useAuthQuery = () => {
  const queryClient = useQueryClient();
  const [isAuthReady, setIsAuthReady] = useState(false);

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

  // Subscribe to auth state changes - this is the source of truth for user state
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      queryClient.setQueryData<AuthData>(queryKeys.auth, (prev) => ({
        user,
        accessToken: prev?.accessToken ?? null,
      }));
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, [queryClient]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: signInWithGoogle,
    onSuccess: async (result) => {
      queryClient.setQueryData<AuthData>(queryKeys.auth, {
        user: result.user,
        accessToken: result.accessToken,
      });
      calendarService.setAccessToken(result.accessToken);
      await syncUserProfile(result.user);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: firebaseSignOut,
    onSuccess: () => {
      queryClient.setQueryData<AuthData>(queryKeys.auth, {
        user: null,
        accessToken: null,
      });
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
    isLoading: isLoading || loginMutation.isPending || !isAuthReady,
    isAuthenticated: !!data?.user,
    login,
    logout,
  };
};
