import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { LabelFilter } from './label-filter';
import type { Label } from '../../../shared/types/board';

function fakeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: 'l1',
    name: 'Bug',
    color: '#EF4444',
    order: 'a0',
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

describe('LabelFilter', () => {
  it('shows the placeholder when nothing is selected', async () => {
    await render(LabelFilter, { inputs: { labels: [fakeLabel()] } });

    expect(screen.getByText('Filter by label')).toBeInTheDocument();
  });

  it('opens the popover to show a row per label', async () => {
    const user = userEvent.setup();
    const labels = [fakeLabel({ id: 'l1', name: 'Bug' }), fakeLabel({ id: 'l2', name: 'Feature' })];
    await render(LabelFilter, { inputs: { labels } });

    await user.click(screen.getByRole('button', { name: /filter by label/i }));

    expect(await screen.findByText('Bug')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('emits the label id added to the array when a row is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const labels = [fakeLabel({ id: 'l1', name: 'Bug' })];
    await render(LabelFilter, { inputs: { labels }, on: { selectedLabelIdsChange: onChange } });

    await user.click(screen.getByRole('button', { name: /filter by label/i }));
    await user.click(await screen.findByRole('button', { name: /toggle label bug/i }));

    expect(onChange).toHaveBeenCalledWith(['l1']);
  });

  it('emits the label id removed from the array when an already-selected row is clicked again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const labels = [fakeLabel({ id: 'l1', name: 'Bug' })];
    await render(LabelFilter, {
      inputs: { labels, selectedLabelIds: ['l1'] },
      on: { selectedLabelIdsChange: onChange },
    });

    // Only the trigger button exists before the popover opens.
    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByRole('button', { name: /toggle label bug/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows the selected label name on the trigger instead of the placeholder', async () => {
    const labels = [fakeLabel({ id: 'l1', name: 'Bug' })];
    await render(LabelFilter, { inputs: { labels, selectedLabelIds: ['l1'] } });

    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.queryByText('Filter by label')).not.toBeInTheDocument();
  });
});
