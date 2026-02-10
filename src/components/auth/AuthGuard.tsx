import type { ReactNode } from 'react';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';
import { useAuthQuery } from '../../hooks/useAuthQuery';
import { GoogleAuthButton } from './GoogleAuthButton';

type AuthGuardProps = {
  children: ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuthQuery();

  if (isLoading) {
    return (
      <Box className="flex items-center justify-center h-screen">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Paper className="p-8 max-w-md w-full mx-4 text-center" elevation={3}>
          <Typography
            variant="h4"
            component="h1"
            className="mb-2 font-bold text-gray-800"
          >
            Board by Blotch
          </Typography>
          <Typography variant="body1" color="text.secondary" className="mb-6">
            Organize your tasks with a beautiful, collaborative board.
            <br />
            Sync with Google Calendar to never miss a deadline.
          </Typography>

          <Box className="flex flex-col gap-4">
            <GoogleAuthButton />

            <Typography
              variant="caption"
              color="text.secondary"
              className="block mt-4"
            >
              Sign in to access your boards and collaborate with your team.
            </Typography>
          </Box>
        </Paper>
      </Box>
    );
  }

  return <>{children}</>;
}
