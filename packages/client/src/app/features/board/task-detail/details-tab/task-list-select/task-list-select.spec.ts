import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TaskListSelect } from './task-list-select';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoViewPolyfill(): void {};

const lists = [
  { id: 'list-1', title: 'To Do' },
  { id: 'list-2', title: 'Doing' },
  { id: 'list-3', title: 'Done' },
];

describe('TaskListSelect', () => {
  it('renders the current list title on the trigger', async () => {
    await render(TaskListSelect, { inputs: { value: 'list-2', lists } });

    const trigger = screen.getByRole('combobox', { name: 'List' });
    expect(trigger).toHaveTextContent('Doing');
  });

  it('emits listMove when a different option is picked', async () => {
    const user = userEvent.setup();
    const onListMove = vi.fn();
    await render(TaskListSelect, {
      inputs: { value: 'list-1', lists },
      on: { listMove: onListMove },
    });

    await user.click(screen.getByRole('combobox', { name: 'List' }));
    await user.click(await screen.findByRole('option', { name: 'Done' }));

    expect(onListMove).toHaveBeenCalledWith('list-3');
  });

  it('lists every option from the input array', async () => {
    const user = userEvent.setup();
    await render(TaskListSelect, { inputs: { value: 'list-1', lists } });

    await user.click(screen.getByRole('combobox', { name: 'List' }));

    for (const list of lists) {
      expect(await screen.findByRole('option', { name: list.title })).toBeInTheDocument();
    }
  });

  it('ignores a non-string value change and does not emit', async () => {
    const onListMove = vi.fn();
    const { fixture } = await render(TaskListSelect, {
      inputs: { value: 'list-1', lists },
      on: { listMove: onListMove },
    });

    fixture.componentInstance['onValueChange'](null);
    fixture.componentInstance['onValueChange'](undefined);
    fixture.componentInstance['onValueChange']('');

    expect(onListMove).not.toHaveBeenCalled();
  });

  it('renders the trigger as blank when the current value has no matching list', async () => {
    await render(TaskListSelect, { inputs: { value: 'ghost-list', lists } });

    const trigger = screen.getByRole('combobox', { name: 'List' });
    // idToTitle returns '' for the missing id; the value template renders an empty string.
    expect(trigger.textContent?.trim()).toBe('');
  });
});
