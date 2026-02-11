import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Checkbox,
  Button,
  CircularProgress,
} from '@mui/material';
import { Settings as SettingsIcon, Add as AddIcon } from '@mui/icons-material';
import { LabelChip } from '../common/LabelChip';
import { LabelEditor } from './LabelEditor';
import { LabelManagement } from './LabelManagement';
import { useLabelsQuery } from '../../hooks/useLabelsQuery';

type LabelPickerProps = {
  boardId: string;
  selectedLabelIds: string[];
  onChange: (labelIds: string[]) => void;
};

export function LabelPicker({
  boardId,
  selectedLabelIds,
  onChange,
}: LabelPickerProps) {
  const { labels, isLoading, createLabel, initializeDefaultLabels } =
    useLabelsQuery(boardId);
  const [showEditor, setShowEditor] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const initializedRef = useRef(false);

  // Initialize default labels if none exist (lazy initialization)
  useEffect(() => {
    if (!isLoading && labels.length === 0 && !initializedRef.current) {
      initializedRef.current = true;
      initializeDefaultLabels().catch(console.error);
    }
  }, [isLoading, labels.length, initializeDefaultLabels]);

  const handleToggleLabel = (labelId: string) => {
    if (selectedLabelIds.includes(labelId)) {
      onChange(selectedLabelIds.filter((id) => id !== labelId));
    } else {
      onChange([...selectedLabelIds, labelId]);
    }
  };

  const handleCreateLabel = async (data: { name: string; color: string; emoji?: string }) => {
    await createLabel(data);
  };

  if (isLoading) {
    return (
      <Box className="flex items-center justify-center py-4">
        <CircularProgress size={24} />
      </Box>
    );
  }

  const sortedLabels = [...labels].sort((a, b) => a.order.localeCompare(b.order));

  return (
    <Box>
      <Box className="flex items-center justify-between mb-2">
        <Typography variant="body2" color="text.secondary">
          Labels
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

      <Box className="flex flex-wrap gap-2 mb-2">
        {sortedLabels.map((label) => (
          <Box
            key={label.id}
            onClick={() => handleToggleLabel(label.id)}
            className="flex items-center gap-1 cursor-pointer"
            sx={{
              opacity: selectedLabelIds.includes(label.id) ? 1 : 0.6,
              transition: 'opacity 0.2s',
              '&:hover': {
                opacity: 1,
              },
            }}
          >
            <Checkbox
              checked={selectedLabelIds.includes(label.id)}
              size="small"
              sx={{ padding: '2px' }}
            />
            <LabelChip label={label} />
          </Box>
        ))}
      </Box>

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => setShowEditor(true)}
        sx={{ textTransform: 'none' }}
      >
        Create label
      </Button>

      <LabelEditor
        open={showEditor}
        onClose={() => setShowEditor(false)}
        onSave={handleCreateLabel}
      />

      <LabelManagement
        boardId={boardId}
        open={showManagement}
        onClose={() => setShowManagement(false)}
      />
    </Box>
  );
}
