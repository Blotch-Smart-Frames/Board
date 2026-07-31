import type { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { render, screen } from '@testing-library/angular';
import { SprintOverlays } from './sprint-overlays';
import { TimelineScaleService, MS_PER_DAY } from '../data/timeline-scale.service';
import type { Sprint } from '../../../shared/types/board';

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

function fakeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 's1',
    name: 'Sprint 1',
    startDate: ts(new Date(0)),
    endDate: ts(new Date(MS_PER_DAY)),
    order: 'a0',
    createdAt: ts(new Date(0)),
    updatedAt: ts(new Date(0)),
    ...overrides,
  };
}

function fakeScale(): TimelineScaleService {
  const scale = new TimelineScaleService();
  scale.dayWidthPx.set(100);
  scale.range.set({ start: 0, end: 30 * MS_PER_DAY });
  return scale;
}

describe('SprintOverlays', () => {
  it('renders nothing when there are no sprints', async () => {
    const { container } = await render(SprintOverlays, {
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a band with the sprint name and date range for a sprint overlapping the range', async () => {
    const startDate = new Date(5 * MS_PER_DAY);
    const endDate = new Date(10 * MS_PER_DAY);
    const sprint = fakeSprint({
      name: 'Sprint Overlap',
      startDate: ts(startDate),
      endDate: ts(endDate),
    });

    await render(SprintOverlays, {
      inputs: { sprints: [sprint], rowCount: 2 },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
    });

    expect(screen.getByText('Sprint Overlap')).toBeInTheDocument();
    expect(
      screen.getByText(`${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`),
    ).toBeInTheDocument();
  });

  it('does not render a band for a sprint entirely outside the range', async () => {
    const sprint = fakeSprint({
      name: 'Sprint Outside',
      startDate: ts(new Date(-20 * MS_PER_DAY)),
      endDate: ts(new Date(-10 * MS_PER_DAY)),
    });

    await render(SprintOverlays, {
      inputs: { sprints: [sprint] },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
    });

    expect(screen.queryByText('Sprint Outside')).not.toBeInTheDocument();
  });

  it('renders multiple sprints sorted by order, regardless of input array order', async () => {
    const sprintAlpha = fakeSprint({
      id: 's-alpha',
      name: 'Sprint Alpha',
      order: 'a1',
      startDate: ts(new Date(2 * MS_PER_DAY)),
      endDate: ts(new Date(5 * MS_PER_DAY)),
    });
    const sprintBeta = fakeSprint({
      id: 's-beta',
      name: 'Sprint Beta',
      order: 'a0',
      startDate: ts(new Date(8 * MS_PER_DAY)),
      endDate: ts(new Date(10 * MS_PER_DAY)),
    });

    await render(SprintOverlays, {
      inputs: { sprints: [sprintAlpha, sprintBeta], rowCount: 1 },
      providers: [{ provide: TimelineScaleService, useValue: fakeScale() }],
    });

    const names = screen.getAllByText(/^Sprint (Alpha|Beta)$/).map((el) => el.textContent);
    expect(names).toEqual(['Sprint Beta', 'Sprint Alpha']);
  });
});
