import { render } from '@testing-library/angular';
import { CurrentTimeLine } from './current-time-line';
import { TimelineScaleService } from '../data/timeline-scale.service';

describe('CurrentTimeLine', () => {
  it('renders nothing when now falls outside the range', async () => {
    const scale = new TimelineScaleService();
    scale.range.set({ start: 0, end: 1000 });

    const { container } = await render(CurrentTimeLine, {
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it('renders a positioned line when now falls within the range', async () => {
    const scale = new TimelineScaleService();
    const start = Date.now() - 86_400_000;
    const end = Date.now() + 86_400_000;
    scale.range.set({ start, end });
    scale.dayWidthPx.set(100);

    const { container } = await render(CurrentTimeLine, {
      providers: [{ provide: TimelineScaleService, useValue: scale }],
    });

    const line = container.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(line).toBeInTheDocument();

    const left = parseFloat(line!.style.left);
    expect(Number.isFinite(left)).toBe(true);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThan(scale.valueToPixels(end - start));
  });

  it('re-samples the current time on the interval tick', async () => {
    vi.useFakeTimers();
    try {
      const initialNow = new Date(2026, 0, 1, 12, 0, 0).getTime();
      vi.setSystemTime(initialNow);

      const scale = new TimelineScaleService();
      scale.range.set({ start: initialNow - 86_400_000, end: initialNow + 86_400_000 });
      scale.dayWidthPx.set(100);

      const { container, fixture } = await render(CurrentTimeLine, {
        providers: [{ provide: TimelineScaleService, useValue: scale }],
      });

      const initialLeft = parseFloat(
        (container.querySelector('[aria-hidden="true"]') as HTMLElement).style.left,
      );

      // Advance time by one interval — the map callback should re-emit a fresh Date.now().
      vi.setSystemTime(initialNow + 3 * 60_000);
      vi.advanceTimersByTime(60_001);
      fixture.detectChanges();

      const updatedLeft = parseFloat(
        (container.querySelector('[aria-hidden="true"]') as HTMLElement).style.left,
      );
      expect(updatedLeft).toBeGreaterThan(initialLeft);
    } finally {
      vi.useRealTimers();
    }
  });
});
