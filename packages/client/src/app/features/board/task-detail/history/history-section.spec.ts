import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import { FIRESTORE_DB } from '../../../../core/firebase/firebase.config';
import { HistorySection } from './history-section';
import type { Collaborator, HistoryEntry } from '../../../../shared/types/board';

type SnapshotDoc = { id: string; data: () => Omit<HistoryEntry, 'id'> };
type SnapshotCallback = (snapshot: { docs: SnapshotDoc[] }) => void;
let onSnapshotCallback: SnapshotCallback | undefined;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ type: 'query', ref, constraints })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  onSnapshot: vi.fn((_ref: unknown, cb: SnapshotCallback) => {
    onSnapshotCallback = cb;
    return vi.fn();
  }),
}));

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

function feed(entries: HistoryEntry[]): void {
  onSnapshotCallback?.({
    docs: entries.map((entry) => {
      const { id: _id, ...rest } = entry;
      return { id: entry.id, data: () => rest };
    }),
  });
}

describe('HistorySection', () => {
  beforeEach(() => {
    onSnapshotCallback = undefined;
  });

  it('shows "No activity yet" when there is no createdAt provided', async () => {
    await render(HistorySection, {
      providers: [{ provide: FIRESTORE_DB, useValue: {} }],
      inputs: { boardId: 'board-1', taskId: 'task-1' },
    });

    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it('shows a "created this task" row for the matching collaborator when createdBy/createdAt are provided', async () => {
    const collaborators: Collaborator[] = [
      { id: 'u1', email: 'alice@example.com', name: 'Alice', isOwner: true },
    ];

    await render(HistorySection, {
      providers: [{ provide: FIRESTORE_DB, useValue: {} }],
      inputs: {
        boardId: 'board-1',
        taskId: 'task-1',
        collaborators,
        createdBy: 'u1',
        createdAt: ts(new Date(2026, 0, 1)),
      },
    });

    expect(screen.getByText(/alice created this task/i)).toBeInTheDocument();
  });

  it('falls back to "Someone" for the creator when the createdBy id is unknown', async () => {
    await render(HistorySection, {
      providers: [{ provide: FIRESTORE_DB, useValue: {} }],
      inputs: {
        boardId: 'board-1',
        taskId: 'task-1',
        createdBy: 'ghost',
        createdAt: ts(new Date(2026, 0, 1)),
      },
    });

    expect(screen.getByText(/someone created this task/i)).toBeInTheDocument();
  });

  it('renders a description for every recognised history action and falls back for unknown ones', async () => {
    const collaborators: Collaborator[] = [
      { id: 'u1', email: 'alice@example.com', name: 'Alice', isOwner: true },
    ];
    const stableTs = ts(new Date(2026, 0, 1));

    const entries: HistoryEntry[] = [
      {
        id: 'h1',
        action: 'label_added',
        userId: 'u1',
        metadata: { labelName: 'urgent' },
        createdAt: stableTs,
      },
      {
        id: 'h2',
        action: 'label_removed',
        userId: 'u1',
        metadata: { labelName: 'urgent' },
        createdAt: stableTs,
      },
      {
        id: 'h3',
        action: 'assignee_added',
        userId: 'u1',
        metadata: { userName: 'Bob' },
        createdAt: stableTs,
      },
      {
        id: 'h4',
        action: 'assignee_removed',
        userId: 'u1',
        metadata: { userName: 'Bob' },
        createdAt: stableTs,
      },
      {
        id: 'h5',
        action: 'attachment_added',
        userId: 'u1',
        metadata: { fileName: 'plan.pdf' },
        createdAt: stableTs,
      },
      {
        id: 'h6',
        action: 'attachment_removed',
        userId: 'u1',
        metadata: { fileName: 'plan.pdf' },
        createdAt: stableTs,
      },
      {
        id: 'h7',
        action: 'moved',
        userId: 'u1',
        metadata: { fromListName: 'To Do', toListName: 'Done' },
        createdAt: stableTs,
      },
      {
        id: 'h8',
        action: 'board_migrated',
        userId: 'u1',
        metadata: { fromBoardName: 'A', toBoardName: 'B' },
        createdAt: stableTs,
      },
      { id: 'h9', action: 'completed', userId: 'u1', createdAt: stableTs },
      { id: 'h10', action: 'reopened', userId: 'u1', createdAt: stableTs },
      { id: 'h11', action: 'field_changed', userId: 'u1', field: 'title', createdAt: stableTs },
      { id: 'h12', action: 'field_changed', userId: 'u1', createdAt: stableTs },
      {
        id: 'h13',
        action: 'ghost' as unknown as HistoryEntry['action'],
        userId: 'unknown',
        createdAt: stableTs,
      },
    ];

    const { detectChanges } = await render(HistorySection, {
      providers: [{ provide: FIRESTORE_DB, useValue: {} }],
      inputs: {
        boardId: 'board-1',
        taskId: 'task-1',
        collaborators,
      },
    });

    feed(entries);
    detectChanges();

    expect(screen.getByText('Alice added label urgent')).toBeInTheDocument();
    expect(screen.getByText('Alice removed label urgent')).toBeInTheDocument();
    expect(screen.getByText('Alice assigned Bob')).toBeInTheDocument();
    expect(screen.getByText('Alice unassigned Bob')).toBeInTheDocument();
    expect(screen.getByText('Alice added attachment plan.pdf')).toBeInTheDocument();
    expect(screen.getByText('Alice removed attachment plan.pdf')).toBeInTheDocument();
    expect(screen.getByText('Alice moved from To Do to Done')).toBeInTheDocument();
    expect(screen.getByText('Alice migrated this task from A to B')).toBeInTheDocument();
    expect(screen.getByText('Alice marked as complete')).toBeInTheDocument();
    expect(screen.getByText('Alice reopened')).toBeInTheDocument();
    expect(screen.getByText('Alice changed title')).toBeInTheDocument();
    expect(screen.getByText('Alice changed a field')).toBeInTheDocument();
    expect(screen.getByText('Someone made a change')).toBeInTheDocument();
  });

  it('formats relative time across every recency bucket', async () => {
    vi.useFakeTimers();
    const now = new Date(2026, 0, 15, 12, 0, 0);
    vi.setSystemTime(now);

    try {
      const collaborators: Collaborator[] = [
        { id: 'u1', email: 'alice@example.com', name: 'Alice', isOwner: true },
      ];
      const entries: HistoryEntry[] = [
        {
          id: 'now',
          action: 'completed',
          userId: 'u1',
          createdAt: ts(new Date(now.getTime() - 5_000)),
        },
        {
          id: 'minutes',
          action: 'completed',
          userId: 'u1',
          createdAt: ts(new Date(now.getTime() - 5 * 60_000)),
        },
        {
          id: 'hours',
          action: 'completed',
          userId: 'u1',
          createdAt: ts(new Date(now.getTime() - 3 * 3_600_000)),
        },
        {
          id: 'days',
          action: 'completed',
          userId: 'u1',
          createdAt: ts(new Date(now.getTime() - 2 * 86_400_000)),
        },
        {
          id: 'oldest',
          action: 'completed',
          userId: 'u1',
          createdAt: ts(new Date(now.getTime() - 30 * 86_400_000)),
        },
        {
          id: 'no-timestamp',
          action: 'completed',
          userId: 'u1',
          createdAt: undefined as unknown as Timestamp,
        },
      ];

      const { detectChanges } = await render(HistorySection, {
        providers: [{ provide: FIRESTORE_DB, useValue: {} }],
        inputs: { boardId: 'board-1', taskId: 'task-1', collaborators },
      });

      feed(entries);
      detectChanges();

      expect(screen.getByText('just now')).toBeInTheDocument();
      expect(screen.getByText('5m ago')).toBeInTheDocument();
      expect(screen.getByText('3h ago')).toBeInTheDocument();
      expect(screen.getByText('2d ago')).toBeInTheDocument();
      expect(
        screen.getByText(new Date(now.getTime() - 30 * 86_400_000).toLocaleDateString()),
      ).toBeInTheDocument();
      expect(screen.getAllByText('Alice marked as complete').length).toBe(entries.length);
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to blank strings when history entries omit their metadata fields', async () => {
    const collaborators: Collaborator[] = [
      { id: 'u1', email: 'alice@example.com', name: 'Alice', isOwner: true },
    ];
    const stableTs = ts(new Date(2026, 0, 1));

    // Same actions as the "recognised" test but every entry omits its metadata
    // so the "?? ''" fallback branches in describe() run.
    const entries: HistoryEntry[] = [
      { id: 'h1', action: 'label_added', userId: 'u1', createdAt: stableTs },
      { id: 'h2', action: 'label_removed', userId: 'u1', createdAt: stableTs },
      { id: 'h3', action: 'assignee_added', userId: 'u1', createdAt: stableTs },
      { id: 'h4', action: 'assignee_removed', userId: 'u1', createdAt: stableTs },
      { id: 'h5', action: 'attachment_added', userId: 'u1', createdAt: stableTs },
      { id: 'h6', action: 'attachment_removed', userId: 'u1', createdAt: stableTs },
      { id: 'h7', action: 'moved', userId: 'u1', createdAt: stableTs },
      { id: 'h8', action: 'board_migrated', userId: 'u1', createdAt: stableTs },
    ];

    const { detectChanges } = await render(HistorySection, {
      providers: [{ provide: FIRESTORE_DB, useValue: {} }],
      inputs: { boardId: 'board-1', taskId: 'task-1', collaborators },
    });

    feed(entries);
    detectChanges();

    // Trailing blank space is expected — assert on the prefix content.
    expect(screen.getByText(/^Alice added label\s*$/)).toBeInTheDocument();
    expect(screen.getByText(/^Alice removed label\s*$/)).toBeInTheDocument();
    expect(screen.getByText(/^Alice assigned\s*$/)).toBeInTheDocument();
    expect(screen.getByText(/^Alice unassigned\s*$/)).toBeInTheDocument();
    expect(screen.getByText(/^Alice added attachment\s*$/)).toBeInTheDocument();
    expect(screen.getByText(/^Alice removed attachment\s*$/)).toBeInTheDocument();
    expect(screen.getByText(/^Alice moved from\s+to\s*$/)).toBeInTheDocument();
    expect(screen.getByText(/^Alice migrated this task from\s+to\s*$/)).toBeInTheDocument();
  });
});
