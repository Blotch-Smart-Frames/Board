import { Box, Typography, Checkbox } from '@mui/material';
import { UserAvatar } from '../collaboration/UserAvatar';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

type AssigneePickerProps = {
  collaborators: Collaborator[];
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
};

export const AssigneePicker = ({
  collaborators,
  selectedUserIds,
  onChange,
}: AssigneePickerProps) => {
  const handleToggle = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onChange(selectedUserIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedUserIds, userId]);
    }
  };

  // Sort: owners first, then alphabetically by name
  const sortedCollaborators = [...collaborators].sort((a, b) => {
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (collaborators.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" className="mb-2">
        Assignees
      </Typography>

      <Box className="flex flex-col gap-1">
        {sortedCollaborators.map((collaborator) => (
          <Box
            key={collaborator.id}
            onClick={() => handleToggle(collaborator.id)}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1"
            sx={{
              opacity: selectedUserIds.includes(collaborator.id) ? 1 : 0.6,
              transition: 'opacity 0.2s',
              '&:hover': {
                opacity: 1,
                backgroundColor: 'action.hover',
              },
            }}
          >
            <Checkbox
              checked={selectedUserIds.includes(collaborator.id)}
              size="small"
              sx={{ padding: '2px' }}
            />
            <UserAvatar
              name={collaborator.name}
              photoURL={collaborator.photoURL}
              size="small"
              showTooltip={false}
            />
            <Typography variant="body2">{collaborator.name}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
