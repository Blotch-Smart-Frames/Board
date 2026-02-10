import { useState } from 'react';
import {
  AppBar as MuiAppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useAuthQuery } from '../../hooks/useAuthQuery';
import { UserAvatar } from '../collaboration/UserAvatar';

type AppBarProps = {
  title?: string;
  onMenuClick?: () => void;
  onShare?: () => void;
  showShare?: boolean;
};

export function AppBar({
  title = 'Board by Blotch',
  onMenuClick,
  onShare,
  showShare = false,
}: AppBarProps) {
  const { user, logout, isAuthenticated } = useAuthQuery();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
  };

  return (
    <MuiAppBar position="static" color="default" elevation={1}>
      <Toolbar className="gap-2">
        {onMenuClick && (
          <IconButton edge="start" onClick={onMenuClick} aria-label="menu">
            <MenuIcon />
          </IconButton>
        )}

        <Typography
          variant="h6"
          component="div"
          className="flex-grow font-semibold"
          color="primary"
        >
          {title}
        </Typography>

        {showShare && onShare && (
          <Button
            startIcon={<ShareIcon />}
            onClick={onShare}
            variant="outlined"
            size="small"
          >
            Share
          </Button>
        )}

        {isAuthenticated && user ? (
          <Box>
            <IconButton onClick={handleMenuOpen} size="small">
              <UserAvatar
                name={user.displayName || user.email || 'User'}
                photoURL={user.photoURL}
                size="small"
                showTooltip={false}
              />
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <Box className="px-4 py-2">
                <Typography variant="subtitle2">
                  {user.displayName || 'User'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>

              <Divider />

              <MenuItem onClick={handleMenuClose}>
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Profile</ListItemText>
              </MenuItem>

              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Sign out</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        ) : null}
      </Toolbar>
    </MuiAppBar>
  );
}
