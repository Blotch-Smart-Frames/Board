import { useState } from 'react';
import { Paper, Box, Button, TextField } from '@mui/material';
import { Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import { useForm } from '@tanstack/react-form';

type AddListButtonProps = {
  onAdd: (title: string) => void;
};

export function AddListButton({ onAdd }: AddListButtonProps) {
  const [isAdding, setIsAdding] = useState(false);

  const form = useForm({
    defaultValues: { title: '' },
    onSubmit: async ({ value }) => {
      const trimmed = value.title.trim();
      if (trimmed) {
        onAdd(trimmed);
        form.reset();
        setIsAdding(false);
      }
    },
  });

  const handleCancel = () => {
    form.reset();
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <Button
        startIcon={<AddIcon />}
        onClick={() => setIsAdding(true)}
        className="w-72 shrink-0"
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          color: 'text.secondary',
          justifyContent: 'flex-start',
          height: 'fit-content',
          py: 1.5,
          px: 2,
          borderRadius: 2,
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
          },
        }}
      >
        Add another list
      </Button>
    );
  }

  return (
    <Paper
      className="w-72 shrink-0 p-2"
      sx={{ backgroundColor: '#ebecf0', borderRadius: 2 }}
    >
      <form.Field name="title">
        {(field) => (
          <TextField
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                form.handleSubmit();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
            onBlur={handleCancel}
            placeholder="Enter list title..."
            size="small"
            fullWidth
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'white',
              },
            }}
          />
        )}
      </form.Field>
      <Box className="flex items-center gap-2 mt-2">
        <form.Subscribe selector={(state) => state.values.title}>
          {(title) => (
            <Button
              variant="contained"
              size="small"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => form.handleSubmit()}
              disabled={!title.trim()}
            >
              Add list
            </Button>
          )}
        </form.Subscribe>
        <Button
          size="small"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleCancel}
          sx={{ minWidth: 'auto', p: 1 }}
        >
          <CloseIcon fontSize="small" />
        </Button>
      </Box>
    </Paper>
  );
}
