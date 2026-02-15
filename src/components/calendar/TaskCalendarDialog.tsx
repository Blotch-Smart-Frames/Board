import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import { CalendarMonth as CalendarIcon } from '@mui/icons-material';
import type { Task } from '../../types/board';

type TaskCalendarDialogProps = {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onEnableSync: (task: Task) => Promise<void>;
  onDisableSync: (task: Task) => Promise<void>;
};

export function TaskCalendarDialog({
  open,
  task,
  onClose,
  onEnableSync,
  onDisableSync,
}: TaskCalendarDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!task) return null;

  const handleToggleSync = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (task.calendarSyncEnabled) {
        await onDisableSync(task);
      } else {
        await onEnableSync(task);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update sync settings',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const hasDueDate = !!task.dueDate;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle className="flex items-center gap-2">
        <CalendarIcon color="primary" />
        Calendar Sync
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" className="mb-4">
          Sync this task with your Google Calendar to get reminders and see it
          in your schedule.
        </Typography>

        {!hasDueDate && (
          <Alert severity="warning" className="mb-4">
            This task needs a due date to sync with Google Calendar.
          </Alert>
        )}

        {error && (
          <Alert severity="error" className="mb-4">
            {error}
          </Alert>
        )}

        <Box className="rounded-lg bg-gray-50 p-4">
          <Typography variant="subtitle2" className="mb-2">
            {task.title}
          </Typography>

          {task.dueDate && (
            <Typography variant="caption" color="text.secondary">
              Due: {task.dueDate.toDate().toLocaleDateString()}
            </Typography>
          )}

          <Box className="mt-4">
            <FormControlLabel
              control={
                <Switch
                  checked={task.calendarSyncEnabled}
                  onChange={handleToggleSync}
                  disabled={isLoading || !hasDueDate}
                />
              }
              label={
                isLoading ? (
                  <Box className="flex items-center gap-2">
                    <CircularProgress size={16} />
                    <span>Updating...</span>
                  </Box>
                ) : task.calendarSyncEnabled ? (
                  'Sync enabled'
                ) : (
                  'Enable sync'
                )
              }
            />
          </Box>

          {task.calendarEventId && (
            <Typography
              variant="caption"
              color="text.secondary"
              className="mt-2 block"
            >
              Linked to calendar event
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
