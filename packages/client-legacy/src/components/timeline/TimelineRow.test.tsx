import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TimelineRow } from './TimelineRow';
import type { TimelineRow as TimelineRowType } from '../../hooks/useTimelineData';

vi.mock('dnd-timeline', () => ({
  useRow: () => ({
    setNodeRef: vi.fn(),
    rowWrapperStyle: {},
    rowStyle: {},
  }),
}));

describe('TimelineRow', () => {
  const mockRow: TimelineRowType = {
    id: 'list-1',
    title: 'To Do',
  };

  it('renders children', () => {
    render(
      <TimelineRow row={mockRow}>
        <div>Task Item</div>
      </TimelineRow>,
    );

    expect(screen.getByText('Task Item')).toBeInTheDocument();
  });

  it('renders row container', () => {
    const { container } = render(
      <TimelineRow row={mockRow}>
        <div>Content</div>
      </TimelineRow>,
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders multiple children', () => {
    render(
      <TimelineRow row={mockRow}>
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </TimelineRow>,
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });
});
