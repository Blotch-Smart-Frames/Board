import { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Brightness7 as LightIcon,
  Brightness4 as DarkIcon,
  BrightnessAuto as SystemIcon,
} from '@mui/icons-material';
import { useColorScheme } from '@mui/material/styles';

type Mode = 'light' | 'dark' | 'system';

const MODE_OPTIONS: { value: Mode; label: string; icon: typeof LightIcon }[] = [
  { value: 'light', label: 'Light', icon: LightIcon },
  { value: 'dark', label: 'Dark', icon: DarkIcon },
  { value: 'system', label: 'System', icon: SystemIcon },
];

export function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  if (!mode) return null;

  const currentOption =
    MODE_OPTIONS.find((opt) => opt.value === mode) ?? MODE_OPTIONS[2];
  const Icon = currentOption.icon;

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label="theme toggle"
      >
        <Icon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {MODE_OPTIONS.map(({ value, label, icon: OptionIcon }) => (
          <MenuItem
            key={value}
            selected={value === mode}
            onClick={() => {
              setMode(value);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>
              <OptionIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
