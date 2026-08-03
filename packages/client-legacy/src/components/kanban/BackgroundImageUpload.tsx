import { useRef, useState } from 'react';
import {
  Fab,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteIcon from '@mui/icons-material/Delete';
import { deleteField } from 'firebase/firestore';
import {
  uploadBoardBackground,
  deleteBoardBackground,
} from '../../services/storageService';
import { updateBoard } from '../../services/boardService';

type BackgroundImageUploadProps = {
  boardId: string;
  hasBackground: boolean;
};

export const BackgroundImageUpload = ({
  boardId,
  hasBackground,
}: BackgroundImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleUploadClick = () => {
    setDialogOpen(false);
    inputRef.current?.click();
  };

  const handleRemove = async () => {
    setDialogOpen(false);
    setIsLoading(true);
    try {
      await deleteBoardBackground(boardId);
      await updateBoard(boardId, { backgroundImageUrl: deleteField() });
    } catch (err) {
      console.error('Failed to remove background:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const url = await uploadBoardBackground(boardId, file);
      await updateBoard(boardId, { backgroundImageUrl: url });
    } catch (err) {
      console.error('Failed to upload background:', err);
    } finally {
      setIsLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        hidden
      />
      <Fab
        size="small"
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        aria-label="Board background options"
      >
        {isLoading ? <CircularProgress size={24} /> : <WallpaperIcon />}
      </Fab>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Board background</DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <List>
            <ListItemButton onClick={handleUploadClick}>
              <ListItemIcon>
                <UploadIcon />
              </ListItemIcon>
              <ListItemText primary="Upload new image" />
            </ListItemButton>
            {hasBackground && (
              <ListItemButton onClick={handleRemove}>
                <ListItemIcon>
                  <DeleteIcon />
                </ListItemIcon>
                <ListItemText primary="Remove background" />
              </ListItemButton>
            )}
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
};
