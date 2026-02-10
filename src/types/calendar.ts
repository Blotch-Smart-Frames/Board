export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  status?: "confirmed" | "tentative" | "cancelled";
};

export type CreateCalendarEventInput = {
  summary: string;
  description?: string;
  startDateTime: Date;
  endDateTime?: Date;
  timeZone?: string;
};

export type UpdateCalendarEventInput = {
  summary?: string;
  description?: string;
  startDateTime?: Date;
  endDateTime?: Date;
};

export type CalendarSyncState = {
  syncToken?: string;
  lastSyncAt?: Date;
  isSyncing: boolean;
  error?: string;
};

export type SyncResult = {
  created: string[];
  updated: string[];
  deleted: string[];
  errors: { taskId: string; error: string }[];
};
