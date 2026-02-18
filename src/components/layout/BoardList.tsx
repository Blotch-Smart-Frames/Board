import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Dashboard as BoardIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useForm } from '@tanstack/react-form';
import type { Board } from '../../types/board';

type BoardListProps = {
  boards: Board[];
  selectedBoardId?: string | null;
  isLoading?: boolean;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: (title: string) => Promise<void>;
  onDeleteBoard?: (boardId: string) => Promise<void>;
  onRenameBoard?: (boardId: string, title: string) => Promise<void>;
  onShareBoard?: (boardId: string) => void;
};

export const BoardList = ({
  boards,
  selectedBoardId,
  isLoading,
  onSelectBoard,
  onCreateBoard,
  onDeleteBoard,
  onRenameBoard,
  onShareBoard,
}: BoardListProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuBoardId, setMenuBoardId] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { title: '' },
    onSubmit: async ({ value }) => {
      const trimmed = value.title.trim();
      if (!trimmed) return;
      try {
        await onCreateBoard(trimmed);
        form.reset();
        setIsCreating(false);
      } catch (err) {
        console.error('Failed to create board:', err);
      }
    },
  });

  const renameForm = useForm({
    defaultValues: { title: '' },
    onSubmit: async ({ value }) => {
      const trimmed = value.title.trim();
      if (!trimmed || !renamingBoardId || !onRenameBoard) return;
      try {
        await onRenameBoard(renamingBoardId, trimmed);
        renameForm.reset();
        setRenamingBoardId(null);
      } catch (err) {
        console.error('Failed to rename board:', err);
      }
    },
  });

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    boardId: string,
  ) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuBoardId(boardId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuBoardId(null);
  };

  const handleDelete = async () => {
    if (menuBoardId && onDeleteBoard) {
      await onDeleteBoard(menuBoardId);
    }
    handleMenuClose();
  };

  const handleRenameClick = () => {
    if (menuBoardId) {
      const board = boards.find((b) => b.id === menuBoardId);
      renameForm.setFieldValue('title', board?.title ?? '');
      setRenamingBoardId(menuBoardId);
    }
    handleMenuClose();
  };

  const handleCloseRenameDialog = () => {
    renameForm.reset();
    setRenamingBoardId(null);
  };

  const handleCloseDialog = () => {
    form.reset();
    setIsCreating(false);
  };

  return (
    <Paper className="flex h-full flex-col" elevation={0}>
      <Box className="border-b p-4">
        <Typography variant="subtitle1" className="font-semibold">
          My Boards
        </Typography>
      </Box>

      {isLoading ? (
        <Box className="flex items-center justify-center p-8">
          <CircularProgress size={24} />
        </Box>
      ) : (
        <List className="flex-1 overflow-y-auto">
          {boards.map((board) => (
            <ListItem
              key={board.id}
              disablePadding
              secondaryAction={
                <IconButton
                  edge="end"
                  size="small"
                  onClick={(e) => handleMenuOpen(e, board.id)}
                >
                  <MoreIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton
                selected={board.id === selectedBoardId}
                onClick={() => onSelectBoard(board.id)}
              >
                <ListItemIcon>
                  <BoardIcon />
                </ListItemIcon>
                <ListItemText
                  primary={board.title}
                  primaryTypographyProps={{
                    noWrap: true,
                    className: 'font-medium',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}

          {boards.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No boards yet"
                secondary="Create your first board to get started"
                className="text-center"
              />
            </ListItem>
          )}
        </List>
      )}

      <Box className="border-t p-4">
        <Button
          startIcon={<AddIcon />}
          onClick={() => setIsCreating(true)}
          fullWidth
          variant="outlined"
        >
          Create board
        </Button>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        {onRenameBoard && (
          <MenuItem onClick={handleRenameClick}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rename</ListItemText>
          </MenuItem>
        )}
        {onShareBoard && (
          <MenuItem
            onClick={() => {
              if (menuBoardId) onShareBoard(menuBoardId);
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <ShareIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Share</ListItemText>
          </MenuItem>
        )}
        {onDeleteBoard && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={isCreating}
        onClose={handleCloseDialog}
        maxWidth="xs"
        fullWidth
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <DialogTitle>Create new board</DialogTitle>
          <DialogContent>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <form.Field name="title">
                  {(field) => (
                    <TextField
                      autoFocus
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          handleCloseDialog();
                        }
                      }}
                      placeholder="Enter board title"
                      fullWidth
                      margin="dense"
                      disabled={isSubmitting}
                    />
                  )}
                </form.Field>
              )}
            </form.Subscribe>
          </DialogContent>
          <DialogActions>
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
                title: state.values.title,
              })}
            >
              {({ canSubmit, isSubmitting, title }) => (
                <>
                  <Button
                    onClick={handleCloseDialog}
                    disabled={isSubmitting}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!title.trim() || !canSubmit || isSubmitting}
                  >
                    {isSubmitting ? <CircularProgress size={20} /> : 'Create'}
                  </Button>
                </>
              )}
            </form.Subscribe>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={renamingBoardId !== null}
        onClose={handleCloseRenameDialog}
        maxWidth="xs"
        fullWidth
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            renameForm.handleSubmit();
          }}
        >
          <DialogTitle>Rename board</DialogTitle>
          <DialogContent>
            <renameForm.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <renameForm.Field name="title">
                  {(field) => (
                    <TextField
                      autoFocus
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          handleCloseRenameDialog();
                        }
                      }}
                      placeholder="Enter board title"
                      fullWidth
                      margin="dense"
                      disabled={isSubmitting}
                    />
                  )}
                </renameForm.Field>
              )}
            </renameForm.Subscribe>
          </DialogContent>
          <DialogActions>
            <renameForm.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
                title: state.values.title,
              })}
            >
              {({ canSubmit, isSubmitting, title }) => (
                <>
                  <Button
                    onClick={handleCloseRenameDialog}
                    disabled={isSubmitting}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!title.trim() || !canSubmit || isSubmitting}
                  >
                    {isSubmitting ? <CircularProgress size={20} /> : 'Rename'}
                  </Button>
                </>
              )}
            </renameForm.Subscribe>
          </DialogActions>
        </form>
      </Dialog>
    </Paper>
  );
};
