import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SprintOverlays } from './SprintOverlays';
import type { Sprint } from '../../types/board';

const mockValueToPixels = vi.fn((v: number) => v / 1000);
let mockRange = { start: 0, end: 0 };

vi.mock('dnd-timeline', () => ({
  useTimelineContext: () => ({
    range: mockRange,
    valueToPixels: mockValueToPixels,
  }),
}));

const createMockSprint = (overrides: Partial<Sprint> = {}): Sprint =>
  ({
    id: 'sprint-1',
    name: 'Sprint 1',
    startDate: {
      toDate: () => new Date('2024-01-01'),
    },
    endDate: {
      toDate: () => new Date('2024-01-14'),
    },
    order: 'a0',
    ...overrides,
  }) as Sprint;

describe('SprintOverlays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no sprints', () => {
    mockRange = { start: 0, end: Date.now() };

    const { container } = render(
      <SprintOverlays
        sprints={[]}
        rowCount={3}
        rowHeight={48}
        headerHeight={40}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no sprints are in range', () => {
    // Range is far in the future
    mockRange = {
      start: new Date('2025-01-01').getTime(),
      end: new Date('2025-02-01').getTime(),
    };

    const sprints = [createMockSprint()]; // 2024-01-01 to 2024-01-14

    const { container } = render(
      <SprintOverlays
        sprints={sprints}
        rowCount={3}
        rowHeight={48}
        headerHeight={40}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders sprint overlay when in range', () => {
    mockRange = {
      start: new Date('2024-01-01').getTime(),
      end: new Date('2024-01-31').getTime(),
    };

    const sprints = [createMockSprint({ name: 'Sprint 1' })];

    render(
      <SprintOverlays
        sprints={sprints}
        rowCount={3}
        rowHeight={48}
        headerHeight={40}
      />,
    );

    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
  });

  it('renders date range label', () => {
    mockRange = {
      start: new Date('2024-01-01').getTime(),
      end: new Date('2024-01-31').getTime(),
    };

    const sprints = [createMockSprint()];

    render(
      <SprintOverlays
        sprints={sprints}
        rowCount={3}
        rowHeight={48}
        headerHeight={40}
      />,
    );

    expect(screen.getByText(/Jan 1/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 14/)).toBeInTheDocument();
  });

  it('renders multiple sprints', () => {
    mockRange = {
      start: new Date('2024-01-01').getTime(),
      end: new Date('2024-02-28').getTime(),
    };

    const sprints = [
      createMockSprint({ id: 's1', name: 'Sprint 1', order: 'a0' }),
      createMockSprint({
        id: 's2',
        name: 'Sprint 2',
        order: 'a1',
        startDate: { toDate: () => new Date('2024-01-15') } as any,
        endDate: { toDate: () => new Date('2024-01-28') } as any,
      }),
    ];

    render(
      <SprintOverlays
        sprints={sprints}
        rowCount={3}
        rowHeight={48}
        headerHeight={40}
      />,
    );

    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    expect(screen.getByText('Sprint 2')).toBeInTheDocument();
  });
});
