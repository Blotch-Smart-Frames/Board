import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import type { Timestamp } from 'firebase/firestore';
import { DashboardStore, type ActivityEvent, type EnrichedTask } from '../data/dashboard.store';
import type { Collaborator } from '../../../shared/types/board';
import { ActivityTimeline } from './activity-timeline';

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

function setup(events: ActivityEvent[], collaborators: Collaborator[] = []) {
  const resolve = (id: string): Collaborator =>
    collaborators.find((c) => c.id === id) ?? {
      id,
      email: '',
      name: 'Unknown',
      photoURL: null,
      isOwner: false,
    };
  const store = {
    recentActivity: signal(events),
    userDisplay: signal(resolve),
  };
  return { providers: [{ provide: DashboardStore, useValue: store }] };
}

describe('ActivityTimeline', () => {
  it('shows an empty state when there are no events', async () => {
    const { providers } = setup([]);
    await render(ActivityTimeline, { providers });

    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it('renders a "created" event with actor, verb, task title, and location crumbs', async () => {
    const task = fakeTask({ title: 'Add search bar', boardTitle: 'Web app', listTitle: 'To Do' });
    const { providers } = setup(
      [{ id: 'e1', kind: 'created', task, actorId: 'u1', timestamp: new Date() }],
      [{ id: 'u1', email: '', name: 'Alice', photoURL: null, isOwner: false }],
    );
    await render(ActivityTimeline, { providers });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/created/)).toBeInTheDocument();
    expect(screen.getByText('Add search bar')).toBeInTheDocument();
    expect(screen.getByText('Web app')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('uses "completed" wording for completion events', async () => {
    const task = fakeTask({ title: 'Ship v1' });
    const { providers } = setup(
      [{ id: 'e1', kind: 'completed', task, actorId: 'u1', timestamp: new Date() }],
      [{ id: 'u1', email: '', name: 'Alice', photoURL: null, isOwner: false }],
    );
    await render(ActivityTimeline, { providers });

    expect(screen.getByText(/completed/)).toBeInTheDocument();
    expect(screen.getByText('Ship v1')).toBeInTheDocument();
  });

  it('formats relative time buckets (minutes / hours / days)', async () => {
    const now = Date.now();
    const task = fakeTask();
    const { providers } = setup([
      { id: 'e-min', kind: 'created', task, actorId: 'u1', timestamp: new Date(now - 5 * 60_000) },
      {
        id: 'e-hour',
        kind: 'created',
        task,
        actorId: 'u1',
        timestamp: new Date(now - 3 * 3_600_000),
      },
      {
        id: 'e-day',
        kind: 'created',
        task,
        actorId: 'u1',
        timestamp: new Date(now - 2 * 86_400_000),
      },
    ]);
    await render(ActivityTimeline, { providers });

    expect(screen.getByText('5m ago')).toBeInTheDocument();
    expect(screen.getByText('3h ago')).toBeInTheDocument();
    expect(screen.getByText('2d ago')).toBeInTheDocument();
  });

  it('renders one <li> per event', async () => {
    const task = fakeTask();
    const now = new Date();
    const { providers } = setup([
      { id: 'e1', kind: 'created', task, actorId: 'u1', timestamp: now },
      { id: 'e2', kind: 'completed', task, actorId: 'u1', timestamp: now },
    ]);
    const view = await render(ActivityTimeline, { providers });

    expect(view.container.querySelectorAll('li')).toHaveLength(2);
  });
});
