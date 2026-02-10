import { GOOGLE_CONFIG, getCalendarApiUrl } from '../config/google';
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from '../types/calendar';

class CalendarService {
  private accessToken: string | null = null;

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Calendar');
    }

    const response = await fetch(getCalendarApiUrl(path), {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Calendar API error');
    }

    return response.json();
  }

  async listEvents(
    timeMin?: Date,
    timeMax?: Date,
    maxResults = 100
  ): Promise<{ items: CalendarEvent[]; nextSyncToken?: string }> {
    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (timeMin) params.set('timeMin', timeMin.toISOString());
    if (timeMax) params.set('timeMax', timeMax.toISOString());

    return this.request(`/calendars/${GOOGLE_CONFIG.calendarId}/events?${params}`);
  }

  async getEvent(eventId: string): Promise<CalendarEvent> {
    return this.request(`/calendars/${GOOGLE_CONFIG.calendarId}/events/${eventId}`);
  }

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const endDateTime = input.endDateTime || new Date(input.startDateTime.getTime() + 3600000); // 1 hour default

    const event = {
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.startDateTime.toISOString(),
        timeZone: input.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: input.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    return this.request(`/calendars/${GOOGLE_CONFIG.calendarId}/events`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateEvent(
    eventId: string,
    input: UpdateCalendarEventInput
  ): Promise<CalendarEvent> {
    const updates: Record<string, unknown> = {};

    if (input.summary !== undefined) updates.summary = input.summary;
    if (input.description !== undefined) updates.description = input.description;
    if (input.startDateTime) {
      updates.start = {
        dateTime: input.startDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
    if (input.endDateTime) {
      updates.end = {
        dateTime: input.endDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }

    return this.request(`/calendars/${GOOGLE_CONFIG.calendarId}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Calendar');
    }

    const response = await fetch(
      getCalendarApiUrl(`/calendars/${GOOGLE_CONFIG.calendarId}/events/${eventId}`),
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete event');
    }
  }

  async syncEvents(
    syncToken?: string
  ): Promise<{ items: CalendarEvent[]; nextSyncToken?: string }> {
    const params = new URLSearchParams({
      maxResults: '100',
      singleEvents: 'true',
    });

    if (syncToken) {
      params.set('syncToken', syncToken);
    } else {
      // Initial sync - get events from the past month
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 1);
      params.set('timeMin', timeMin.toISOString());
    }

    return this.request(`/calendars/${GOOGLE_CONFIG.calendarId}/events?${params}`);
  }
}

export const calendarService = new CalendarService();
