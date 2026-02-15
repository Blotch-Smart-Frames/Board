import { Box, AvatarGroup, Typography, Tooltip } from '@mui/material';
import { UserAvatar } from './UserAvatar';

type User = {
  id: string;
  name: string;
  photoURL?: string | null;
  isOnline?: boolean;
};

type PresenceIndicatorProps = {
  users: User[];
  maxVisible?: number;
};

export function PresenceIndicator({
  users,
  maxVisible = 4,
}: PresenceIndicatorProps) {
  const onlineUsers = users.filter((u) => u.isOnline);
  const offlineUsers = users.filter((u) => !u.isOnline);

  if (users.length === 0) {
    return null;
  }

  return (
    <Box className="flex items-center gap-2">
      <AvatarGroup
        max={maxVisible}
        sx={{
          '& .MuiAvatar-root': {
            width: 28,
            height: 28,
            fontSize: 12,
            border: '2px solid white',
          },
        }}
      >
        {onlineUsers.map((user) => (
          <Tooltip key={user.id} title={`${user.name} (online)`}>
            <Box className="relative">
              <UserAvatar
                name={user.name}
                photoURL={user.photoURL}
                size="small"
                showTooltip={false}
              />
              <Box className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
            </Box>
          </Tooltip>
        ))}
        {offlineUsers.map((user) => (
          <UserAvatar
            key={user.id}
            name={user.name}
            photoURL={user.photoURL}
            size="small"
          />
        ))}
      </AvatarGroup>

      {onlineUsers.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          {onlineUsers.length} online
        </Typography>
      )}
    </Box>
  );
}
