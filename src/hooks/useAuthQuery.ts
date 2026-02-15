import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  signInWithGoogle,
  signOut as firebaseSignOut,
  onAuthChange,
  handleRedirectResult,
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
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(true);

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
    const unsubscribe = onAuthChange(async (user) => {
      // Get the current access token (if any) before updating
      const prev = queryClient.getQueryData<AuthData>(queryKeys.auth);

      queryClient.setQueryData<AuthData>(queryKeys.auth, {
        user,
        accessToken: prev?.accessToken ?? null,
      });

      // If user just logged in and we don't have an access token yet,
      // check for redirect result to get the OAuth token
      if (user && !prev?.accessToken && isCheckingRedirect) {
        try {
          const result = await handleRedirectResult();
          if (result?.accessToken) {
            queryClient.setQueryData<AuthData>(queryKeys.auth, {
              user,
              accessToken: result.accessToken,
            });
            calendarService.setAccessToken(result.accessToken);
            await syncUserProfile(user);
          }
        } finally {
          setIsCheckingRedirect(false);
        }
      } else if (!isCheckingRedirect) {
        // Already checked redirect, nothing to do
      } else {
        // No user, mark redirect check as complete
        setIsCheckingRedirect(false);
      }

      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, [queryClient, isCheckingRedirect]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: signInWithGoogle,
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
