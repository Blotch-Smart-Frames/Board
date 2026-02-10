import { useState, useEffect } from 'react';
import { syncService } from '../services/syncService';
import { calendarService } from '../services/calendarService';
import { useAuthQuery } from './useAuthQuery';
import type { Task } from '../types/board';
import type { CalendarSyncState, SyncResult } from '../types/calendar';

export const useCalendarSync = (boardId: string | null, tasks: Task[]) => {
  const { accessToken, user } = useAuthQuery();
  const [syncState, setSyncState] = useState<CalendarSyncState>({
    isSyncing: false,
  });

  // Set access token when available
  useEffect(() => {
    if (accessToken) {
      calendarService.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const syncTaskToCalendar = async (task: Task) => {
    if (!boardId) throw new Error('No board selected');

    setSyncState((prev) => ({ ...prev, isSyncing: true, error: undefined }));

    try {
      const eventId = await syncService.syncTaskToCalendar(boardId, task);
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
      }));
      return eventId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setSyncState((prev) => ({ ...prev, isSyncing: false, error: message }));
      throw error;
    }
  };

  const enableSync = async (task: Task) => {
    if (!boardId) throw new Error('No board selected');

    setSyncState((prev) => ({ ...prev, isSyncing: true, error: undefined }));

    try {
      const eventId = await syncService.enableCalendarSync(boardId, task);
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
      }));
      return eventId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enable sync';
      setSyncState((prev) => ({ ...prev, isSyncing: false, error: message }));
      throw error;
    }
  };

  const disableSync = async (task: Task) => {
    if (!boardId) throw new Error('No board selected');

    setSyncState((prev) => ({ ...prev, isSyncing: true, error: undefined }));

    try {
      await syncService.disableCalendarSync(boardId, task);
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disable sync';
      setSyncState((prev) => ({ ...prev, isSyncing: false, error: message }));
      throw error;
    }
  };

  const syncFromCalendar = async (): Promise<SyncResult | null> => {
    if (!boardId || !user) return null;

    setSyncState((prev) => ({ ...prev, isSyncing: true, error: undefined }));

    try {
      const result = await syncService.syncCalendarToTasks(boardId, tasks, user.uid);
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
      }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setSyncState((prev) => ({ ...prev, isSyncing: false, error: message }));
      throw error;
    }
  };

  return {
    syncState,
    syncTaskToCalendar,
    enableSync,
    disableSync,
    syncFromCalendar,
    isCalendarConnected: !!accessToken,
  };
};
