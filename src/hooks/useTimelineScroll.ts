import { useEffect, useRef, useCallback, useState } from 'react';

type ScrollState = {
  scrollLeft: number;
  viewportWidth: number;
  scrollWidth: number;
};

type UseTimelineScrollOptions = {
  threshold?: number;
  onExpandPast: () => void;
  onExpandFuture: () => void;
};

export function useTimelineScroll({
  threshold = 200,
  onExpandPast,
  onExpandFuture,
}: UseTimelineScrollOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isExpandingRef = useRef(false);
  const prevScrollWidthRef = useRef<number>(0);
  const prevScrollLeftRef = useRef<number>(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef(false);

  const [scrollState, setScrollState] = useState<ScrollState>({
    scrollLeft: 0,
    viewportWidth: 0,
    scrollWidth: 0,
  });

  // Refs for callbacks to avoid stale closures
  const onExpandPastRef = useRef(onExpandPast);
  const onExpandFutureRef = useRef(onExpandFuture);
  onExpandPastRef.current = onExpandPast;
  onExpandFutureRef.current = onExpandFuture;

  const updateScrollState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    setScrollState((prev) => {
      const newState = {
        scrollLeft: container.scrollLeft,
        viewportWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
      };

      // Only update if values changed
      if (
        prev.scrollLeft === newState.scrollLeft &&
        prev.viewportWidth === newState.viewportWidth &&
        prev.scrollWidth === newState.scrollWidth
      ) {
        return prev;
      }
      return newState;
    });
  }, []);

  const handleScrollEvent = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Skip updates until initialized to prevent interference with dnd-timeline
    if (!isInitializedRef.current) return;

    updateScrollState();

    // Skip expansion logic if already expanding
    if (isExpandingRef.current) return;

    const { scrollLeft, clientWidth, scrollWidth } = container;

    // Don't expand if there's no scrollable content yet
    if (scrollWidth <= clientWidth) return;

    const distanceFromLeft = scrollLeft;
    const distanceFromRight = scrollWidth - scrollLeft - clientWidth;

    // Only expand left if user has scrolled (not at initial position)
    if (distanceFromLeft < threshold && distanceFromLeft > 0) {
      isExpandingRef.current = true;
      prevScrollWidthRef.current = scrollWidth;
      prevScrollLeftRef.current = scrollLeft;
      onExpandPastRef.current();
    } else if (distanceFromRight < threshold) {
      isExpandingRef.current = true;
      onExpandFutureRef.current();
    }
  }, [threshold, updateScrollState]);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Clean up previous listeners
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      containerRef.current = node;

      if (node) {
        // Set up listeners on the new node
        node.addEventListener('scroll', handleScrollEvent, { passive: true });

        // Track if this is the first resize observation
        let isFirstResize = true;

        const resizeObserver = new ResizeObserver(() => {
          if (isFirstResize) {
            // Skip the first resize event (fires immediately on observe)
            // and delay initialization to let dnd-timeline set up first
            isFirstResize = false;
            setTimeout(() => {
              isInitializedRef.current = true;
              updateScrollState();
            }, 100);
            return;
          }
          updateScrollState();
        });
        resizeObserver.observe(node);

        // Store cleanup function
        cleanupRef.current = () => {
          node.removeEventListener('scroll', handleScrollEvent);
          resizeObserver.disconnect();
        };
      }
    },
    [handleScrollEvent, updateScrollState],
  );

  // Preserve scroll position when prepending dates (left expansion)
  const preserveScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container || !isExpandingRef.current) return;

    requestAnimationFrame(() => {
      const addedWidth = container.scrollWidth - prevScrollWidthRef.current;
      if (addedWidth > 0) {
        container.scrollLeft = prevScrollLeftRef.current + addedWidth;
      }
      isExpandingRef.current = false;
      updateScrollState();
    });
  }, [updateScrollState]);

  // Reset expanding flag after future expansion
  const clearExpandingFlag = useCallback(() => {
    isExpandingRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return {
    setContainerRef,
    scrollState,
    preserveScrollPosition,
    clearExpandingFlag,
  };
}
