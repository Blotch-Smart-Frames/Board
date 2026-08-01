import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SprintPicker } from './sprint-picker';
import type { Sprint } from '../../../shared/types/board';

// jsdom lacks these; the select's active-descendant key manager and the
// popover overlay touch them as soon as the option list opens.
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

describe('SprintPicker', () => {
  it('shows "No sprint (Backlog)" plus each sprint by name', async () => {
    const user = userEvent.setup();
    await render(SprintPicker, {
      inputs: { sprints: [fakeSprint({ name: 'Sprint A' })] },
    });

    await user.click(screen.getByRole('combobox', { name: 'Sprint' }));

    expect(
      await screen.findByRole('option', { name: /no sprint \(backlog\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /sprint a/i })).toBeInTheDocument();
  });

  it('emits the selected sprint id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await render(SprintPicker, {
      inputs: { sprints: [fakeSprint({ name: 'Sprint A' })] },
      on: { selectedSprintIdChange: onChange },
    });

    await user.click(screen.getByRole('combobox', { name: 'Sprint' }));
    await user.click(await screen.findByRole('option', { name: /sprint a/i }));

    expect(onChange).toHaveBeenCalledWith('s1');
  });
});
