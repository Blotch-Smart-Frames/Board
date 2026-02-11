import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useAuthQuery } from '../../hooks/useAuthQuery';

export function GoogleAuthButton() {
  const { login } = useAuthQuery();
  const [isLoading, setIsLoading] = useState(false);
  const handleClick = async () => {
    try {
      setIsLoading(true);
      await login();
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="contained"
      size="medium"
      onClick={handleClick}
      disabled={isLoading}
      startIcon={isLoading ? <CircularProgress size={20} /> : <GoogleIcon />}
      sx={{
        backgroundColor: '#fff',
        color: '#757575',
        border: '1px solid #dadce0',
        '&:hover': {
          backgroundColor: '#f8f9fa',
        },
      }}
    >
      {isLoading ? 'Signing in...' : 'Sign in with Google'}
    </Button>
  );
}
