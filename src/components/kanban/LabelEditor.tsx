import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useForm } from '@tanstack/react-form';
import { ColorPicker } from '../common/ColorPicker';
import { LabelChip } from '../common/LabelChip';
import { labelColors } from '../../config/defaultLabels';
import type { Label, CreateLabelInput } from '../../types/board';
import { Timestamp } from 'firebase/firestore';

type LabelEditorProps = {
  open: boolean;
  label?: Label | null;
  onClose: () => void;
  onSave: (data: CreateLabelInput) => Promise<void>;
};

export function LabelEditor({
  open,
  label,
  onClose,
  onSave,
}: LabelEditorProps) {
  const isEditing = !!label;

  const form = useForm({
    defaultValues: {
      name: label?.name ?? '',
      emoji: label?.emoji ?? '',
      color: label?.color ?? labelColors[0],
    },
    onSubmit: async ({ value }) => {
      await onSave({
        name: value.name.trim(),
        color: value.color,
        emoji: value.emoji.trim() || undefined,
      });
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      key={open ? (label?.id ?? 'new') : 'closed'}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <DialogTitle className="flex items-center justify-between">
          <Typography variant="h6">
            {isEditing ? 'Edit Label' : 'Create Label'}
          </Typography>
          <IconButton onClick={onClose} size="small" type="button">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box className="flex flex-col gap-4">
            <form.Subscribe
              selector={(state) => ({
                name: state.values.name,
                emoji: state.values.emoji,
                color: state.values.color,
              })}
            >
              {({ name, emoji, color }) => {
                const previewLabel: Label = {
                  id: 'preview',
                  name: name || 'Label',
                  color,
                  emoji: emoji || undefined,
                  order: '0',
                  createdAt: Timestamp.now(),
                  updatedAt: Timestamp.now(),
                };
                return (
                  <Box className="flex justify-center py-2">
                    <LabelChip label={previewLabel} />
                  </Box>
                );
              }}
            </form.Subscribe>

            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) =>
                  !value.trim() ? 'Name is required' : undefined,
              }}
            >
              {(field) => (
                <TextField
                  label="Name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={
                    field.state.meta.isTouched && !field.state.meta.isValid
                  }
                  helperText={
                    field.state.meta.isTouched &&
                    field.state.meta.errors.join(', ')
                  }
                  fullWidth
                  required
                  autoFocus
                  size="small"
                />
              )}
            </form.Field>

            <form.Field name="emoji">
              {(field) => (
                <TextField
                  label="Emoji (optional)"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Paste or type an emoji"
                  slotProps={{ htmlInput: { maxLength: 4 } }}
                />
              )}
            </form.Field>

            <form.Field name="color">
              {(field) => (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    className="mb-2"
                  >
                    Color
                  </Typography>
                  <ColorPicker
                    value={field.state.value}
                    onChange={field.handleChange}
                  />
                </Box>
              )}
            </form.Field>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} type="button">
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                variant="contained"
                type="submit"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? 'Saving...' : isEditing ? 'Save' : 'Create'}
              </Button>
            )}
          </form.Subscribe>
        </DialogActions>
      </form>
    </Dialog>
  );
}
