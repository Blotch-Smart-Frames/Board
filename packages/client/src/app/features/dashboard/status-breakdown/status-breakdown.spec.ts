import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { DashboardStore, type StatusBreakdownRow } from '../data/dashboard.store';
import { StatusBreakdown } from './status-breakdown';

function setup(rows: StatusBreakdownRow[]) {
  const store = { statusBreakdown: signal(rows) };
  return {
    providers: [{ provide: DashboardStore, useValue: store }],
  };
}

describe('StatusBreakdown', () => {
  it('shows an empty-state message when there are no rows', async () => {
    const { providers } = setup([]);
    await render(StatusBreakdown, { providers });

    expect(screen.getByText(/no tickets on any of your boards yet/i)).toBeInTheDocument();
  });

  it('renders one row per status with counts and title', async () => {
    const { providers } = setup([
      { title: 'To Do', mine: 2, total: 8, share: 25 },
      { title: 'Done', mine: 1, total: 4, share: 25 },
    ]);
    await render(StatusBreakdown, { providers });

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('/ 8')).toBeInTheDocument();
    expect(screen.getByText('/ 4')).toBeInTheDocument();
  });

  it('sets the bar width to the row share percentage', async () => {
    const { providers } = setup([{ title: 'In Progress', mine: 3, total: 4, share: 75 }]);
    await render(StatusBreakdown, { providers });

    const bar = screen.getByLabelText('3 of 4 assigned to you') as HTMLElement;
    expect(bar.style.width).toBe('75%');
  });
});
