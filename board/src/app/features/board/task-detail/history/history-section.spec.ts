import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import { FIRESTORE_DB } from '../../../../core/firebase/firebase.config';
import { HistorySection } from './history-section';
import type { Collaborator } from '../../../../shared/types/board';

// history-section.ts pulls in collectionSignal (core/interop/signal-interop.ts),
// which calls the real onSnapshot from 'firebase/firestore' unless mocked. With
// onSnapshot never firing, the history-entries signal stays undefined forever,
// so rows() only ever contains the synthetic "created" row (if any).
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'collection', path: segments.join('/') })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ type: 'query', ref, constraints })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  onSnapshot: vi.fn(() => vi.fn()),
}));

function ts(date: Date): Timestamp {
  return { toDate: () => date } as Timestamp;
}

describe('HistorySection', () => {
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
});
