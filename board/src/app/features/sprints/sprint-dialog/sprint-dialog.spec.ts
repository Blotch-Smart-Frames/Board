import type { Timestamp } from 'firebase/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SprintDialog } from './sprint-dialog';
import { SprintService } from '../../../core/services/sprint.service';
import type { Sprint } from '../../../shared/types/board';

type Defaults = { startDate: Date; endDate: Date; suggestedName: string };

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

function setup(
  calculateNextSprintDates = vi.fn<() => Promise<Defaults>>().mockResolvedValue({
    startDate: new Date(2026, 1, 1),
    endDate: new Date(2026, 1, 14),
    suggestedName: 'Sprint 2',
  }),
) {
  const sprintService = { calculateNextSprintDates };
  return { sprintService, providers: [{ provide: SprintService, useValue: sprintService }] };
}

async function openWith(sprint: Sprint | null, saveHandler = vi.fn().mockResolvedValue(undefined)) {
  const { sprintService, providers } = setup();
  const view = await render(SprintDialog, {
    inputs: { boardId: 'board-1', saveHandler },
    providers,
  });
  const opened = view.fixture.componentInstance.open(sprint);
  view.fixture.detectChanges();
  await opened;
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  return { ...view, saveHandler, sprintService };
}

describe('SprintDialog', () => {
  it('prefills fields in edit mode without calculating defaults', async () => {
    const { sprintService, fixture } = await openWith(fakeSprint({ name: 'Sprint A' }));

    expect(await screen.findByRole('heading', { name: /edit sprint/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Sprint Name')).toHaveValue('Sprint A');
    const model = fixture.componentInstance['model']();
    expect(model.startDate).toEqual(new Date(2026, 0, 1));
    expect(model.endDate).toEqual(new Date(2026, 0, 14));
    expect(sprintService.calculateNextSprintDates).not.toHaveBeenCalled();
  });

  it('shows a loading state then populates suggested defaults in create mode', async () => {
    let resolveDefaults!: (value: Defaults) => void;
    const calculateNextSprintDates = vi.fn<() => Promise<Defaults>>(
      () => new Promise((resolve) => (resolveDefaults = resolve)),
    );
    const { providers } = setup(calculateNextSprintDates);
    const view = await render(SprintDialog, {
      inputs: { boardId: 'board-1', saveHandler: vi.fn().mockResolvedValue(undefined) },
      providers,
    });

    const opened = view.fixture.componentInstance.open(null);
    view.fixture.detectChanges();

    expect(await screen.findByRole('heading', { name: /create sprint/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Sprint Name')).not.toBeInTheDocument();

    resolveDefaults({
      startDate: new Date(2026, 1, 1),
      endDate: new Date(2026, 1, 14),
      suggestedName: 'Sprint 2',
    });
    await opened;
    view.fixture.detectChanges();
    await view.fixture.whenStable();

    expect(screen.getByLabelText('Sprint Name')).toHaveValue('Sprint 2');
    const model = view.fixture.componentInstance['model']();
    expect(model.startDate).toEqual(new Date(2026, 1, 1));
    expect(model.endDate).toEqual(new Date(2026, 1, 14));
  });

  it('blocks saving when the name is emptied', async () => {
    const user = userEvent.setup();
    const { saveHandler } = await openWith(fakeSprint());

    const name = await screen.findByLabelText('Sprint Name');
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(saveHandler).not.toHaveBeenCalled();
  });

  it('flags an end date earlier than the start date', async () => {
    const user = userEvent.setup();
    const { saveHandler, fixture } = await openWith(fakeSprint());

    const component = fixture.componentInstance;
    component['onStartDateChange'](new Date(2026, 5, 10));
    component['onEndDateChange'](new Date(2026, 5, 1));
    fixture.detectChanges();

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText(/end date must be on or after the start date/i)).toBeInTheDocument();
    expect(saveHandler).not.toHaveBeenCalled();
  });

  it('saves edited fields through saveHandler', async () => {
    const user = userEvent.setup();
    const { saveHandler } = await openWith(fakeSprint({ name: 'Old name' }));

    const name = await screen.findByLabelText('Sprint Name');
    await user.clear(name);
    await user.type(name, 'New name');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(saveHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New name',
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      ),
    );
  });
});
