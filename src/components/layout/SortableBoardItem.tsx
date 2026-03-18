import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
} from '@mui/material';
import {
  Dashboard as BoardIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import type { Board } from '../../types/board';

type SortableBoardItemProps = {
  board: Board;
  isSelected: boolean;
  onSelect: (boardId: string) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, boardId: string) => void;
};

export const SortableBoardItem = ({
  board,
  isSelected,
  onSelect,
  onMenuOpen,
}: SortableBoardItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: board.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      disablePadding
      secondaryAction={
        <IconButton
          edge="end"
          size="small"
          onClick={(e) => onMenuOpen(e, board.id)}
        >
          <MoreIcon fontSize="small" />
        </IconButton>
      }
    >
      <ListItemButton selected={isSelected} onClick={() => onSelect(board.id)}>
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
  );
};
