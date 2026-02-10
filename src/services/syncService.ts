import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { calendarService } from './calendarService';
import { updateTask } from './boardService';
import type { Task } from '../types/board';
import type { SyncResult } from '../types/calendar';

class SyncService {
  private syncInProgress = false;

  async syncTaskToCalendar(
    boardId: string,
    task: Task,
  ): Promise<string | null> {
    if (!task.calendarSyncEnabled || !task.dueDate) {
      return null;
    }

    const dueDate =
      task.dueDate instanceof Date ? task.dueDate : task.dueDate.toDate();

    try {
      if (task.calendarEventId) {
        // Update existing event
        await calendarService.updateEvent(task.calendarEventId, {
          summary: task.title,
          description: task.description,
          startDateTime: dueDate,
        });
        return task.calendarEventId;
      } else {
        // Create new event
        const event = await calendarService.createEvent({
          summary: task.title,
          description: task.description || `Task from Board by Blotch`,
          startDateTime: dueDate,
        });

        // Update task with calendar event ID
        await updateTask(boardId, task.id, { calendarEventId: event.id });
        return event.id;
      }
    } catch (error) {
      console.error('Failed to sync task to calendar:', error);
      throw error;
    }
  }

  async unlinkTaskFromCalendar(boardId: string, task: Task): Promise<void> {
    if (task.calendarEventId) {
      try {
        await calendarService.deleteEvent(task.calendarEventId);
      } catch (error) {
        console.error('Failed to delete calendar event:', error);
      }

      await updateTask(boardId, task.id, {
        calendarEventId: undefined,
        calendarSyncEnabled: false,
      } as unknown as Parameters<typeof updateTask>[2]);
    }
  }

  async syncCalendarToTasks(
    boardId: string,
    tasks: Task[],
    userId: string,
  ): Promise<SyncResult> {
    if (this.syncInProgress) {
      return { created: [], updated: [], deleted: [], errors: [] };
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      created: [],
      updated: [],
      deleted: [],
      errors: [],
    };

    try {
      // Get user's sync token
      const userDoc = await getDoc(doc(db, 'users', userId));
      const syncToken = userDoc.exists()
        ? userDoc.data()?.calendarSyncToken
        : undefined;

      // Fetch calendar events
      const { items: events, nextSyncToken } =
        await calendarService.syncEvents(syncToken);

      // Update sync token
      if (nextSyncToken) {
        await updateDoc(doc(db, 'users', userId), {
          calendarSyncToken: nextSyncToken,
          lastSyncAt: Timestamp.now(),
        });
      }

      // Process events
      for (const event of events) {
        const linkedTask = tasks.find((t) => t.calendarEventId === event.id);

        if (linkedTask) {
          if (event.status === 'cancelled') {
            // Event was deleted in calendar
            try {
              await updateTask(boardId, linkedTask.id, {
                calendarEventId: undefined,
                calendarSyncEnabled: false,
              } as unknown as Parameters<typeof updateTask>[2]);
              result.deleted.push(linkedTask.id);
            } catch (error) {
              result.errors.push({
                taskId: linkedTask.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          } else {
            // Event was updated in calendar
            try {
              const eventStart = event.start.dateTime || event.start.date;
              if (eventStart) {
                await updateTask(boardId, linkedTask.id, {
                  title: event.summary,
                  description: event.description,
                  dueDate: new Date(eventStart),
                });
                result.updated.push(linkedTask.id);
              }
            } catch (error) {
              result.errors.push({
                taskId: linkedTask.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Calendar sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  async enableCalendarSync(
    boardId: string,
    task: Task,
  ): Promise<string | null> {
    if (!task.dueDate) {
      throw new Error('Task must have a due date to enable calendar sync');
    }

    await updateTask(boardId, task.id, { calendarSyncEnabled: true });
    return this.syncTaskToCalendar(boardId, {
      ...task,
      calendarSyncEnabled: true,
    });
  }

  async disableCalendarSync(boardId: string, task: Task): Promise<void> {
    await this.unlinkTaskFromCalendar(boardId, task);
  }
}

export const syncService = new SyncService();
