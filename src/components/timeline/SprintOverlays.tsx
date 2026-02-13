import { Box, Typography, alpha } from '@mui/material';
import { useTimelineContext } from 'dnd-timeline';
import { format } from 'date-fns';
import type { Sprint } from '../../types/board';
import { compareOrder } from '../../utils/ordering';

type SprintOverlaysProps = {
  sprints: Sprint[];
  rowCount: number;
  rowHeight: number;
  headerHeight: number;
};

// Alternating colors for sprints
const SPRINT_COLORS = [
  '#E3F2FD', // light blue
  '#FFF3E0', // light orange
  '#E8F5E9', // light green
  '#F3E5F5', // light purple
];

export function SprintOverlays({
  sprints,
  rowCount,
  rowHeight,
  headerHeight,
}: SprintOverlaysProps) {
  const { range, valueToPixels } = useTimelineContext();

  // Sort sprints by order
  const sortedSprints = [...sprints].sort((a, b) => compareOrder(a.order, b.order));

  // Filter sprints that are visible in the current range
  const visibleSprints = sortedSprints.filter((sprint) => {
    const sprintStart = sprint.startDate.toDate().getTime();
    const sprintEnd = sprint.endDate.toDate().getTime();
    return sprintEnd >= range.start && sprintStart <= range.end;
  });

  if (visibleSprints.length === 0) {
    return null;
  }

  const totalHeight = headerHeight + rowCount * rowHeight;

  return (
    <>
      {visibleSprints.map((sprint) => {
        const sprintStart = sprint.startDate.toDate().getTime();
        const sprintEnd = sprint.endDate.toDate().getTime();

        // Clamp to visible range
        const visibleStart = Math.max(sprintStart, range.start);
        const visibleEnd = Math.min(sprintEnd, range.end);

        // Calculate position relative to range.start
        const leftOffset = valueToPixels(visibleStart - range.start);
        const width = valueToPixels(visibleEnd - visibleStart);

        // Get color based on original index in sorted array
        const originalIndex = sortedSprints.findIndex((s) => s.id === sprint.id);
        const bgColor = SPRINT_COLORS[originalIndex % SPRINT_COLORS.length];

        // Format dates for label
        const startLabel = format(sprint.startDate.toDate(), 'MMM d');
        const endLabel = format(sprint.endDate.toDate(), 'MMM d');

        return (
          <Box
            key={sprint.id}
            sx={{
              position: 'absolute',
              left: leftOffset,
              top: 0,
              width,
              height: totalHeight,
              backgroundColor: alpha(bgColor, 0.4),
              borderLeft: '2px solid',
              borderRight: '2px solid',
              borderColor: alpha(bgColor, 0.8),
              zIndex: 0,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Sprint label at top */}
            <Box
              sx={{
                position: 'sticky',
                top: 0,
                backgroundColor: alpha(bgColor, 0.9),
                px: 1,
                py: 0.5,
                borderBottom: '1px solid',
                borderColor: alpha(bgColor, 0.8),
                zIndex: 1,
              }}
            >
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {sprint.name}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', fontSize: '10px' }}
              >
                {startLabel} - {endLabel}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </>
  );
}
