import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
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
  Delete as DeleteIcon,
  Edit as EditIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useForm } from '@tanstack/react-form';
import { SortableBoardItem } from './SortableBoardItem';
import { getOrderAtIndex } from '../../utils/ordering';
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
  onReorderBoard?: (boardId: string, newOrder: string) => Promise<void>;
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
  onReorderBoard,
}: BoardListProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuBoardId, setMenuBoardId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderBoard) return;

    const oldIndex = boards.findIndex((b) => b.id === active.id);
    const newIndex = boards.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Compute the target index excluding the dragged item
    const withoutDragged = boards.filter((b) => b.id !== active.id);
    const newOrder = getOrderAtIndex(withoutDragged, newIndex);
    onReorderBoard(active.id as string, newOrder);
  };

  const activeDragBoard = activeDragId
    ? boards.find((b) => b.id === activeDragId)
    : null;

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(event) => setActiveDragId(event.active.id as string)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={boards.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <List className="flex-1 overflow-y-auto">
              {boards.map((board) => (
                <SortableBoardItem
                  key={board.id}
                  board={board}
                  isSelected={board.id === selectedBoardId}
                  onSelect={onSelectBoard}
                  onMenuOpen={handleMenuOpen}
                />
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
          </SortableContext>

          <DragOverlay>
            {activeDragBoard && (
              <ListItem
                component="div"
                disablePadding
                sx={{ bgcolor: 'background.paper', boxShadow: 3 }}
              >
                <ListItemButton selected={false}>
                  <ListItemIcon>
                    <BoardIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={activeDragBoard.title}
                    primaryTypographyProps={{
                      noWrap: true,
                      className: 'font-medium',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            )}
          </DragOverlay>
        </DndContext>
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
