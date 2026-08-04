import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { Task } from '../types/board';

vi.mock('../config/firebase', () => ({
  db: {},
}));

const mockCreateEvent = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDeleteEvent = vi.fn();
const mockSyncEvents = vi.fn();

vi.mock('./calendarService', () => ({
  calendarService: {
    createEvent: (...args: unknown[]) => mockCreateEvent(...args),
    updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
    deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
    syncEvents: (...args: unknown[]) => mockSyncEvents(...args),
  },
}));

const mockUpdateTask = vi.fn();
vi.mock('./boardService', () => ({
  updateTask: (...args: unknown[]) => mockUpdateTask(...args),
}));

const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
}));

const createMockTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 'task-1',
    listId: 'list-1',
    title: 'Test Task',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'user-1',
    ...overrides,
  }) as Task;

describe('syncService', () => {
  let syncService: typeof import('./syncService').syncService;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('./syncService');
    syncService = mod.syncService;
  });

  describe('syncTaskToCalendar', () => {
    it('returns null when sync not enabled', async () => {
      const task = createMockTask({ calendarSyncEnabled: false });
      const result = await syncService.syncTaskToCalendar('board-1', task);
      expect(result).toBeNull();
    });

    it('returns null when no due date', async () => {
      const task = createMockTask({
        calendarSyncEnabled: true,
        dueDate: undefined,
      });
      const result = await syncService.syncTaskToCalendar('board-1', task);
      expect(result).toBeNull();
    });

    it('creates new calendar event when no eventId', async () => {
      mockCreateEvent.mockResolvedValue({ id: 'event-1' });
      mockUpdateTask.mockResolvedValue(undefined);

      const task = createMockTask({
        calendarSyncEnabled: true,
        dueDate: {
          toDate: () => new Date('2024-01-15'),
        } as unknown as Timestamp,
      });

      const result = await syncService.syncTaskToCalendar('board-1', task);

      expect(result).toBe('event-1');
      expect(mockCreateEvent).toHaveBeenCalled();
      expect(mockUpdateTask).toHaveBeenCalledWith(
        'board-1',
        'task-1',
        expect.objectContaining({ calendarEventId: 'event-1' }),
      );
    });

    it('updates existing calendar event when eventId exists', async () => {
      mockUpdateEvent.mockResolvedValue({});

      const task = createMockTask({
        calendarSyncEnabled: true,
        calendarEventId: 'event-1',
        dueDate: {
          toDate: () => new Date('2024-01-15'),
        } as unknown as Timestamp,
      });

      const result = await syncService.syncTaskToCalendar('board-1', task);

      expect(result).toBe('event-1');
      expect(mockUpdateEvent).toHaveBeenCalledWith(
        'event-1',
        expect.objectContaining({ summary: 'Test Task' }),
      );
    });
  });

  describe('unlinkTaskFromCalendar', () => {
    it('deletes calendar event and updates task', async () => {
      mockDeleteEvent.mockResolvedValue(undefined);
      mockUpdateTask.mockResolvedValue(undefined);

      const task = createMockTask({ calendarEventId: 'event-1' });
      await syncService.unlinkTaskFromCalendar('board-1', task);

      expect(mockDeleteEvent).toHaveBeenCalledWith('event-1');
      expect(mockUpdateTask).toHaveBeenCalled();
    });

    it('does nothing when no calendar event linked', async () => {
      const task = createMockTask({ calendarEventId: undefined });
      await syncService.unlinkTaskFromCalendar('board-1', task);

      expect(mockDeleteEvent).not.toHaveBeenCalled();
    });
  });

  describe('enableCalendarSync', () => {
    it('throws when task has no due date', async () => {
      const task = createMockTask({ dueDate: undefined });
      await expect(
        syncService.enableCalendarSync('board-1', task),
      ).rejects.toThrow('Task must have a due date');
    });

    it('enables sync and creates calendar event', async () => {
      mockUpdateTask.mockResolvedValue(undefined);
      mockCreateEvent.mockResolvedValue({ id: 'event-1' });

      const task = createMockTask({
        dueDate: {
          toDate: () => new Date('2024-01-15'),
        } as unknown as Timestamp,
      });

      const result = await syncService.enableCalendarSync('board-1', task);
      expect(result).toBe('event-1');
    });
  });

  describe('syncCalendarToTasks', () => {
    it('returns empty result when sync already in progress', async () => {
      // Start a long-running sync
      mockGetDoc.mockReturnValue(new Promise(() => {}));

      const tasks = [createMockTask()];
      // Fire first sync (will hang)
      syncService.syncCalendarToTasks('board-1', tasks, 'user-1');

      // Second sync should return empty immediately
      const result = await syncService.syncCalendarToTasks(
        'board-1',
        tasks,
        'user-1',
      );

      expect(result).toEqual({
        created: [],
        updated: [],
        deleted: [],
        errors: [],
      });
    });
  });
});
