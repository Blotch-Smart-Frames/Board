import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { SprintDialog } from './SprintDialog';
import { useSprintsQuery } from '../../hooks/useSprintsQuery';
import { compareOrder } from '../../utils/ordering';
import type { Sprint, Board } from '../../types/board';

type SprintManagementProps = {
  boardId: string;
  board?: Board | null;
  open: boolean;
  onClose: () => void;
};

export const SprintManagement = ({
  boardId,
  board,
  open,
  onClose,
}: SprintManagementProps) => {
  const {
    sprints,
    isLoading,
    deleteSprint,
    canDeleteSprint,
    updateSprintConfig,
  } = useSprintsQuery(boardId);

  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingSprintId, setDeletingSprintId] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState<string>(
    board?.sprintConfig?.durationDays?.toString() ?? '14',
  );
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const sortedSprints = [...sprints].sort((a, b) =>
    compareOrder(a.order, b.order),
  );

  const handleDeleteSprint = async (sprintId: string) => {
    setDeleteError(null);
    setDeletingSprintId(sprintId);

    try {
      const { canDelete, taskCount } = await canDeleteSprint(sprintId);

      if (!canDelete) {
        setDeleteError(
          `Cannot delete: ${taskCount} task${taskCount !== 1 ? 's are' : ' is'} assigned to this sprint. Remove tasks from the sprint first.`,
        );
        return;
      }

      await deleteSprint(sprintId);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Failed to delete sprint',
      );
    } finally {
      setDeletingSprintId(null);
    }
  };

  const handleSaveConfig = async () => {
    const days = parseInt(durationDays, 10);
    if (isNaN(days) || days < 1) return;

    setIsSavingConfig(true);
    try {
      await updateSprintConfig({ durationDays: days });
    } catch (error) {
      console.error('Failed to save sprint config:', error);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const formatSprintDates = (sprint: Sprint) => {
    const start = format(sprint.startDate.toDate(), 'MMM d, yyyy');
    const end = format(sprint.endDate.toDate(), 'MMM d, yyyy');
    return `${start} - ${end}`;
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle className="flex items-center justify-between">
          <Typography component="span" variant="h6">
            Sprint Management
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box className="flex flex-col gap-4">
            {/* Sprint Configuration */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Default Sprint Duration
              </Typography>
              <Box className="flex items-center gap-2">
                <TextField
                  type="number"
                  size="small"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  inputProps={{ min: 1, max: 365 }}
                  sx={{ width: '100px' }}
                />
                <Typography variant="body2">days</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSaveConfig}
                  disabled={
                    isSavingConfig ||
                    durationDays ===
                      board?.sprintConfig?.durationDays?.toString()
                  }
                >
                  {isSavingConfig ? 'Saving...' : 'Save'}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Used when auto-calculating dates for new sprints
              </Typography>
            </Box>

            <Divider />

            {/* Sprint List */}
            <Box>
              <Box className="mb-2 flex items-center justify-between">
                <Typography variant="subtitle2" color="text.secondary">
                  Sprints
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setShowCreateDialog(true)}
                  sx={{ textTransform: 'none' }}
                >
                  Create Sprint
                </Button>
              </Box>

              {deleteError && (
                <Alert
                  severity="error"
                  onClose={() => setDeleteError(null)}
                  sx={{ mb: 2 }}
                >
                  {deleteError}
                </Alert>
              )}

              {isLoading ? (
                <Box className="flex items-center justify-center py-4">
                  <CircularProgress size={24} />
                </Box>
              ) : sortedSprints.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No sprints created yet
                </Typography>
              ) : (
                <List disablePadding>
                  {sortedSprints.map((sprint) => (
                    <ListItem
                      key={sprint.id}
                      secondaryAction={
                        <Box>
                          <IconButton
                            size="small"
                            onClick={() => setEditingSprint(sprint)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteSprint(sprint.id)}
                            disabled={deletingSprintId === sprint.id}
                          >
                            {deletingSprintId === sprint.id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <DeleteIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Box>
                      }
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                      }}
                    >
                      <ListItemText
                        primary={sprint.name}
                        secondary={formatSprintDates(sprint)}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Sprint Dialog */}
      <SprintDialog
        boardId={boardId}
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      {/* Edit Sprint Dialog */}
      {editingSprint && (
        <SprintDialog
          boardId={boardId}
          open={!!editingSprint}
          sprint={editingSprint}
          onClose={() => setEditingSprint(null)}
        />
      )}
    </>
  );
};
