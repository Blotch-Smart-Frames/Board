import { TestBed } from '@angular/core/testing';
import { getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { FIRESTORE_DB } from '../firebase/firebase.config';
import { CalendarService } from './calendar.service';
import { BoardService } from './board.service';
import { SyncService } from './sync.service';
import type { Task } from '../../shared/types/board';

const { MockTimestamp } = vi.hoisted(() => {
  class MockTimestamp {
    date: Date;
    constructor(date: Date) {
      this.date = date;
    }
    toDate() {
      return this.date;
    }
    static now() {
      return new MockTimestamp(new Date());
    }
  }
  return { MockTimestamp };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  Timestamp: MockTimestamp,
}));

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    listId: 'list-1',
    title: 'Task',
    order: 'a0',
    calendarSyncEnabled: true,
    createdBy: 'u1',
    createdAt: {} as never,
    updatedAt: {} as never,
    dueDate: new MockTimestamp(new Date('2026-06-01')) as never,
    ...overrides,
  };
}

describe('SyncService', () => {
  let service: SyncService;
  let calendarService: {
    createEvent: ReturnType<typeof vi.fn>;
    updateEvent: ReturnType<typeof vi.fn>;
    deleteEvent: ReturnType<typeof vi.fn>;
    syncEvents: ReturnType<typeof vi.fn>;
  };
  let boardService: { updateTask: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    calendarService = {
      createEvent: vi.fn(),
      updateEvent: vi.fn(),
      deleteEvent: vi.fn(),
      syncEvents: vi.fn(),
    };
    boardService = { updateTask: vi.fn().mockResolvedValue(undefined) };
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE_DB, useValue: {} },
        { provide: CalendarService, useValue: calendarService },
        { provide: BoardService, useValue: boardService },
      ],
    });
    service = TestBed.inject(SyncService);
  });

  describe('syncTaskToCalendar', () => {
    it('returns null when sync is disabled', async () => {
      const result = await service.syncTaskToCalendar(
        'board-1',
        fakeTask({ calendarSyncEnabled: false }),
      );
      expect(result).toBeNull();
      expect(calendarService.createEvent).not.toHaveBeenCalled();
    });

    it('returns null when there is no due date', async () => {
      const result = await service.syncTaskToCalendar('board-1', fakeTask({ dueDate: undefined }));
      expect(result).toBeNull();
    });

    it('updates the existing calendar event when already linked', async () => {
      calendarService.updateEvent.mockResolvedValue({ id: 'event-1' });

      const result = await service.syncTaskToCalendar(
        'board-1',
        fakeTask({ calendarEventId: 'event-1' }),
      );

      expect(calendarService.updateEvent).toHaveBeenCalledWith('event-1', expect.any(Object));
      expect(calendarService.createEvent).not.toHaveBeenCalled();
      expect(result).toBe('event-1');
    });

    it('creates a new event and persists its id when not yet linked', async () => {
      calendarService.createEvent.mockResolvedValue({ id: 'event-new' });

      const result = await service.syncTaskToCalendar('board-1', fakeTask());

      expect(boardService.updateTask).toHaveBeenCalledWith('board-1', 'task-1', {
        calendarEventId: 'event-new',
      });
      expect(result).toBe('event-new');
    });

    it('rethrows calendar API errors', async () => {
      calendarService.createEvent.mockRejectedValue(new Error('quota exceeded'));

      await expect(service.syncTaskToCalendar('board-1', fakeTask())).rejects.toThrow(
        'quota exceeded',
      );
    });
  });

  describe('unlinkTaskFromCalendar', () => {
    it('does nothing to the calendar API when never linked, but still clears the flags', async () => {
      await service.unlinkTaskFromCalendar('board-1', fakeTask({ calendarEventId: undefined }));

      expect(calendarService.deleteEvent).not.toHaveBeenCalled();
      expect(boardService.updateTask).toHaveBeenCalledWith('board-1', 'task-1', {
        calendarEventId: null,
        calendarSyncEnabled: false,
      });
    });

    it('best-effort deletes the linked event even if the API call fails', async () => {
      calendarService.deleteEvent.mockRejectedValue(new Error('already gone'));

      await service.unlinkTaskFromCalendar('board-1', fakeTask({ calendarEventId: 'event-1' }));

      expect(calendarService.deleteEvent).toHaveBeenCalledWith('event-1');
      expect(boardService.updateTask).toHaveBeenCalledWith('board-1', 'task-1', {
        calendarEventId: null,
        calendarSyncEnabled: false,
      });
    });
  });

  describe('syncCalendarToTasks', () => {
    it('returns an empty result immediately if a sync is already in progress', async () => {
      vi.mocked(getDoc).mockResolvedValue({ data: () => ({}) } as never);
      calendarService.syncEvents.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ items: [] }), 20)),
      );

      const first = service.syncCalendarToTasks('board-1', [], 'u1');
      const second = await service.syncCalendarToTasks('board-1', [], 'u1');

      expect(second).toEqual({ created: [], updated: [], deleted: [], errors: [] });
      await first;
    });

    it('clears the link for cancelled events and updates tasks for active ones', async () => {
      vi.mocked(getDoc).mockResolvedValue({ data: () => ({ calendarSyncToken: 'prev' }) } as never);
      calendarService.syncEvents.mockResolvedValue({
        items: [
          { id: 'event-cancelled', status: 'cancelled' },
          {
            id: 'event-active',
            summary: 'Updated title',
            start: { dateTime: '2026-06-02T00:00:00Z' },
          },
        ],
        nextSyncToken: 'next-token',
      });

      const tasks = [
        fakeTask({ id: 'task-cancelled', calendarEventId: 'event-cancelled' }),
        fakeTask({ id: 'task-active', calendarEventId: 'event-active' }),
      ];

      const result = await service.syncCalendarToTasks('board-1', tasks, 'u1');

      expect(result.deleted).toEqual(['task-cancelled']);
      expect(result.updated).toEqual(['task-active']);
      expect(boardService.updateTask).toHaveBeenCalledWith('board-1', 'task-cancelled', {
        calendarEventId: null,
        calendarSyncEnabled: false,
      });
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        calendarSyncToken: 'next-token',
        lastSyncAt: expect.any(MockTimestamp),
      });
    });

    it('collects a per-task error without aborting the rest of the loop', async () => {
      vi.mocked(getDoc).mockResolvedValue({ data: () => ({}) } as never);
      calendarService.syncEvents.mockResolvedValue({
        items: [
          { id: 'event-a', summary: 'A', start: { date: '2026-06-01' } },
          { id: 'event-b', summary: 'B', start: { date: '2026-06-02' } },
        ],
      });
      boardService.updateTask
        .mockRejectedValueOnce(new Error('write failed'))
        .mockResolvedValueOnce(undefined);

      const result = await service.syncCalendarToTasks(
        'board-1',
        [
          fakeTask({ id: 'task-a', calendarEventId: 'event-a' }),
          fakeTask({ id: 'task-b', calendarEventId: 'event-b' }),
        ],
        'u1',
      );

      expect(result.errors).toEqual([{ taskId: 'task-a', error: 'write failed' }]);
      expect(result.updated).toEqual(['task-b']);
    });

    it('skips events with no matching task', async () => {
      vi.mocked(getDoc).mockResolvedValue({ data: () => ({}) } as never);
      calendarService.syncEvents.mockResolvedValue({
        items: [{ id: 'orphan', summary: 'x', start: { dateTime: '2026-06-01T00:00:00Z' } }],
      });

      const result = await service.syncCalendarToTasks('board-1', [], 'u1');

      expect(result.updated).toEqual([]);
      expect(result.deleted).toEqual([]);
      expect(boardService.updateTask).not.toHaveBeenCalled();
    });

    it('captures a non-Error thrown value as its string representation', async () => {
      vi.mocked(getDoc).mockResolvedValue({ data: () => ({}) } as never);
      calendarService.syncEvents.mockResolvedValue({
        items: [{ id: 'event-a', summary: 'A', start: { date: '2026-06-01' } }],
      });
      boardService.updateTask.mockRejectedValueOnce('boom');

      const result = await service.syncCalendarToTasks(
        'board-1',
        [fakeTask({ id: 'task-a', calendarEventId: 'event-a' })],
        'u1',
      );

      expect(result.errors).toEqual([{ taskId: 'task-a', error: 'boom' }]);
    });

    it('logs but recovers when the calendar fetch itself throws', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(getDoc).mockResolvedValue({ data: () => ({}) } as never);
      calendarService.syncEvents.mockRejectedValue(new Error('network down'));

      const result = await service.syncCalendarToTasks('board-1', [], 'u1');

      expect(result).toEqual({ created: [], updated: [], deleted: [], errors: [] });
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to sync calendar to tasks:',
        expect.any(Error),
      );
      consoleError.mockRestore();
    });
  });

  describe('enableCalendarSync / disableCalendarSync', () => {
    it('throws when the task has no due date', async () => {
      await expect(
        service.enableCalendarSync('board-1', fakeTask({ dueDate: undefined })),
      ).rejects.toThrow('Task must have a due date');
    });

    it('flips the flag on and syncs the task', async () => {
      calendarService.createEvent.mockResolvedValue({ id: 'event-1' });

      await service.enableCalendarSync('board-1', fakeTask({ calendarSyncEnabled: false }));

      expect(boardService.updateTask).toHaveBeenCalledWith('board-1', 'task-1', {
        calendarSyncEnabled: true,
      });
      expect(calendarService.createEvent).toHaveBeenCalled();
    });

    it('disableCalendarSync delegates to unlink', async () => {
      await service.disableCalendarSync('board-1', fakeTask({ calendarEventId: 'event-1' }));

      expect(calendarService.deleteEvent).toHaveBeenCalledWith('event-1');
    });
  });
});
