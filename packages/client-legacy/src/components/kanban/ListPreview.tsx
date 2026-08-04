import { Paper, Box, Typography } from '@mui/material';
import type { List } from '../../types/board';

type ListPreviewProps = {
  list: List;
  taskCount: number;
};

export const ListPreview = ({ list, taskCount }: ListPreviewProps) => {
  return (
    <Paper
      className="ring-primary-500 flex w-72 shrink-0 cursor-grabbing flex-col shadow-lg ring-2"
      sx={{
        bgcolor: 'background.default',
        borderRadius: 2,
        minHeight: 200,
        maxHeight: 'calc(100vh - 140px)',
        opacity: 0.95,
      }}
    >
      <Box className="flex items-center justify-between px-2 py-2">
        <Box className="flex min-w-0 flex-1 items-center gap-2">
          <Typography
            variant="subtitle1"
            component="h2"
            className="truncate font-semibold"
            color="text.primary"
          >
            {list.title}
          </Typography>
          <Typography
            variant="caption"
            className="rounded-full px-2 py-0.5"
            sx={{ color: 'text.secondary', bgcolor: 'action.selected' }}
          >
            {taskCount}
          </Typography>
        </Box>
      </Box>

      <Box className="flex flex-1 items-center justify-center px-2 py-4">
        <Typography variant="body2" color="text.secondary">
          {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
        </Typography>
      </Box>
    </Paper>
  );
};
