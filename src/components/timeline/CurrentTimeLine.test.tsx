import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CurrentTimeLine } from './CurrentTimeLine';

const mockValueToPixels = vi.fn();
let mockRange = { start: 0, end: 0 };

vi.mock('dnd-timeline', () => ({
  useTimelineContext: () => ({
    range: mockRange,
    valueToPixels: mockValueToPixels,
  }),
}));

describe('CurrentTimeLine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when current time is outside range', () => {
    const now = Date.now();
    mockRange = { start: now + 100000, end: now + 200000 };

    const { container } = render(<CurrentTimeLine />);

    expect(container.firstChild).toBeNull();
  });

  it('renders line when current time is within range', () => {
    const now = Date.now();
    mockRange = { start: now - 100000, end: now + 100000 };
    mockValueToPixels.mockReturnValue(500);

    const { container } = render(<CurrentTimeLine />);

    expect(container.firstChild).not.toBeNull();
  });

  it('calls valueToPixels to position the line', () => {
    const now = Date.now();
    mockRange = { start: now - 100000, end: now + 100000 };
    mockValueToPixels.mockReturnValue(250);

    render(<CurrentTimeLine />);

    // valueToPixels should be called to compute the position
    expect(mockValueToPixels).toHaveBeenCalled();
  });
});
