import { render, screen } from '@testing-library/angular';
import { TimelineSidebar } from './timeline-sidebar';
import type { TimelineRow } from '../../data/timeline-data';

const HEADER_HEIGHT_PX = 40;
const ROW_HEIGHT_PX = 48;
const WIDTH_PX = 200;

function rows(...names: string[]): TimelineRow[] {
  return names.map((title, i) => ({ id: `list-${i}`, title }));
}

describe('TimelineSidebar', () => {
  it('renders the "Lists" header', async () => {
    await render(TimelineSidebar, {
      inputs: {
        rows: rows(),
        widthPx: WIDTH_PX,
        headerHeightPx: HEADER_HEIGHT_PX,
        rowHeightPx: ROW_HEIGHT_PX,
      },
    });

    expect(screen.getByText('Lists')).toBeInTheDocument();
  });

  it('renders one cell per row with its title', async () => {
    await render(TimelineSidebar, {
      inputs: {
        rows: rows('To Do', 'Doing', 'Done'),
        widthPx: WIDTH_PX,
        headerHeightPx: HEADER_HEIGHT_PX,
        rowHeightPx: ROW_HEIGHT_PX,
      },
    });

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Doing')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('applies widthPx to the outer column', async () => {
    const view = await render(TimelineSidebar, {
      inputs: {
        rows: rows('To Do'),
        widthPx: 250,
        headerHeightPx: HEADER_HEIGHT_PX,
        rowHeightPx: ROW_HEIGHT_PX,
      },
    });

    const column = view.container.firstElementChild as HTMLElement;
    expect(column.style.width).toBe('250px');
  });

  it('applies headerHeightPx to the header cell and rowHeightPx to each row cell', async () => {
    const view = await render(TimelineSidebar, {
      inputs: {
        rows: rows('To Do', 'Doing'),
        widthPx: WIDTH_PX,
        headerHeightPx: 48,
        rowHeightPx: 60,
      },
    });

    const header = screen.getByText('Lists').closest('div') as HTMLElement;
    expect(header.style.height).toBe('48px');

    const rowCells = Array.from(view.container.querySelectorAll<HTMLElement>('.border-b')).filter(
      (cell) => cell !== header,
    );
    expect(rowCells).toHaveLength(2);
    for (const cell of rowCells) {
      expect(cell.style.height).toBe('60px');
    }
  });

  it('renders no row cells when rows is empty', async () => {
    const view = await render(TimelineSidebar, {
      inputs: {
        rows: rows(),
        widthPx: WIDTH_PX,
        headerHeightPx: HEADER_HEIGHT_PX,
        rowHeightPx: ROW_HEIGHT_PX,
      },
    });

    const column = view.container.firstElementChild as HTMLElement;
    // Only the header remains — no row divs.
    expect(column.children).toHaveLength(1);
  });
});
