import { render, screen } from '@testing-library/angular';
import { MetricCard } from './metric-card';

describe('MetricCard', () => {
  it('shows the label and value', async () => {
    await render(MetricCard, {
      inputs: { label: 'Open', value: 42, icon: 'lucideCircleDot' },
    });

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders the hint when provided', async () => {
    await render(MetricCard, {
      inputs: {
        label: 'Total',
        value: 10,
        icon: 'lucideTicket',
        hint: '3 still open',
      },
    });

    expect(screen.getByText('3 still open')).toBeInTheDocument();
  });

  it('omits the hint when it is null', async () => {
    const view = await render(MetricCard, {
      inputs: { label: 'Total', value: 10, icon: 'lucideTicket' },
    });

    // Only the label and value should be present as text — no extra <p> hint.
    expect(view.container.querySelectorAll('p')).toHaveLength(2);
  });

  it('accepts a string value alongside a number', async () => {
    await render(MetricCard, {
      inputs: { label: 'Status', value: 'On track', icon: 'lucideActivity' },
    });

    expect(screen.getByText('On track')).toBeInTheDocument();
  });

  it('applies the requested tone class to the icon container', async () => {
    const { container, rerender } = await render(MetricCard, {
      inputs: {
        label: 'Urgent',
        value: 3,
        icon: 'lucideFlame',
        tone: 'destructive',
      },
    });
    expect(container.querySelector('span.bg-destructive\\/10')).toBeTruthy();

    await rerender({
      inputs: {
        label: 'Answered',
        value: 5,
        icon: 'lucideCircleCheckBig',
        tone: 'success',
      },
    });
    expect(container.querySelector('span.bg-emerald-500\\/10')).toBeTruthy();
  });
});
