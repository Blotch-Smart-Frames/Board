import { useRef, useState } from 'react';
import { Fab, CircularProgress } from '@mui/material';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import { uploadBoardBackground } from '../../services/storageService';
import { updateBoard } from '../../services/boardService';

type BackgroundImageUploadProps = {
  boardId: string;
};

export function BackgroundImageUpload({ boardId }: BackgroundImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleClick = () => inputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadBoardBackground(boardId, file);
      await updateBoard(boardId, { backgroundImageUrl: url });
    } catch (err) {
      console.error('Failed to upload background:', err);
    } finally {
      setIsUploading(false);
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
        onClick={handleClick}
        disabled={isUploading}
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        aria-label="Upload background image"
      >
        {isUploading ? <CircularProgress size={24} /> : <WallpaperIcon />}
      </Fab>
    </>
  );
}
