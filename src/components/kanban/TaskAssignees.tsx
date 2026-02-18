import { AvatarGroup } from '@mui/material';
import { UserAvatar } from '../collaboration/UserAvatar';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

type TaskAssigneesProps = {
  assignedUsers: Collaborator[];
};

export const TaskAssignees = ({ assignedUsers }: TaskAssigneesProps) => {
  if (assignedUsers.length === 0) {
    return null;
  }

  return (
    <AvatarGroup
      max={3}
      sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 10 } }}
    >
      {assignedUsers.map((user) => (
        <UserAvatar
          key={user.id}
          name={user.name}
          photoURL={user.photoURL}
          size="small"
        />
      ))}
    </AvatarGroup>
  );
};
