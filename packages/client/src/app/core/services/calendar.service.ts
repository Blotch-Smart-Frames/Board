import { Service } from '@angular/core';
import { GOOGLE_CONFIG, getCalendarApiUrl } from '../config/google.config';
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from '../../shared/types/calendar';

@Service()
export class CalendarService {
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const endDateTime =
      input.endDateTime ?? new Date(input.startDateTime.getTime() + 60 * 60 * 1000);
    const timeZone = input.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

    return this.request<CalendarEvent>(`/calendars/${GOOGLE_CONFIG.calendarId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startDateTime.toISOString(), timeZone },
        end: { dateTime: endDateTime.toISOString(), timeZone },
      }),
    });
  }

  async updateEvent(eventId: string, input: UpdateCalendarEventInput): Promise<CalendarEvent> {
    const body: Record<string, unknown> = {};
    if (input.summary !== undefined) body['summary'] = input.summary;
    if (input.description !== undefined) body['description'] = input.description;
    if (input.startDateTime !== undefined) {
      body['start'] = { dateTime: input.startDateTime.toISOString() };
    }
    if (input.endDateTime !== undefined) {
      body['end'] = { dateTime: input.endDateTime.toISOString() };
    }

    return this.request<CalendarEvent>(`/calendars/${GOOGLE_CONFIG.calendarId}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
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
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );
    if (!response.ok && response.status !== 204) {
      throw new Error('Failed to delete calendar event');
    }
  }

  async syncEvents(
    syncToken?: string,
  ): Promise<{ items: CalendarEvent[]; nextSyncToken?: string }> {
    const params = new URLSearchParams({ maxResults: '100', singleEvents: 'true' });
    if (syncToken) {
      params.set('syncToken', syncToken);
    } else {
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 1);
      params.set('timeMin', timeMin.toISOString());
    }

    return this.request<{ items: CalendarEvent[]; nextSyncToken?: string }>(
      `/calendars/${GOOGLE_CONFIG.calendarId}/events?${params.toString()}`,
    );
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: string } = {},
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Calendar');
    }

    const response = await fetch(getCalendarApiUrl(path), {
      method: options.method,
      body: options.body,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(error.error?.message ?? 'Calendar API error');
    }

    return response.json();
  }
}
