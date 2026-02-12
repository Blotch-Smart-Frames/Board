import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Button,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { LabelChip } from '../common/LabelChip';
import { LabelEditor } from './LabelEditor';
import { useLabelsQuery } from '../../hooks/useLabelsQuery';
import type { Label, CreateLabelInput } from '../../types/board';
import { compareOrder } from '../../utils/ordering';

type LabelManagementProps = {
  boardId: string;
  open: boolean;
  onClose: () => void;
};

export function LabelManagement({
  boardId,
  open,
  onClose,
}: LabelManagementProps) {
  const { labels, createLabel, updateLabel, deleteLabel } =
    useLabelsQuery(boardId);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);

  const handleSaveLabel = async (data: CreateLabelInput) => {
    if (editingLabel) {
      await updateLabel(editingLabel.id, data);
    } else {
      await createLabel(data);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    setDeletingLabelId(labelId);
    try {
      await deleteLabel(labelId);
    } catch (error) {
      console.error('Failed to delete label:', error);
    } finally {
      setDeletingLabelId(null);
    }
  };

  const handleOpenCreate = () => {
    setEditingLabel(null);
    setShowEditor(true);
  };

  const handleOpenEdit = (label: Label) => {
    setEditingLabel(label);
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingLabel(null);
  };

  const sortedLabels = [...labels].sort((a, b) => compareOrder(a.order, b.order));

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle className="flex items-center justify-between">
          <Typography variant="h6">Manage Labels</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <List disablePadding>
            {sortedLabels.map((label, index) => (
              <Box key={label.id}>
                {index > 0 && <Divider />}
                <ListItem
                  disablePadding
                  secondaryAction={
                    <Box className="flex gap-1">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEdit(label)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteLabel(label.id)}
                        disabled={deletingLabelId === label.id}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemButton
                    onClick={() => handleOpenEdit(label)}
                    sx={{ py: 1.5 }}
                  >
                    <LabelChip label={label} />
                  </ListItemButton>
                </ListItem>
              </Box>
            ))}
          </List>

          {labels.length === 0 && (
            <Box className="flex items-center justify-center py-8">
              <Typography color="text.secondary">
                No labels yet. Create one to get started.
              </Typography>
            </Box>
          )}

          <Box className="mt-4">
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
            >
              Create new label
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <LabelEditor
        open={showEditor}
        label={editingLabel}
        onClose={handleCloseEditor}
        onSave={handleSaveLabel}
      />
    </>
  );
}
