import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SprintPicker } from './sprint-picker';
import { SprintService } from '../../../core/services/sprint.service';
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

function setup() {
  const sprintService = {
    createSprint: vi.fn().mockResolvedValue({}),
    calculateNextSprintDates: vi.fn().mockResolvedValue({
      startDate: new Date(2026, 1, 1),
      endDate: new Date(2026, 1, 14),
      suggestedName: 'Sprint 2',
    }),
  };
  return { sprintService, providers: [{ provide: SprintService, useValue: sprintService }] };
}

describe('SprintPicker', () => {
  it('shows "No sprint (Backlog)" plus each sprint by name', async () => {
    const user = userEvent.setup();
    const { providers } = setup();
    await render(SprintPicker, {
      inputs: { boardId: 'board-1', sprints: [fakeSprint({ name: 'Sprint A' })] },
      providers,
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
    const { providers } = setup();
    await render(SprintPicker, {
      inputs: { boardId: 'board-1', sprints: [fakeSprint({ name: 'Sprint A' })] },
      providers,
      on: { selectedSprintIdChange: onChange },
    });

    await user.click(screen.getByRole('combobox', { name: 'Sprint' }));
    await user.click(await screen.findByRole('option', { name: /sprint a/i }));

    expect(onChange).toHaveBeenCalledWith('s1');
  });

  it('opens the nested create-sprint dialog', async () => {
    const user = userEvent.setup();
    const { providers } = setup();
    await render(SprintPicker, { inputs: { boardId: 'board-1', sprints: [] }, providers });

    await user.click(screen.getByRole('button', { name: /create sprint/i }));

    expect(await screen.findByRole('heading', { name: /create sprint/i })).toBeInTheDocument();
  });
});
