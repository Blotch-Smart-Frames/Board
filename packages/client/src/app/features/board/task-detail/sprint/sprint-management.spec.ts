import type { Provider } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SprintService } from '../../../../core/services/sprint.service';
import { SprintManagement } from './sprint-management';
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

type SprintServiceStub = {
  createSprint: ReturnType<typeof vi.fn>;
  updateSprint: ReturnType<typeof vi.fn>;
  deleteSprint: ReturnType<typeof vi.fn>;
  updateSprintConfig: ReturnType<typeof vi.fn>;
  calculateNextSprintDates: ReturnType<typeof vi.fn>;
};

function setup(overrides: Partial<SprintServiceStub> = {}): {
  sprintService: SprintServiceStub;
  providers: Provider[];
} {
  const sprintService: SprintServiceStub = {
    createSprint: overrides.createSprint ?? vi.fn().mockResolvedValue({}),
    updateSprint: overrides.updateSprint ?? vi.fn().mockResolvedValue(undefined),
    deleteSprint: overrides.deleteSprint ?? vi.fn().mockResolvedValue(undefined),
    updateSprintConfig: overrides.updateSprintConfig ?? vi.fn().mockResolvedValue(undefined),
    calculateNextSprintDates:
      overrides.calculateNextSprintDates ??
      vi.fn().mockResolvedValue({
        startDate: new Date(2026, 1, 1),
        endDate: new Date(2026, 1, 14),
        suggestedName: 'Sprint 2',
      }),
  };
  return {
    sprintService,
    providers: [{ provide: SprintService, useValue: sprintService }],
  };
}

