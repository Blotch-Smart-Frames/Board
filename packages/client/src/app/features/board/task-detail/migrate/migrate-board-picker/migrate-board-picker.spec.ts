import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MigrateBoardPicker } from './migrate-board-picker';
import type { BoardWithOrder } from '../../../../boards/data/user-boards.store';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoViewPolyfill(): void {};

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

function fakeBoard(id: string, title: string): BoardWithOrder {
  return {
    id,
    title,
    ownerId: 'u1',
    collaborators: [],
    createdAt: ts(new Date()),
    updatedAt: ts(new Date()),
  };
}

describe('MigrateBoardPicker', () => {
  it('shows the empty-state hint when no boards are available', async () => {
    await render(MigrateBoardPicker, { inputs: { boards: [] } });

    expect(screen.getByText(/at least one other board/i)).toBeInTheDocument();
  });

  it('shows the placeholder on the trigger before anything is selected', async () => {
    await render(MigrateBoardPicker, {
      inputs: { boards: [fakeBoard('b1', 'First')] },
    });

    expect(screen.getByRole('combobox', { name: 'Target board' })).toHaveTextContent(
      /select a board/i,
    );
  });

  it('shows the selected board title on the trigger', async () => {
    await render(MigrateBoardPicker, {
      inputs: { boards: [fakeBoard('b1', 'Alpha'), fakeBoard('b2', 'Beta')], value: 'b2' },
    });

    expect(screen.getByRole('combobox', { name: 'Target board' })).toHaveTextContent('Beta');
  });

  it('lists each board as an option when opened', async () => {
    const user = userEvent.setup();
    await render(MigrateBoardPicker, {
      inputs: { boards: [fakeBoard('b1', 'Alpha'), fakeBoard('b2', 'Beta')] },
    });

    await user.click(screen.getByRole('combobox', { name: 'Target board' }));

    expect(await screen.findByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
  });

  it('emits valueChange with the picked board id', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    await render(MigrateBoardPicker, {
      inputs: { boards: [fakeBoard('b1', 'Alpha'), fakeBoard('b2', 'Beta')] },
      on: { valueChange: onValueChange },
    });

    await user.click(screen.getByRole('combobox', { name: 'Target board' }));
    await user.click(await screen.findByRole('option', { name: 'Beta' }));

    expect(onValueChange).toHaveBeenCalledWith('b2');
  });
});
