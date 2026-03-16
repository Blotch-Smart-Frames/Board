import { Box, Chip } from '@mui/material';
import { UserAvatar } from '../collaboration/UserAvatar';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

type AssigneeFilterProps = {
  collaborators: Collaborator[];
  selectedAssigneeId: string | null;
  onFilterChange: (assigneeId: string | null) => void;
};

export const AssigneeFilter = ({
  collaborators,
  selectedAssigneeId,
  onFilterChange,
}: AssigneeFilterProps) => (
  <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto' }}>
    <Chip
      label="All"
      variant={selectedAssigneeId === null ? 'filled' : 'outlined'}
      color={selectedAssigneeId === null ? 'primary' : 'default'}
      onClick={() => onFilterChange(null)}
      sx={
        selectedAssigneeId !== null
          ? [
              {
                bgcolor: 'background.paper',
                '&&:hover': { bgcolor: 'grey.100' },
              },
              (theme) =>
                theme.applyStyles('dark', {
                  '&&:hover': { bgcolor: 'grey.800' },
                }),
            ]
          : undefined
      }
    />
    {collaborators.map((collaborator) => (
      <Chip
        className="pl-1!"
        key={collaborator.id}
        avatar={
          <UserAvatar
            name={collaborator.name}
            photoURL={collaborator.photoURL}
            size="small"
            showTooltip={false}
          />
        }
        label={collaborator.name}
        variant={selectedAssigneeId === collaborator.id ? 'filled' : 'outlined'}
        color={selectedAssigneeId === collaborator.id ? 'primary' : 'default'}
        onClick={() => onFilterChange(collaborator.id)}
        sx={
          selectedAssigneeId !== collaborator.id
            ? [
                {
                  bgcolor: 'background.paper',
                  '&&:hover': { bgcolor: 'grey.100' },
                },
                (theme) =>
                  theme.applyStyles('dark', {
                    '&&:hover': { bgcolor: 'grey.800' },
                  }),
              ]
            : undefined
        }
      />
    ))}
  </Box>
);
