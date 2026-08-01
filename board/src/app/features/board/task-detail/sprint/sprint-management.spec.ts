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
  canDeleteSprint: ReturnType<typeof vi.fn>;
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
    canDeleteSprint:
      overrides.canDeleteSprint ?? vi.fn().mockResolvedValue({ canDelete: true, taskCount: 0 }),
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

  it('seeds the duration input from the configured value and disables Save until it changes', async () => {
    const user = userEvent.setup();
    const { providers, sprintService } = setup();
    await render(SprintManagement, {
      providers,
      inputs: { boardId: 'board-1', configuredDurationDays: 14 },
    });

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    expect(saveButton).toBeDisabled();

    const input = screen.getByLabelText('Default sprint duration in days');
    expect(input).toHaveValue(14);

    await user.clear(input);
    await user.type(input, '21');
    expect(saveButton).not.toBeDisabled();

    await user.click(saveButton);

    await waitFor(() =>
      expect(sprintService.updateSprintConfig).toHaveBeenCalledWith('board-1', {
        durationDays: 21,
      }),
    );
  });

  it('defaults to 14 days when no configured duration is provided', async () => {
    const { providers } = setup();
    await render(SprintManagement, {
      providers,
      inputs: { boardId: 'board-1' },
    });

    expect(screen.getByLabelText('Default sprint duration in days')).toHaveValue(14);
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

  it('shows an error and does not call deleteSprint when tasks are assigned', async () => {
    const user = userEvent.setup();
    const { providers, sprintService } = setup({
      canDeleteSprint: vi.fn().mockResolvedValue({ canDelete: false, taskCount: 2 }),
    });
    await render(SprintManagement, {
      providers,
      inputs: {
        boardId: 'board-1',
        sprints: [fakeSprint()],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Delete sprint' }));

    expect(await screen.findByText(/cannot delete: 2 tasks are assigned/i)).toBeInTheDocument();
    expect(sprintService.deleteSprint).not.toHaveBeenCalled();
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
});
