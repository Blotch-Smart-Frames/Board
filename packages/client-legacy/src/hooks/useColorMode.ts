import { useTheme } from '@mui/material';

export const useColorMode = (): 'light' | 'dark' => useTheme().palette.mode;
