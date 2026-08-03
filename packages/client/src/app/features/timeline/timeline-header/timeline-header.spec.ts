import { format, startOfDay } from 'date-fns';
import { render, screen } from '@testing-library/angular';
import { TimelineHeader } from './timeline-header';
import { TimelineScaleService, MS_PER_DAY } from '../data/timeline-scale.service';
import { computeVisibleDates } from '../data/timeline-data';

describe('TimelineHeader', () => {
  it('renders one cell per visible day in the range', async () => {
    const scale = new TimelineScaleService();
    scale.range.set({ start: 0, end: 4 * MS_PER_DAY });
    scale.dayWidthPx.set(100);
    const scrollState = { scrollLeft: 0, viewportWidth: 500 };

    const { container } = await render(TimelineHeader, {
      inputs: { scrollState },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });

    const expectedDays = computeVisibleDates({
      rangeStart: 0,
      rangeEnd: 4 * MS_PER_DAY,
      scrollLeft: scrollState.scrollLeft,
      viewportWidth: scrollState.viewportWidth,
      dayWidthPixels: 100,
    });

    expect(container.children).toHaveLength(expectedDays.length);
  });

  it('shows the long date label when dayWidthPx is 60 or more', async () => {
    const scale = new TimelineScaleService();
    const day = startOfDay(new Date());
    scale.range.set({ start: day.getTime(), end: day.getTime() });
    scale.dayWidthPx.set(100);

    await render(TimelineHeader, {
      inputs: { scrollState: { scrollLeft: 0, viewportWidth: 500 } },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });

    expect(screen.getByText(format(day, 'EEE, MMM d'))).toBeInTheDocument();
  });

  it('shows a short numeric day label when dayWidthPx is below 60', async () => {
    const scale = new TimelineScaleService();
    const day = startOfDay(new Date());
    scale.range.set({ start: day.getTime(), end: day.getTime() });
    scale.dayWidthPx.set(30);

    await render(TimelineHeader, {
      inputs: { scrollState: { scrollLeft: 0, viewportWidth: 500 } },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });

    expect(screen.getByText(format(day, 'd'))).toBeInTheDocument();
  });

  it('highlights the cell for today with the bg-primary class', async () => {
    const scale = new TimelineScaleService();
    const today = startOfDay(new Date());
    scale.range.set({
      start: today.getTime() - 2 * MS_PER_DAY,
      end: today.getTime() + 2 * MS_PER_DAY,
    });
    scale.dayWidthPx.set(100);

    await render(TimelineHeader, {
      inputs: { scrollState: { scrollLeft: 0, viewportWidth: 1000 } },
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });

    const label = screen.getByText(format(today, 'EEE, MMM d'));
    expect(label.closest('div')).toHaveClass('bg-primary');
  });
});
