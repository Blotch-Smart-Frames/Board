import { useState } from 'react';
import {
  AppBar as MuiAppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  ViewKanban as KanbanIcon,
  ViewTimeline as TimelineIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useAuthQuery } from '../../hooks/useAuthQuery';
import { UserAvatar } from '../collaboration/UserAvatar';
import { ThemeToggle } from './ThemeToggle';

type ViewMode = 'kanban' | 'timeline';

type AppBarProps = {
  title?: string;
  onMenuClick?: () => void;
  showShare?: boolean;
  onShare?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
};

export const AppBar = ({
  title = 'Board by Blotch',
  onMenuClick,
  showShare,
  onShare,
  viewMode,
  onViewModeChange,
}: AppBarProps) => {
  const { user, logout, isAuthenticated } = useAuthQuery();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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
      <Toolbar className="gap-2" sx={{ px: isMobile ? 1 : 2 }}>
        {onMenuClick && (
          <IconButton edge="start" onClick={onMenuClick} aria-label="menu">
            <MenuIcon />
          </IconButton>
        )}

        <Typography
          variant="h6"
          component="div"
          className="grow font-semibold"
          color="primary"
          noWrap
        >
          {title}
        </Typography>

        {viewMode && onViewModeChange && (
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode: ViewMode | null) => {
              if (newMode) onViewModeChange(newMode);
            }}
            size="small"
          >
            <Tooltip title="Kanban">
              <ToggleButton value="kanban" aria-label="Kanban view">
                <KanbanIcon sx={isMobile ? undefined : { mr: 0.5 }} />
                {!isMobile && 'Kanban'}
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Timeline">
              <ToggleButton value="timeline" aria-label="Timeline view">
                <TimelineIcon sx={isMobile ? undefined : { mr: 0.5 }} />
                {!isMobile && 'Timeline'}
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        )}

        {showShare && onShare && (
          <IconButton onClick={onShare} aria-label="Share">
            <ShareIcon />
          </IconButton>
        )}

        <ThemeToggle />

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
};
