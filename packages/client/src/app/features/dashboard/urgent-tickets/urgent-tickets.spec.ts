import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Timestamp } from 'firebase/firestore';
import { DashboardStore, type EnrichedTask } from '../data/dashboard.store';
import type { Collaborator } from '../../../shared/types/board';
import { UrgentTickets } from './urgent-tickets';

const DAY_MS = 86_400_000;

function ts(date: Date): Timestamp {
  return { toDate: () => date, toMillis: () => date.getTime() } as Timestamp;
}

function fakeTask(overrides: Partial<EnrichedTask> = {}): EnrichedTask {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Fix login bug',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'u1',
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    boardId: 'board-1',
    boardTitle: 'Frontend',
    listTitle: 'In Progress',
    ...overrides,
  };
}

function setup(
  opts: { all?: EnrichedTask[]; mine?: EnrichedTask[]; collaborators?: Collaborator[] } = {},
) {
  const collaborators = opts.collaborators ?? [];
  const resolve = (id: string): Collaborator =>
    collaborators.find((c) => c.id === id) ?? {
      id,
      email: '',
      name: 'Unknown',
      photoURL: null,
      isOwner: false,
    };
  const store = {
    urgentTickets: signal(opts.all ?? []),
    myUrgentTickets: signal(opts.mine ?? []),
    userDisplay: signal(resolve),
  };
  return {
    store,
    providers: [{ provide: DashboardStore, useValue: store }],
  };
}

describe('UrgentTickets', () => {
  it('renders an empty state when there are no team-wide urgent tickets', async () => {
    const { providers } = setup({ all: [] });
    await render(UrgentTickets, { providers });

    expect(screen.getByText(/nothing urgent right now/i)).toBeInTheDocument();
    expect(screen.getByText(/the team is on top of things/i)).toBeInTheDocument();
  });

  it('renders task title, board, and list for each urgent ticket', async () => {
    const now = Date.now();
    const { providers } = setup({
      all: [
        fakeTask({
          id: 't1',
          title: 'Ship dashboard',
          boardTitle: 'Frontend',
          listTitle: 'In Progress',
          dueDate: ts(new Date(now + DAY_MS / 2)),
        }),
      ],
    });
    await render(UrgentTickets, { providers });

    expect(screen.getByText('Ship dashboard')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('labels the badge based on how far past/before the due date is', async () => {
    const now = Date.now();
    const { providers } = setup({
      all: [
        fakeTask({ id: 't-overdue', dueDate: ts(new Date(now - 5 * DAY_MS)) }),
        fakeTask({ id: 't-today', dueDate: ts(new Date(now + DAY_MS / 4)) }),
        fakeTask({ id: 't-tomorrow', dueDate: ts(new Date(now + 1.5 * DAY_MS)) }),
        fakeTask({ id: 't-soon', dueDate: ts(new Date(now + 2.5 * DAY_MS)) }),
      ],
    });
    await render(UrgentTickets, { providers });

    expect(screen.getByText(/5d overdue/)).toBeInTheDocument();
    expect(screen.getByText(/due today/i)).toBeInTheDocument();
    expect(screen.getByText(/due tomorrow/i)).toBeInTheDocument();
    expect(screen.getByText(/due in 3d/i)).toBeInTheDocument();
  });

  it('switches to the "mine only" source when the Mine toggle is clicked', async () => {
    const user = userEvent.setup();
    const now = Date.now();
    const teamTask = fakeTask({
      id: 't-team',
      title: 'Team task',
      dueDate: ts(new Date(now)),
    });
    const myTask = fakeTask({
      id: 't-mine',
      title: 'My task',
      dueDate: ts(new Date(now)),
    });
    const { providers } = setup({ all: [teamTask, myTask], mine: [myTask] });
    await render(UrgentTickets, { providers });

    expect(screen.getByText('Team task')).toBeInTheDocument();
    expect(screen.getByText('My task')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /only my urgent tickets/i }));

    expect(screen.queryByText('Team task')).not.toBeInTheDocument();
    expect(screen.getByText('My task')).toBeInTheDocument();
  });

  it('shows the personal empty-state copy when Mine is selected and the user has none', async () => {
    const user = userEvent.setup();
    const { providers } = setup({
      all: [fakeTask({ dueDate: ts(new Date()) })],
      mine: [],
    });
    await render(UrgentTickets, { providers });

    await user.click(screen.getByRole('button', { name: /only my urgent tickets/i }));

    expect(screen.getByText(/you're all clear/i)).toBeInTheDocument();
  });

  it('renders resolved assignee avatars beside each ticket', async () => {
    const { providers } = setup({
      all: [
        fakeTask({
          assignedTo: ['u1', 'u2'],
          dueDate: ts(new Date()),
        }),
      ],
      collaborators: [
        { id: 'u1', email: '', name: 'Alice Anderson', photoURL: null, isOwner: false },
        { id: 'u2', email: '', name: 'Bob Baker', photoURL: null, isOwner: false },
      ],
    });
    await render(UrgentTickets, { providers });

    expect(screen.getByText('AA')).toBeInTheDocument();
    expect(screen.getByText('BB')).toBeInTheDocument();
  });

  it('caps rendered tickets at 10', async () => {
    const now = Date.now();
    const tasks = Array.from({ length: 15 }, (_, i) =>
      fakeTask({ id: `t${i}`, title: `Task ${i}`, dueDate: ts(new Date(now + i * 3600_000)) }),
    );
    const { providers } = setup({ all: tasks });
    await render(UrgentTickets, { providers });

    expect(screen.getByText('Task 9')).toBeInTheDocument();
    expect(screen.queryByText('Task 10')).not.toBeInTheDocument();
  });
});
