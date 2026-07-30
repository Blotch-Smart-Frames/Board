import { TestBed } from '@angular/core/testing';
import { addDoc, deleteDoc, getDoc, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { FIRESTORE_DB } from '../firebase/firebase.config';
import { SprintService } from './sprint.service';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  doc: vi.fn((_collectionOrDb: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn((collectionRef: unknown, ...constraints: unknown[]) => ({ collectionRef, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  Timestamp: {
    fromDate: vi.fn((date: Date) => ({ __timestamp: date.getTime(), toDate: () => date })),
  },
}));

function fakeTimestamp(date: Date) {
  return { toDate: () => date };
}

describe('SprintService', () => {
  let service: SprintService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: FIRESTORE_DB, useValue: {} }] });
    service = TestBed.inject(SprintService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createSprint', () => {
    it('converts plain Dates to Timestamps and places the sprint at the end', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
      vi.mocked(addDoc).mockResolvedValue({ id: 'sprint-1' } as never);
      vi.mocked(getDoc).mockResolvedValue({
        id: 'sprint-1',
        data: () => ({ name: 'Sprint 1' }),
      } as never);

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-14');
      await service.createSprint('board-1', { name: 'Sprint 1', startDate, endDate });

      expect(Timestamp.fromDate).toHaveBeenCalledWith(startDate);
      expect(Timestamp.fromDate).toHaveBeenCalledWith(endDate);
    });
  });

  describe('updateSprint', () => {
    it('only includes fields that were actually provided', async () => {
      await service.updateSprint('board-1', 'sprint-1', { name: 'Renamed' });

      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        name: 'Renamed',
        updatedAt: 'SERVER_TIMESTAMP',
      });
    });
  });

  describe('canDeleteSprint / deleteSprint', () => {
    it('reports how many tasks still reference the sprint', async () => {
      vi.mocked(getDocs).mockResolvedValue({ size: 3, docs: [] } as never);

      expect(await service.canDeleteSprint('board-1', 'sprint-1')).toEqual({
        canDelete: false,
        taskCount: 3,
      });
    });

    it('blocks deletion with a pluralized error when tasks are assigned', async () => {
      vi.mocked(getDocs).mockResolvedValue({ size: 2, docs: [] } as never);

      await expect(service.deleteSprint('board-1', 'sprint-1')).rejects.toThrow(
        'Cannot delete sprint: 2 tasks are still assigned to it.',
      );
      expect(deleteDoc).not.toHaveBeenCalled();
    });

    it('uses singular phrasing for exactly one assigned task', async () => {
      vi.mocked(getDocs).mockResolvedValue({ size: 1, docs: [] } as never);

      await expect(service.deleteSprint('board-1', 'sprint-1')).rejects.toThrow(
        'Cannot delete sprint: 1 task is still assigned to it.',
      );
    });

    it('deletes when no tasks reference the sprint', async () => {
      vi.mocked(getDocs).mockResolvedValue({ size: 0, docs: [] } as never);

      await service.deleteSprint('board-1', 'sprint-1');

      expect(deleteDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateNextSprintDates', () => {
    it('suggests today at 00:00 for the very first sprint', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-10T15:30:00'));
      vi.mocked(getDoc).mockResolvedValue({ data: () => undefined } as never);
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);

      const result = await service.calculateNextSprintDates('board-1');

      expect(result.startDate).toEqual(new Date('2026-03-10T00:00:00'));
      expect(result.endDate).toEqual(new Date('2026-03-23T23:59:59.999'));
      expect(result.suggestedName).toBe('Sprint 1');
    });

    it('starts the day after the last sprint ends, using the board sprintConfig duration', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ sprintConfig: { durationDays: 7 } }),
      } as never);
      vi.mocked(getDocs).mockResolvedValue({
        docs: [{ id: 's1', data: () => ({ order: 'a0', endDate: fakeTimestamp(new Date('2026-03-10')) }) }],
      } as never);

      const result = await service.calculateNextSprintDates('board-1');

      expect(result.startDate).toEqual(new Date('2026-03-11T00:00:00'));
      expect(result.endDate).toEqual(new Date('2026-03-17T23:59:59.999'));
      expect(result.suggestedName).toBe('Sprint 2');
    });
  });

  describe('updateSprintConfig', () => {
    it('writes sprintConfig onto the board document', async () => {
      await service.updateSprintConfig('board-1', { durationDays: 10 });

      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        sprintConfig: { durationDays: 10 },
        updatedAt: 'SERVER_TIMESTAMP',
      });
    });
  });
});
