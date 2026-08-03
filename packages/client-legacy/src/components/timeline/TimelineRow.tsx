import { useRow } from 'dnd-timeline';
import { Box } from '@mui/material';
import type { TimelineRow as TimelineRowType } from '../../hooks/useTimelineData';

type TimelineRowProps = {
  row: TimelineRowType;
  children: React.ReactNode;
};

export const TimelineRow = ({ row, children }: TimelineRowProps) => {
  const { setNodeRef, rowWrapperStyle, rowStyle } = useRow({
    id: row.id,
    data: { type: 'timeline-row', listId: row.id },
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        ...rowWrapperStyle,
        height: '48px',
        borderBottom: '1px solid',
        borderColor: 'divider',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          ...rowStyle,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
