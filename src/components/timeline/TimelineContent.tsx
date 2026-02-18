import { useState, useRef, useEffect } from 'react';
import { useTimelineContext } from 'dnd-timeline';
import { Box, Typography } from '@mui/material';
import { TimelineHeader } from './TimelineHeader';
import { TimelineRow } from './TimelineRow';
import { TimelineItem } from './TimelineItem';
import { CurrentTimeLine } from './CurrentTimeLine';
import { SprintOverlays } from './SprintOverlays';
import type { TimelineItem as TimelineItemType } from '../../hooks/useTimelineData';
import type { Task, Label, Sprint } from '../../types/board';

type TimelineContentProps = {
  rows: { id: string; title: string }[];
  items: TimelineItemType[];
  labels: Label[];
  sprints: Sprint[];
  remountKeys: Map<string, number>;
  onEditTask: (task: Task) => void;
  onExpandPast: () => void;
  onExpandFuture: () => void;
};

export const TimelineContent = ({
  rows,
  items,
  labels,
  sprints,
  remountKeys,
  onEditTask,
  onExpandPast,
  onExpandFuture,
}: TimelineContentProps) => {
  const { setTimelineRef, style, range, valueToPixels } = useTimelineContext();
  const dayWidthPixels = valueToPixels(24 * 60 * 60 * 1000);

  // Scroll state for virtualization
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState({
    scrollLeft: 0,
    viewportWidth: 0,
  });

  // Expansion state
  const isExpandingRef = useRef(false);
  const prevScrollWidthRef = useRef(0);
  const prevScrollLeftRef = useRef(0);

  // Handle scroll events
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollLeft, clientWidth, scrollWidth } = container;

      setScrollState({
        scrollLeft,
        viewportWidth: clientWidth,
      });

      // Skip expansion if already expanding
      if (isExpandingRef.current) return;

      // Don't expand if no scrollable content
      if (scrollWidth <= clientWidth) return;

      const threshold = 200;
      const distanceFromLeft = scrollLeft;
      const distanceFromRight = scrollWidth - scrollLeft - clientWidth;

      if (distanceFromLeft < threshold && distanceFromLeft > 0) {
        isExpandingRef.current = true;
        prevScrollWidthRef.current = scrollWidth;
        prevScrollLeftRef.current = scrollLeft;
        onExpandPast();
      } else if (distanceFromRight < threshold) {
        isExpandingRef.current = true;
        onExpandFuture();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      setScrollState({
        scrollLeft: container.scrollLeft,
        viewportWidth: container.clientWidth,
      });
    });

    container.addEventListener('scroll', handleScroll, { passive: true });
    resizeObserver.observe(container);

    // Initial state
    setScrollState({
      scrollLeft: container.scrollLeft,
      viewportWidth: container.clientWidth,
    });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [onExpandPast, onExpandFuture]);

  // Preserve scroll position when range.start changes (left expansion)
  const prevRangeStartRef = useRef(range.start);
  useEffect(() => {
    if (range.start !== prevRangeStartRef.current) {
      prevRangeStartRef.current = range.start;
      const container = scrollContainerRef.current;
      if (container && isExpandingRef.current) {
        requestAnimationFrame(() => {
          const addedWidth = container.scrollWidth - prevScrollWidthRef.current;
          if (addedWidth > 0) {
            container.scrollLeft = prevScrollLeftRef.current + addedWidth;
          }
          isExpandingRef.current = false;
        });
      }
    } else {
      isExpandingRef.current = false;
    }
  }, [range.start]);
  return (
    <Box
      ref={scrollContainerRef}
      sx={{
        flex: 1,
        overflow: 'auto',
        mt: 2,
        mx: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', minWidth: 'fit-content' }}>
        {/* Left sidebar with list names */}
        <Box sx={{ flexShrink: 0, width: '200px' }}>
          {/* Header label cell */}
          <Box
            sx={{
              height: '40px',
              borderBottom: '2px solid',
              borderRight: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              px: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Lists
            </Typography>
          </Box>
          {/* Row label cells */}
          {rows.map((row) => (
            <Box
              key={row.id}
              sx={{
                height: '48px',
                borderBottom: '1px solid',
                borderRight: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                px: 2,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography
                variant="body2"
                fontWeight={500}
                sx={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.title}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Timeline area */}
        <Box
          ref={setTimelineRef}
          sx={{
            ...style,
            flex: 1,
            minWidth: 0,
            position: 'relative',
          }}
        >
          {/* Sprint background bands */}
          <SprintOverlays
            sprints={sprints}
            rowCount={rows.length}
            rowHeight={48}
            headerHeight={40}
          />
          <CurrentTimeLine />
          {/* Header row */}
          <Box
            sx={{
              height: '40px',
              borderBottom: '2px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              position: 'relative',
            }}
          >
            <TimelineHeader
              scrollState={scrollState}
              dayWidthPixels={dayWidthPixels}
            />
          </Box>
          {/* Data rows */}
          {rows.map((row) => {
            const rowItems = items.filter((item) => item.rowId === row.id);
            return (
              <TimelineRow key={row.id} row={row}>
                {rowItems.map((item) => (
                  <TimelineItem
                    key={`${item.id}-${remountKeys.get(item.id) || 0}`}
                    item={item}
                    labels={labels}
                    onClick={() => onEditTask(item.task)}
                  />
                ))}
              </TimelineRow>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};
