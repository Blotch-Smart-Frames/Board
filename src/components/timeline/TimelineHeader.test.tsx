import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelineHeader } from './TimelineHeader';

const mockValueToPixels = vi.fn((v: number) => v / (1000 * 60 * 60));
let mockRange = { start: 0, end: 0 };

vi.mock('dnd-timeline', () => ({
  useTimelineContext: () => ({
    range: mockRange,
    valueToPixels: mockValueToPixels,
  }),
}));

describe('TimelineHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders day cells for the range', () => {
    const start = new Date('2024-06-01').getTime();
    const end = new Date('2024-06-03').getTime();
    mockRange = { start, end };

    const { container } = render(
      <TimelineHeader
        scrollState={{ scrollLeft: 0, viewportWidth: 0 }}
        dayWidthPixels={0}
      />,
    );

    // Should render some day cells
    const dayCells = container.querySelectorAll('[class*="MuiBox-root"]');
    expect(dayCells.length).toBeGreaterThan(0);
  });

  it('renders with valid scroll state for virtualization', () => {
    const start = new Date('2024-06-01').getTime();
    const end = new Date('2024-06-30').getTime();
    mockRange = { start, end };
    mockValueToPixels.mockReturnValue(80); // 80px per day

    const { container } = render(
      <TimelineHeader
        scrollState={{ scrollLeft: 0, viewportWidth: 800 }}
        dayWidthPixels={80}
      />,
    );

    // Should render a subset of days with virtualization
    const boxes = container.querySelectorAll('[class*="MuiTypography"]');
    expect(boxes.length).toBeGreaterThan(0);
  });
});
