import { Avatar, Tooltip } from '@mui/material';

type UserAvatarProps = {
  name: string;
  photoURL?: string | null;
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
};

const sizeMap = {
  small: 24,
  medium: 32,
  large: 40,
};

const getInitials = (name: string): string => {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
};

export const UserAvatar = ({
  name,
  photoURL,
  size = 'medium',
  showTooltip = true,
}: UserAvatarProps) => {
  const avatarSize = sizeMap[size];

  const avatar = (
    <Avatar
      src={photoURL || undefined}
      alt={name}
      sx={{
        width: avatarSize,
        height: avatarSize,
        fontSize: avatarSize * 0.4,
        backgroundColor: photoURL ? undefined : stringToColor(name),
      }}
    >
      {!photoURL && getInitials(name)}
    </Avatar>
  );

  if (!showTooltip) {
    return avatar;
  }

  return <Tooltip title={name}>{avatar}</Tooltip>;
};
