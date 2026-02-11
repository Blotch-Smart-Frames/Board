import { useRef } from 'react';
import { useItem } from 'dnd-timeline';
import { Box, Typography, useTheme } from '@mui/material';
import type { TimelineItem as TimelineItemType } from '../../hooks/useTimelineData';
import type { Label } from '../../types/board';

type TimelineItemProps = {
  item: TimelineItemType;
  labels: Label[];
  onClick?: () => void;
};

const DRAG_THRESHOLD = 5;

export function TimelineItem({ item, labels, onClick }: TimelineItemProps) {
  const theme = useTheme();
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle } =
    useItem({
      id: item.id,
      span: item.span,
      data: { type: 'timeline-item', task: item.task },
      resizeHandleWidth: 10,
    });

  const taskLabels = labels.filter((label) =>
    item.task.labelIds?.includes(label.id),
  );
  const primaryColor =
    taskLabels.length > 0 ? taskLabels[0].color : theme.palette.primary.main;

  const handlePointerDown = (e: React.PointerEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    listeners?.onPointerDown?.(e);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!mouseDownPos.current) return;

    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);

    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
      onClick?.();
    }
    mouseDownPos.current = null;
  };

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      sx={{
        ...itemStyle,
        position: 'absolute',
        height: '36px',
        cursor: 'pointer',
        '&:hover': {
          filter: 'brightness(0.95)',
        },
      }}
    >
      <Box
        sx={{
          ...itemContentStyle,
          height: '100%',
          backgroundColor: primaryColor,
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          px: 1,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: 'white',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.task.title}
        </Typography>
      </Box>
    </Box>
  );
}
