import type { ReactNode } from 'react';
import { Box, CircularProgress, Typography, Paper, Link } from '@mui/material';
import { useAuthQuery } from '../../hooks/useAuthQuery';
import { GoogleAuthButton } from './GoogleAuthButton';

type AuthGuardProps = {
  children: ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuthQuery();

  if (isLoading) {
    return (
      <Box className="flex h-screen items-center justify-center">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box className="flex h-screen items-center justify-center gap-4 p-6">
        <Paper
          className="mx-4 flex w-full max-w-md flex-col gap-4 p-8 text-center"
          elevation={3}
        >
          <Typography
            variant="h4"
            component="h1"
            className="mb-2 font-bold text-gray-800"
          >
            Board{' '}
            <Typography
              variant="caption"
              component="sub"
              className="text-gray-500"
            >
              by Blotch
            </Typography>
          </Typography>
          <Typography color="text.secondary">
            Organize your tasks with a beautiful, collaborative board.
          </Typography>

          <Box className="flex flex-col gap-4">
            <GoogleAuthButton />

            <Typography
              variant="caption"
              color="text.secondary"
              className="mt-4 block"
            >
              By signing in, you agree to our{' '}
              <Link href="/terms.html" target="_blank" rel="noopener">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy.html" target="_blank" rel="noopener">
                Privacy Policy
              </Link>
              .
            </Typography>
          </Box>
        </Paper>
      </Box>
    );
  }

  return <>{children}</>;
}