describe('SprintManagement', () => {
  it('renders "No sprints created yet" when the list is empty', async () => {
    const { providers } = setup();
    await render(SprintManagement, {
      providers,
      inputs: { boardId: 'board-1' },
    });

    expect(screen.getByText('No sprints created yet')).toBeInTheDocument();
  });

  it('lists sprints sorted by order', async () => {
    const { providers } = setup();
    await render(SprintManagement, {
      providers,
      inputs: {
        boardId: 'board-1',
        sprints: [
          fakeSprint({ id: 's2', name: 'Sprint B', order: 'a1' }),
          fakeSprint({ id: 's1', name: 'Sprint A', order: 'a0' }),
        ],
      },
    });

    const names = screen.getAllByText(/Sprint [AB]/).map((el) => el.textContent);
    expect(names).toEqual(['Sprint A', 'Sprint B']);
  });

  it('opens the sprint dialog in edit mode and saves updates through updateSprint', async () => {
    const user = userEvent.setup();
    const { providers, sprintService } = setup();
    await render(SprintManagement, {
      providers,
      inputs: {
        boardId: 'board-1',
        sprints: [fakeSprint({ name: 'Sprint A' })],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Edit sprint' }));
    const editDialog = await screen.findByRole('dialog', { name: /edit sprint/i });
    const name = within(editDialog).getByLabelText('Sprint Name');
    await user.clear(name);
    await user.type(name, 'Sprint A renamed');
    await user.click(within(editDialog).getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(sprintService.updateSprint).toHaveBeenCalledWith(
        'board-1',
        's1',
        expect.objectContaining({ name: 'Sprint A renamed' }),
      ),
    );
  });

  it('shows an error when the delete operation itself fails', async () => {
    const user = userEvent.setup();
    const { providers, sprintService } = setup({
      deleteSprint: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    await render(SprintManagement, {
      providers,
      inputs: {
        boardId: 'board-1',
        sprints: [fakeSprint()],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Delete sprint' }));

    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
    expect(sprintService.deleteSprint).toHaveBeenCalledWith('board-1', 's1');
  });

  it('falls back to a generic delete error message when the service rejects with a non-Error value', async () => {
    const user = userEvent.setup();
    const { providers } = setup({
      deleteSprint: vi.fn().mockRejectedValue('kaboom'),
    });
    await render(SprintManagement, {
      providers,
      inputs: { boardId: 'board-1', sprints: [fakeSprint()] },
    });

    await user.click(screen.getByRole('button', { name: 'Delete sprint' }));

    expect(await screen.findByText(/failed to delete sprint/i)).toBeInTheDocument();
  });

  it('deletes a sprint through the service when no tasks are assigned', async () => {
    const user = userEvent.setup();
    const { providers, sprintService } = setup();
    await render(SprintManagement, {
      providers,
      inputs: {
        boardId: 'board-1',
        sprints: [fakeSprint()],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Delete sprint' }));

    await waitFor(() => expect(sprintService.deleteSprint).toHaveBeenCalledWith('board-1', 's1'));
  });

  it('opens the sprint dialog in create mode and calls createSprint on save', async () => {
    const user = userEvent.setup();
    const { providers, sprintService } = setup();
    await render(SprintManagement, {
      providers,
      inputs: { boardId: 'board-1' },
    });

    await user.click(screen.getByRole('button', { name: /create sprint/i }));
    const createDialog = await screen.findByRole('dialog', { name: /create sprint/i });
    await user.click(within(createDialog).getByRole('button', { name: /^create$/i }));

    await waitFor(() =>
      expect(sprintService.createSprint).toHaveBeenCalledWith(
        'board-1',
        expect.objectContaining({ name: 'Sprint 2' }),
      ),
    );
  });

  describe('sprint overlap highlighting', () => {
    const sprintA = fakeSprint({
      id: 's-a',
      name: 'Sprint A',
      order: 'a0',
      startDate: ts(new Date(2026, 0, 1)),
      endDate: ts(new Date(2026, 0, 14)),
    });
    const sprintB = fakeSprint({
      id: 's-b',
      name: 'Sprint B',
      order: 'a1',
      startDate: ts(new Date(2026, 0, 15)),
      endDate: ts(new Date(2026, 0, 28)),
    });
    const sprintC = fakeSprint({
      id: 's-c',
      name: 'Sprint C',
      order: 'a2',
      startDate: ts(new Date(2026, 1, 1)),
      endDate: ts(new Date(2026, 1, 14)),
    });

    it('shows no overlap indicators when no dates are selected', async () => {
      const { providers } = setup();
      await render(SprintManagement, {
        providers,
        inputs: {
          boardId: 'board-1',
          sprints: [sprintA, sprintB, sprintC],
        },
      });

      expect(screen.queryAllByTestId('sprint-overlap-indicator')).toHaveLength(0);
    });

    it('highlights only sprints whose range intersects the selected date range', async () => {
      const { providers } = setup();
      await render(SprintManagement, {
        providers,
        inputs: {
          boardId: 'board-1',
          sprints: [sprintA, sprintB, sprintC],
          selectedStartDate: new Date(2026, 0, 10),
          selectedEndDate: new Date(2026, 0, 20),
        },
      });

      const highlightedNames = screen
        .getAllByTestId('sprint-overlap-indicator')
        .map((el) => el.closest('div')?.textContent?.trim());
      expect(highlightedNames).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Sprint A'),
          expect.stringContaining('Sprint B'),
        ]),
      );
      expect(highlightedNames).toHaveLength(2);
    });

    it('highlights a sprint when only a start date is selected and it falls within the sprint', async () => {
      const { providers } = setup();
      await render(SprintManagement, {
        providers,
        inputs: {
          boardId: 'board-1',
          sprints: [sprintA, sprintB],
          selectedStartDate: new Date(2026, 0, 5),
        },
      });

      const indicators = screen.getAllByTestId('sprint-overlap-indicator');
      expect(indicators).toHaveLength(1);
      expect(indicators[0].closest('div')?.textContent).toContain('Sprint A');
    });

    it('highlights a sprint when only an end date is selected and it falls within the sprint', async () => {
      const { providers } = setup();
      await render(SprintManagement, {
        providers,
        inputs: {
          boardId: 'board-1',
          sprints: [sprintA, sprintB],
          selectedEndDate: new Date(2026, 0, 20),
        },
      });

      const indicators = screen.getAllByTestId('sprint-overlap-indicator');
      expect(indicators).toHaveLength(1);
      expect(indicators[0].closest('div')?.textContent).toContain('Sprint B');
    });

    it('does not highlight sprints when the selected range falls entirely outside every sprint', async () => {
      const { providers } = setup();
      await render(SprintManagement, {
        providers,
        inputs: {
          boardId: 'board-1',
          sprints: [sprintA, sprintB],
          selectedStartDate: new Date(2026, 5, 1),
          selectedEndDate: new Date(2026, 5, 10),
        },
      });

      expect(screen.queryAllByTestId('sprint-overlap-indicator')).toHaveLength(0);
    });
  });

  describe('selecting a sprint', () => {
    it('emits selectDates with the sprint start and end dates when a sprint is clicked', async () => {
      const user = userEvent.setup();
      const { providers } = setup();
      const onSelectDates = vi.fn();
      const startDate = new Date(2026, 0, 1);
      const endDate = new Date(2026, 0, 14);

      await render(SprintManagement, {
        providers,
        inputs: {
          boardId: 'board-1',
          sprints: [
            fakeSprint({
              name: 'Sprint A',
              startDate: ts(startDate),
              endDate: ts(endDate),
            }),
          ],
        },
        on: { selectDates: onSelectDates },
      });

      await user.click(screen.getByRole('button', { name: /Sprint A/i }));

      expect(onSelectDates).toHaveBeenCalledWith({ startDate, endDate });
    });

    it('does not emit selectDates when the edit or delete button is clicked', async () => {
      const user = userEvent.setup();
      const { providers } = setup();
      const onSelectDates = vi.fn();

      await render(SprintManagement, {
        providers,
        inputs: {
          boardId: 'board-1',
          sprints: [fakeSprint({ name: 'Sprint A' })],
        },
        on: { selectDates: onSelectDates },
      });

      await user.click(screen.getByRole('button', { name: 'Edit sprint' }));
      // The edit dialog opens; close it before clicking delete to avoid focus-trap issues.
      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('button', { name: 'Delete sprint' }));

      expect(onSelectDates).not.toHaveBeenCalled();
    });
  });
});
