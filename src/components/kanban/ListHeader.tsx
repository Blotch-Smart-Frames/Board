import { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { useForm } from "@tanstack/react-form";

type ListHeaderProps = {
  title: string;
  taskCount: number;
  onUpdateTitle: (title: string) => void;
  onDelete: () => void;
};

export function ListHeader({
  title,
  taskCount,
  onUpdateTitle,
  onDelete,
}: ListHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    defaultValues: { title },
    onSubmit: async ({ value }) => {
      const trimmed = value.title.trim();
      if (trimmed && trimmed !== title) {
        onUpdateTitle(trimmed);
      }
      setIsEditing(false);
    },
  });

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCancel = () => {
    form.setFieldValue("title", title);
    setIsEditing(false);
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    form.setFieldValue("title", title);
    setIsEditing(true);
  };

  const handleDelete = () => {
    handleMenuClose();
    onDelete();
  };

  return (
    <Box className="flex items-center justify-between px-2 py-2 bg-gray-100 rounded-t-lg">
      {isEditing ? (
        <form.Field name="title">
          {(field) => (
            <TextField
              inputRef={inputRef}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={() => form.handleSubmit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  form.handleSubmit();
                } else if (e.key === "Escape") {
                  handleCancel();
                }
              }}
              size="small"
              variant="outlined"
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "white",
                },
              }}
            />
          )}
        </form.Field>
      ) : (
        <Box className="flex items-center gap-2 flex-1 min-w-0">
          <Typography
            variant="subtitle1"
            component="h2"
            className="font-semibold text-gray-700 truncate cursor-pointer"
            onClick={() => {
              form.setFieldValue("title", title);
              setIsEditing(true);
            }}
          >
            {title}
          </Typography>
          <Typography
            variant="caption"
            className="text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full"
          >
            {taskCount}
          </Typography>
        </Box>
      )}

      <IconButton size="small" onClick={handleMenuOpen}>
        <MoreIcon fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon fontSize="small" className="mr-2" />
          Edit title
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          <DeleteIcon fontSize="small" className="mr-2" />
          Delete list
        </MenuItem>
      </Menu>
    </Box>
  );
}
