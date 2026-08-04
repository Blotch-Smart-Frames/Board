import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { LabelFilter } from './label-filter';
import type { Label } from '../../../shared/types/board';

// jsdom lacks these; the select's active-descendant key manager and the
// popover overlay touch them as soon as the option list opens.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoViewPolyfill(): void {};

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

  it('opens the dropdown to show an option per label', async () => {
    const user = userEvent.setup();
    const labels = [fakeLabel({ id: 'l1', name: 'Bug' }), fakeLabel({ id: 'l2', name: 'Feature' })];
    await render(LabelFilter, { inputs: { labels } });

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByRole('option', { name: /bug/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /feature/i })).toBeInTheDocument();
  });

  it('emits the label id added to the array when an option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const labels = [fakeLabel({ id: 'l1', name: 'Bug' })];
    await render(LabelFilter, { inputs: { labels }, on: { selectedLabelIdsChange: onChange } });

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /bug/i }));

    expect(onChange).toHaveBeenCalledWith(['l1']);
  });

  it('emits the label id removed from the array when an already-selected option is clicked again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const labels = [fakeLabel({ id: 'l1', name: 'Bug' })];
    await render(LabelFilter, {
      inputs: { labels, selectedLabelIds: ['l1'] },
      on: { selectedLabelIdsChange: onChange },
    });

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /bug/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows the selected label name on the trigger instead of the placeholder', async () => {
    const labels = [fakeLabel({ id: 'l1', name: 'Bug' })];
    await render(LabelFilter, { inputs: { labels, selectedLabelIds: ['l1'] } });

    expect(screen.getByText('Bug')).toBeInTheDocument();
    // hlm-select-placeholder keeps its text in the DOM but marks itself
    // hidden via data-hidden when the select has a value.
    expect(screen.getByText('Filter by label')).toHaveAttribute('data-hidden', '');
  });
});
