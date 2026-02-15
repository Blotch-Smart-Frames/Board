import { useTimelineContext } from 'dnd-timeline';
import { Box, Typography } from '@mui/material';
import {
  startOfDay,
  addDays,
  format,
  differenceInDays,
  isSameDay,
} from 'date-fns';
import { useVisibleDates } from '../../hooks/useVisibleDates';

type ScrollState = {
  scrollLeft: number;
  viewportWidth: number;
};

type TimelineHeaderProps = {
  scrollState: ScrollState;
  dayWidthPixels: number;
};

export function TimelineHeader({
  scrollState,
  dayWidthPixels,
}: TimelineHeaderProps) {
  const { range, valueToPixels } = useTimelineContext();
  const today = startOfDay(new Date());

  // Calculate all days for fallback
  const startDate = startOfDay(new Date(range.start));
  const endDate = startOfDay(new Date(range.end));
  const dayCount = differenceInDays(endDate, startDate) + 1;
  const allDays = Array.from({ length: dayCount }, (_, i) =>
    addDays(startDate, i),
  );

  // Use virtualized dates only when we have valid dimensions
  const virtualizedDays = useVisibleDates({
    rangeStart: range.start,
    rangeEnd: range.end,
    scrollLeft: scrollState.scrollLeft,
    viewportWidth: scrollState.viewportWidth,
    dayWidthPixels,
    buffer: 3,
  });

  // Use virtualization only when we have valid scroll state
  const visibleDays =
    scrollState.viewportWidth > 0 && dayWidthPixels > 0
      ? virtualizedDays
      : allDays;

  return (
    <Box sx={{ position: 'relative', height: '40px', width: '100%' }}>
      {visibleDays.map((day) => {
        const dayStart = day.getTime();
        const dayWidth = valueToPixels(24 * 60 * 60 * 1000);
        const left = valueToPixels(dayStart - range.start);
        const isToday = isSameDay(day, today);

        return (
          <Box
            key={day.toISOString()}
            sx={{
              position: 'absolute',
              left: `${left}px`,
              width: `${Math.max(dayWidth, 1)}px`,
              height: '100%',
              borderRight: '1px solid',
              borderColor: 'divider',
              px: 1,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isToday ? 'primary.light' : 'transparent',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: isToday ? 600 : 400,
                color: isToday ? 'primary.contrastText' : 'text.primary',
                whiteSpace: 'nowrap',
                fontSize: dayWidth < 80 ? '10px' : '12px',
              }}
            >
              {dayWidth < 60 ? format(day, 'd') : format(day, 'EEE, MMM d')}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
