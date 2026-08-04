import { useState } from 'react';
import {
  Box,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Button,
  CircularProgress,
} from '@mui/material';
import { Settings as SettingsIcon, Add as AddIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { SprintDialog } from './SprintDialog';
import { SprintManagement } from './SprintManagement';
import { useSprintsQuery } from '../../hooks/useSprintsQuery';
import { compareOrder } from '../../utils/ordering';
import type { Sprint, Board } from '../../types/board';

type SprintPickerProps = {
  boardId: string;
  board?: Board | null;
  selectedSprintId: string | null;
  onChange: (sprintId: string | null) => void;
};

const formatSprintDateRange = (sprint: Sprint) => {
  const start = format(sprint.startDate.toDate(), 'MMM d');
  const end = format(sprint.endDate.toDate(), 'MMM d');
  return `${start} - ${end}`;
};

export const SprintPicker = ({
  boardId,
  board,
  selectedSprintId,
  onChange,
}: SprintPickerProps) => {
  const { sprints, isLoading } = useSprintsQuery(boardId);
  const [showDialog, setShowDialog] = useState(false);
  const [showManagement, setShowManagement] = useState(false);

  if (isLoading) {
    return (
      <Box className="flex items-center justify-center py-4">
        <CircularProgress size={24} />
      </Box>
    );
  }

  const sortedSprints = [...sprints].sort((a, b) =>
    compareOrder(a.order, b.order),
  );

  return (
    <Box>
      <Box className="mb-2 flex items-center justify-between">
        <Typography variant="body2" color="text.secondary">
          Sprint
        </Typography>
        <Button
          size="small"
          startIcon={<SettingsIcon />}
          onClick={() => setShowManagement(true)}
          sx={{ textTransform: 'none' }}
        >
          Manage
        </Button>
      </Box>

      <FormControl fullWidth size="small">
        <Select
          value={selectedSprintId ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          displayEmpty
        >
          <MenuItem value="">
            <em>No sprint (Backlog)</em>
          </MenuItem>
          {sortedSprints.map((sprint) => (
            <MenuItem key={sprint.id} value={sprint.id}>
              <Box className="flex w-full items-center justify-between">
                <span>{sprint.name}</span>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 2 }}
                >
                  {formatSprintDateRange(sprint)}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => setShowDialog(true)}
        sx={{ textTransform: 'none', mt: 1 }}
      >
        Create sprint
      </Button>

      <SprintDialog
        boardId={boardId}
        open={showDialog}
        onClose={() => setShowDialog(false)}
      />

      <SprintManagement
        boardId={boardId}
        board={board}
        open={showManagement}
        onClose={() => setShowManagement(false)}
      />
    </Box>
  );
};
