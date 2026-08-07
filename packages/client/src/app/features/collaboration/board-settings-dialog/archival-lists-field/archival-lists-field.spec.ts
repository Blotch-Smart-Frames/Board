import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ArchivalListsField } from './archival-lists-field';
import type { List } from '../../../../shared/types/board';

// jsdom lacks these; the select's active-descendant key manager and the
// popover overlay touch them as soon as the option list opens.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoViewPolyfill(): void {};

function fakeList(overrides: Partial<List> = {}): List {
  return {
    id: 'l1',
    title: 'To Do',
    order: 'a0',
    createdAt: {} as Timestamp,
    ...overrides,
  };
}

describe('ArchivalListsField', () => {
  it('shows the placeholder when nothing is selected', async () => {
    await render(ArchivalListsField, { inputs: { lists: [fakeList()] } });

    expect(screen.getByText(/select lists that archive tasks/i)).toBeInTheDocument();
  });

  it('opens the dropdown to show an option per list, sorted by order', async () => {
    const user = userEvent.setup();
    const lists = [
      fakeList({ id: 'l2', title: 'Done', order: 'a1' }),
      fakeList({ id: 'l1', title: 'To Do', order: 'a0' }),
    ];
    await render(ArchivalListsField, { inputs: { lists } });

    await user.click(screen.getByRole('combobox'));

    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent?.trim())).toEqual(['To Do', 'Done']);
  });

  it('emits the list id added to the array when an option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const lists = [fakeList({ id: 'l1', title: 'To Do' })];
    await render(ArchivalListsField, {
      inputs: { lists },
      on: { selectedListIdsChange: onChange },
    });

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /to do/i }));

    expect(onChange).toHaveBeenCalledWith(['l1']);
  });

  it('shows the selected list title as a chip on the trigger', async () => {
    const lists = [fakeList({ id: 'l1', title: 'Done' })];
    await render(ArchivalListsField, { inputs: { lists, selectedListIds: ['l1'] } });

    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('shows a "No lists yet" hint when the board has no lists', async () => {
    const user = userEvent.setup();
    await render(ArchivalListsField, { inputs: { lists: [] } });

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText(/no lists yet/i)).toBeInTheDocument();
  });

  it('ignores non-array values dispatched to onValueChange (defensive fallback)', async () => {
    const onChange = vi.fn();
    const { fixture } = await render(ArchivalListsField, {
      inputs: { lists: [fakeList()] },
      on: { selectedListIdsChange: onChange },
    });

    fixture.componentInstance['onValueChange']('single-value');

    expect(onChange).not.toHaveBeenCalled();
  });
});
