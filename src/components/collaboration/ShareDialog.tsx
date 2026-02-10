import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
} from "@mui/icons-material";
import { useForm } from "@tanstack/react-form";
import { UserAvatar } from "./UserAvatar";

type Collaborator = {
  id: string;
  email: string;
  name: string;
  photoURL?: string | null;
  isOwner?: boolean;
};

type ShareDialogProps = {
  open: boolean;
  boardTitle: string;
  collaborators: Collaborator[];
  onClose: () => void;
  onInvite: (email: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
};

export function ShareDialog({
  open,
  boardTitle,
  collaborators,
  onClose,
  onInvite,
  onRemove,
}: ShareDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      setSuccess(null);
      try {
        await onInvite(value.email.trim());
        setSuccess(`Invitation sent to ${value.email}`);
        form.reset();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send invitation",
        );
      }
    },
  });

  const handleRemove = async (userId: string) => {
    try {
      await onRemove(userId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove collaborator",
      );
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setSuccess("Link copied to clipboard");
    setTimeout(() => setSuccess(null), 3000);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6">Share "{boardTitle}"</Typography>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert
            severity="error"
            className="mb-4"
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            className="mb-4"
            onClose={() => setSuccess(null)}
          >
            {success}
          </Alert>
        )}

        <Box className="flex gap-2 mb-4">
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
              email: state.values.email,
            })}
          >
            {({ canSubmit, isSubmitting, email }) => (
              <>
                <form.Field name="email">
                  {(field) => (
                    <TextField
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          form.handleSubmit();
                        }
                      }}
                      placeholder="Enter email address"
                      size="small"
                      fullWidth
                      disabled={isSubmitting}
                    />
                  )}
                </form.Field>
                <Button
                  variant="contained"
                  onClick={() => form.handleSubmit()}
                  disabled={!email.trim() || !canSubmit || isSubmitting}
                  startIcon={
                    isSubmitting ? (
                      <CircularProgress size={20} />
                    ) : (
                      <PersonAddIcon />
                    )
                  }
                >
                  Invite
                </Button>
              </>
            )}
          </form.Subscribe>
        </Box>

        <Button
          variant="outlined"
          startIcon={<CopyIcon />}
          onClick={handleCopyLink}
          fullWidth
          className="mb-4"
        >
          Copy board link
        </Button>

        <Typography variant="subtitle2" className="mb-2">
          People with access
        </Typography>

        <List dense>
          {collaborators.map((user) => (
            <ListItem
              key={user.id}
              secondaryAction={
                !user.isOwner && (
                  <IconButton
                    edge="end"
                    onClick={() => handleRemove(user.id)}
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )
              }
            >
              <ListItemAvatar>
                <UserAvatar
                  name={user.name}
                  photoURL={user.photoURL}
                  size="medium"
                />
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box className="flex items-center gap-2">
                    {user.name}
                    {user.isOwner && (
                      <Chip label="Owner" size="small" color="primary" />
                    )}
                  </Box>
                }
                secondary={user.email}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
