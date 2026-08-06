import { Service, inject } from '@angular/core';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { FIRESTORE_DB } from '../firebase/firebase.config';
import { CalendarService } from './calendar.service';
import { BoardService } from './board.service';
import type { Task } from '../../shared/types/board';
import type { SyncResult } from '../../shared/types/calendar';

@Service()
export class SyncService {
  private readonly db = inject(FIRESTORE_DB);
  private readonly calendarService = inject(CalendarService);
  private readonly boardService = inject(BoardService);
  private syncInProgress = false;

  async syncTaskToCalendar(boardId: string, task: Task): Promise<string | null> {
    if (!task.calendarSyncEnabled || !task.dueDate) return null;

    const dueDate = task.dueDate.toDate();

    try {
      if (task.calendarEventId) {
        await this.calendarService.updateEvent(task.calendarEventId, {
          summary: task.title,
          description: task.description,
          startDateTime: dueDate,
        });
        return task.calendarEventId;
      }

      const event = await this.calendarService.createEvent({
        summary: task.title,
        description: task.description,
        startDateTime: dueDate,
      });
      await this.boardService.updateTask(boardId, task.id, { calendarEventId: event.id });
      return event.id;
    } catch (error) {
      console.error('Failed to sync task to calendar:', error);
      throw error;
    }
  }

  async unlinkTaskFromCalendar(boardId: string, task: Task): Promise<void> {
    if (task.calendarEventId) {
      try {
        await this.calendarService.deleteEvent(task.calendarEventId);
      } catch (error) {
        console.error('Failed to delete calendar event:', error);
      }
    }
    await this.boardService.updateTask(boardId, task.id, {
      calendarEventId: null,
      calendarSyncEnabled: false,
    });
  }

  async syncCalendarToTasks(boardId: string, tasks: Task[], userId: string): Promise<SyncResult> {
    const result: SyncResult = { created: [], updated: [], deleted: [], errors: [] };
    if (this.syncInProgress) return result;

    this.syncInProgress = true;
    try {
      const userRef = doc(this.db, 'users', userId);
      const userSnapshot = await getDoc(userRef);
      const syncToken = userSnapshot.data()?.['calendarSyncToken'] as string | undefined;

      const { items, nextSyncToken } = await this.calendarService.syncEvents(syncToken);

      for (const event of items) {
        const task = tasks.find((t) => t.calendarEventId === event.id);
        if (!task) continue;

        try {
          if (event.status === 'cancelled') {
            await this.boardService.updateTask(boardId, task.id, {
              calendarEventId: null,
              calendarSyncEnabled: false,
            });
            result.deleted.push(task.id);
          } else {
            const dueDateTime = event.start.dateTime ?? event.start.date;
            await this.boardService.updateTask(boardId, task.id, {
              title: event.summary,
              description: event.description,
              dueDate: dueDateTime ? new Date(dueDateTime) : undefined,
            });
            result.updated.push(task.id);
          }
        } catch (error) {
          result.errors.push({
            taskId: task.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (nextSyncToken) {
        await updateDoc(userRef, { calendarSyncToken: nextSyncToken, lastSyncAt: Timestamp.now() });
      }
    } catch (error) {
      console.error('Failed to sync calendar to tasks:', error);
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  async enableCalendarSync(boardId: string, task: Task): Promise<string | null> {
    if (!task.dueDate) {
      throw new Error('Task must have a due date to enable calendar sync.');
    }
    await this.boardService.updateTask(boardId, task.id, { calendarSyncEnabled: true });
    return this.syncTaskToCalendar(boardId, { ...task, calendarSyncEnabled: true });
  }

  async disableCalendarSync(boardId: string, task: Task): Promise<void> {
    await this.unlinkTaskFromCalendar(boardId, task);
  }
}
