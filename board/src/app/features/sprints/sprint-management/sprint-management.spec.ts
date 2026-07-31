import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SprintManagement } from './sprint-management';
import { SprintService } from '../../../core/services/sprint.service';
import type { Board, Sprint } from '../../../shared/types/board';

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

function fakeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 'board-1',
    title: 'My board',
    ownerId: 'u1',
    collaborators: [],
    createdAt: ts(new Date()),
    updatedAt: ts(new Date()),
    ...overrides,
  };
}

function setup() {
  const sprintService = {
    calculateNextSprintDates: vi.fn().mockResolvedValue({
      startDate: new Date(2026, 1, 1),
      endDate: new Date(2026, 1, 14),
      suggestedName: 'Sprint 2',
    }),
    createSprint: vi.fn().mockResolvedValue({}),
    updateSprint: vi.fn().mockResolvedValue(undefined),
    canDeleteSprint: vi.fn().mockResolvedValue({ canDelete: true, taskCount: 0 }),
    deleteSprint: vi.fn().mockResolvedValue(undefined),
    updateSprintConfig: vi.fn().mockResolvedValue(undefined),
  };
  return { sprintService, providers: [{ provide: SprintService, useValue: sprintService }] };
}

async function openWith(sprints: Sprint[], board: Board | null = fakeBoard()) {
  const { sprintService, providers } = setup();
  const view = await render(SprintManagement, {
    inputs: { boardId: 'board-1', board, sprints },
    providers,
  });
  view.fixture.componentInstance.open();
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  return { ...view, sprintService };
}

describe('SprintManagement', () => {
  it('shows the duration config and the sprint list', async () => {
    await openWith([fakeSprint({ name: 'Sprint A' })]);

    expect(await screen.findByRole('heading', { name: 'Sprint Management' })).toBeInTheDocument();
    expect(screen.getByText('Sprint A')).toBeInTheDocument();
  });

  it('shows an empty state with no sprints', async () => {
    await openWith([]);

    expect(await screen.findByText('No sprints created yet')).toBeInTheDocument();
  });

  it('disables Save until the duration changes, then saves it', async () => {
    const user = userEvent.setup();
    const { sprintService } = await openWith([], fakeBoard({ sprintConfig: { durationDays: 14 } }));

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    expect(saveButton).toBeDisabled();

    const input = screen.getByLabelText('Default sprint duration in days');
    await user.clear(input);
    await user.type(input, '21');
    await user.click(saveButton);

    await waitFor(() =>
      expect(sprintService.updateSprintConfig).toHaveBeenCalledWith('board-1', { durationDays: 21 }),
    );
  });

  it('edits a sprint through the nested dialog', async () => {
    const user = userEvent.setup();
    const sprint = fakeSprint({ name: 'Sprint A' });
    const { sprintService } = await openWith([sprint]);

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

  it('creates a sprint through the nested dialog', async () => {
    const user = userEvent.setup();
    const { sprintService } = await openWith([]);

    await user.click(screen.getByRole('button', { name: 'Create Sprint' }));
    await screen.findByLabelText('Sprint Name'); // waits out the async defaults load
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(sprintService.createSprint).toHaveBeenCalledWith('board-1', expect.any(Object)));
  });

  it('shows an error and does not delete when tasks are assigned to the sprint', async () => {
    const user = userEvent.setup();
    const sprint = fakeSprint();
    const { sprintService } = await openWith([sprint]);
    sprintService.canDeleteSprint.mockResolvedValue({ canDelete: false, taskCount: 2 });

    await user.click(screen.getByRole('button', { name: 'Delete sprint' }));

    expect(await screen.findByText(/cannot delete: 2 tasks are assigned/i)).toBeInTheDocument();
    expect(sprintService.deleteSprint).not.toHaveBeenCalled();
  });

  it('deletes a sprint when no tasks are assigned', async () => {
    const user = userEvent.setup();
    const sprint = fakeSprint();
    const { sprintService } = await openWith([sprint]);

    await user.click(screen.getByRole('button', { name: 'Delete sprint' }));

    await waitFor(() => expect(sprintService.deleteSprint).toHaveBeenCalledWith('board-1', 's1'));
  });
});
