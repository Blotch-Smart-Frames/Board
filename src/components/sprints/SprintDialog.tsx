import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  Typography,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Close as CloseIcon } from '@mui/icons-material';
import { useForm } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { useSprintsQuery } from '../../hooks/useSprintsQuery';
import type {
  Sprint,
  CreateSprintInput,
  UpdateSprintInput,
} from '../../types/board';

type SprintDialogProps = {
  boardId: string;
  open: boolean;
  sprint?: Sprint | null;
  onClose: () => void;
};

type SprintFormContentProps = {
  boardId: string;
  isEditing: boolean;
  sprint?: Sprint | null;
  defaultName: string;
  defaultStartDate: Date | null;
  defaultEndDate: Date | null;
  onClose: () => void;
};

function SprintFormContent({
  boardId,
  isEditing,
  sprint,
  defaultName,
  defaultStartDate,
  defaultEndDate,
  onClose,
}: SprintFormContentProps) {
  const { createSprint, updateSprint } = useSprintsQuery(boardId);

  const form = useForm({
    defaultValues: {
      name: defaultName,
      startDate: defaultStartDate as Date | null,
      endDate: defaultEndDate as Date | null,
    },
    onSubmit: async ({ value }) => {
      if (!value.startDate || !value.endDate) return;

      if (isEditing && sprint) {
        const updates: UpdateSprintInput = {
          name: value.name.trim(),
          startDate: value.startDate,
          endDate: value.endDate,
        };
        await updateSprint(sprint.id, updates);
      } else {
        const input: CreateSprintInput = {
          name: value.name.trim(),
          startDate: value.startDate,
          endDate: value.endDate,
        };
        await createSprint(input);
      }
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <DialogTitle className="flex items-center justify-between">
        <Typography component="span" variant="h6">
          {isEditing ? 'Edit Sprint' : 'Create Sprint'}
        </Typography>
        <IconButton onClick={onClose} size="small" type="button">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box className="flex flex-col gap-4">
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) =>
                !value.trim() ? 'Name is required' : undefined,
            }}
          >
            {(field) => (
              <TextField
                label="Sprint Name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.isTouched && !field.state.meta.isValid}
                helperText={
                  field.state.meta.isTouched &&
                  field.state.meta.errors.join(', ')
                }
                fullWidth
                required
                autoFocus
              />
            )}
          </form.Field>

          <div className="flex gap-4">
            <form.Subscribe selector={(state) => state.values.endDate}>
              {(endDate) => (
                <form.Field
                  name="startDate"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return 'Start date is required';
                      if (endDate && value > endDate)
                        return 'Start date must be before end date';
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <DatePicker
                      label="Start date"
                      value={field.state.value}
                      onChange={(date) => field.handleChange(date)}
                      maxDate={endDate || undefined}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          required: true,
                          error:
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid,
                          helperText:
                            field.state.meta.isTouched &&
                            field.state.meta.errors.join(', '),
                        },
                      }}
                    />
                  )}
                </form.Field>
              )}
            </form.Subscribe>

            <form.Subscribe selector={(state) => state.values.startDate}>
              {(startDate) => (
                <form.Field
                  name="endDate"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return 'End date is required';
                      if (startDate && value < startDate)
                        return 'End date must be after start date';
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <DatePicker
                      label="End date"
                      value={field.state.value}
                      onChange={(date) => field.handleChange(date)}
                      minDate={startDate || undefined}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          required: true,
                          error:
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid,
                          helperText:
                            field.state.meta.isTouched &&
                            field.state.meta.errors.join(', '),
                        },
                      }}
                    />
                  )}
                </form.Field>
              )}
            </form.Subscribe>
          </div>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} type="button">
          Cancel
        </Button>
        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
            name: state.values.name,
            startDate: state.values.startDate,
            endDate: state.values.endDate,
          })}
        >
          {({ canSubmit, isSubmitting, name, startDate, endDate }) => (
            <Button
              variant="contained"
              type="submit"
              disabled={
                !name.trim() ||
                !startDate ||
                !endDate ||
                !canSubmit ||
                isSubmitting
              }
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save' : 'Create'}
            </Button>
          )}
        </form.Subscribe>
      </DialogActions>
    </form>
  );
}

export function SprintDialog({
  boardId,
  open,
  sprint,
  onClose,
}: SprintDialogProps) {
  const isEditing = !!sprint;
  const { calculateNextSprintDates } = useSprintsQuery(boardId);

  const { data: sprintDefaults, isLoading: isLoadingDefaults } = useQuery({
    queryKey: ['boards', boardId, 'sprintDefaults'],
    queryFn: () => calculateNextSprintDates(),
    enabled: open && !isEditing,
    gcTime: 0,
  });

  const showLoading = !isEditing && (isLoadingDefaults || !sprintDefaults);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        {showLoading ? (
          <>
            <DialogTitle className="flex items-center justify-between">
              <Typography component="span" variant="h6">
                Create Sprint
              </Typography>
              <IconButton onClick={onClose} size="small" type="button">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Box className="flex items-center justify-center py-8">
                <CircularProgress />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose} type="button">
                Cancel
              </Button>
            </DialogActions>
          </>
        ) : (
          <SprintFormContent
            key={isEditing ? sprint?.id : sprintDefaults?.suggestedName}
            boardId={boardId}
            isEditing={isEditing}
            sprint={sprint}
            defaultName={sprint?.name ?? sprintDefaults?.suggestedName ?? ''}
            defaultStartDate={
              sprint?.startDate?.toDate() ?? sprintDefaults?.startDate ?? null
            }
            defaultEndDate={
              sprint?.endDate?.toDate() ?? sprintDefaults?.endDate ?? null
            }
            onClose={onClose}
          />
        )}
      </Dialog>
    </LocalizationProvider>
  );
}
