import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SprintListItem } from './sprint-list-item';
import type { Sprint } from '../../../../shared/types/board';

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

function fakeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 's1',
    name: 'Sprint 1',
    startDate: ts(new Date(2026, 0, 1)),
    endDate: ts(new Date(2026, 0, 14)),
    order: 'a0',
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    ...overrides,
  };
}

describe('SprintListItem', () => {
  it('renders the sprint name and formatted date range', async () => {
    await render(SprintListItem, {
      inputs: { sprint: fakeSprint({ name: 'Alpha' }) },
    });

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2026 - Jan 14, 2026')).toBeInTheDocument();
  });

  it('emits selectDates when the row body is clicked', async () => {
    const user = userEvent.setup();
    const selectDates = vi.fn();
    await render(SprintListItem, {
      inputs: { sprint: fakeSprint({ name: 'Alpha' }) },
      on: { selectDates },
    });

    await user.click(screen.getByText('Alpha'));

    expect(selectDates).toHaveBeenCalledTimes(1);
  });

  it('emits edit when the pencil button is clicked', async () => {
    const user = userEvent.setup();
    const edit = vi.fn();
    await render(SprintListItem, {
      inputs: { sprint: fakeSprint() },
      on: { edit },
    });

    await user.click(screen.getByRole('button', { name: 'Edit sprint' }));

    expect(edit).toHaveBeenCalledTimes(1);
  });

  it('emits remove when the trash button is clicked', async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    await render(SprintListItem, {
      inputs: { sprint: fakeSprint() },
      on: { remove },
    });

    await user.click(screen.getByRole('button', { name: 'Delete sprint' }));

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('disables the delete button while deleting', async () => {
    await render(SprintListItem, {
      inputs: { sprint: fakeSprint(), deleting: true },
    });

    expect(screen.getByRole('button', { name: 'Delete sprint' })).toBeDisabled();
  });

  it('shows the overlap indicator only when highlighted', async () => {
    const { rerender } = await render(SprintListItem, {
      inputs: { sprint: fakeSprint(), highlighted: false },
    });

    expect(screen.queryByTestId('sprint-overlap-indicator')).not.toBeInTheDocument();

    await rerender({ inputs: { sprint: fakeSprint(), highlighted: true } });

    expect(screen.getByTestId('sprint-overlap-indicator')).toBeInTheDocument();
  });
});
