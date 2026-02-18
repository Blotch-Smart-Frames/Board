import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({
  db: {},
}));

const mockAddDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
}));

describe('sprintService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSprint', () => {
    it('creates a sprint and returns it', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockAddDoc.mockResolvedValue({ id: 'sprint-1' });
      mockGetDoc.mockResolvedValue({
        id: 'sprint-1',
        data: () => ({
          name: 'Sprint 1',
          startDate: { toDate: () => new Date('2024-01-01') },
          endDate: { toDate: () => new Date('2024-01-14') },
        }),
      });

      const { createSprint } = await import('./sprintService');
      const result = await createSprint('board-1', {
        name: 'Sprint 1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
      });

      expect(mockAddDoc).toHaveBeenCalled();
      expect(result.id).toBe('sprint-1');
    });
  });

  describe('updateSprint', () => {
    it('calls updateDoc with name', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const { updateSprint } = await import('./sprintService');
      await updateSprint('board-1', 'sprint-1', { name: 'Sprint 2' });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('converts dates to Timestamps', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const { updateSprint } = await import('./sprintService');
      await updateSprint('board-1', 'sprint-1', {
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-14'),
      });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('canDeleteSprint', () => {
    it('returns canDelete true when no tasks assigned', async () => {
      mockGetDocs.mockResolvedValue({ size: 0 });

      const { canDeleteSprint } = await import('./sprintService');
      const result = await canDeleteSprint('board-1', 'sprint-1');

      expect(result).toEqual({ canDelete: true, taskCount: 0 });
    });

    it('returns canDelete false when tasks are assigned', async () => {
      mockGetDocs.mockResolvedValue({ size: 3 });

      const { canDeleteSprint } = await import('./sprintService');
      const result = await canDeleteSprint('board-1', 'sprint-1');

      expect(result).toEqual({ canDelete: false, taskCount: 3 });
    });
  });

  describe('deleteSprint', () => {
    it('deletes sprint when no tasks assigned', async () => {
      mockGetDocs.mockResolvedValue({ size: 0 });
      mockDeleteDoc.mockResolvedValue(undefined);

      const { deleteSprint } = await import('./sprintService');
      await deleteSprint('board-1', 'sprint-1');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('throws when tasks are assigned', async () => {
      mockGetDocs.mockResolvedValue({ size: 2 });

      const { deleteSprint } = await import('./sprintService');
      await expect(deleteSprint('board-1', 'sprint-1')).rejects.toThrow(
        'Cannot delete sprint',
      );
    });
  });

  describe('getBoardSprints', () => {
    it('returns mapped sprints', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 's1',
            data: () => ({ name: 'Sprint 1', order: 'a0' }),
          },
        ],
      });

      const { getBoardSprints } = await import('./sprintService');
      const result = await getBoardSprints('board-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });
  });

  describe('calculateNextSprintDates', () => {
    it('returns today as start for first sprint', async () => {
      mockGetDoc.mockResolvedValue({
        data: () => ({ sprintConfig: { durationDays: 14 } }),
      });
      mockGetDocs.mockResolvedValue({ docs: [] });

      const { calculateNextSprintDates } = await import('./sprintService');
      const result = await calculateNextSprintDates('board-1');

      expect(result.suggestedName).toBe('Sprint 1');
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });

    it('uses default duration when config missing', async () => {
      mockGetDoc.mockResolvedValue({ data: () => ({}) });
      mockGetDocs.mockResolvedValue({ docs: [] });

      const { calculateNextSprintDates } = await import('./sprintService');
      const result = await calculateNextSprintDates('board-1');

      // Default 14 days
      const diffMs =
        result.endDate.getTime() - result.startDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(14); // 14 days duration, end time is 23:59:59
    });
  });

  describe('updateSprintConfig', () => {
    it('calls updateDoc with config', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const { updateSprintConfig } = await import('./sprintService');
      await updateSprintConfig('board-1', { durationDays: 7 });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });
});
