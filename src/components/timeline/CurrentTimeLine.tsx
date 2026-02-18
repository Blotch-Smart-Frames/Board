import { useState, useEffect } from 'react';
import { useTimelineContext } from 'dnd-timeline';
import { Box } from '@mui/material';

export const CurrentTimeLine = () => {
  const { range, valueToPixels } = useTimelineContext();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const isInRange = now >= range.start && now <= range.end;
  if (!isInRange) return null;

  const left = valueToPixels(now - range.start);

  return (
    <Box
      sx={{
        position: 'absolute',
        left: `${left}px`,
        top: 0,
        bottom: 0,
        width: '2px',
        backgroundColor: 'error.main',
        zIndex: 10,
        pointerEvents: 'none',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '-4px',
          width: '10px',
          height: '10px',
          backgroundColor: 'error.main',
          borderRadius: '50%',
        },
      }}
    />
  );
};
