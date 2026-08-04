import { render } from '@testing-library/angular';
import { TimelineRow } from './timeline-row';

describe('TimelineRow', () => {
  it('carries the row id as a data attribute with a fixed 48px height on the host', async () => {
    const { container } = await render(TimelineRow, {
      inputs: { row: { id: 'row-1', title: 'Row 1' } },
    });

    expect(container).toHaveAttribute('data-row-id', 'row-1');
    expect(container).toHaveStyle({ height: '48px' });
  });

  it('projects content passed into it', async () => {
    const { getByText } = await render(
      `<app-timeline-row [row]="{ id: 'row-2', title: 'Row 2' }"><span>Projected content</span></app-timeline-row>`,
      { imports: [TimelineRow] },
    );

    expect(getByText('Projected content')).toBeInTheDocument();
  });
});
