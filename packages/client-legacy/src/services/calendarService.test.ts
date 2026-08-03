import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/google', () => ({
  GOOGLE_CONFIG: {
    calendarId: 'primary',
    calendarApiBaseUrl: 'https://www.googleapis.com/calendar/v3',
  },
  getCalendarApiUrl: (path: string) =>
    `https://www.googleapis.com/calendar/v3${path}`,
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('calendarService', () => {
  let calendarService: typeof import('./calendarService').calendarService;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('./calendarService');
    calendarService = mod.calendarService;
  });

  describe('createEvent', () => {
    it('throws when not authenticated', async () => {
      await expect(
        calendarService.createEvent({
          summary: 'Test',
          startDateTime: new Date(),
        }),
      ).rejects.toThrow('Not authenticated with Google Calendar');
    });

    it('creates an event with access token', async () => {
      calendarService.setAccessToken('test-token');
      const mockEvent = { id: 'event-1', summary: 'Test' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEvent),
      });

      const result = await calendarService.createEvent({
        summary: 'Test',
        startDateTime: new Date('2024-01-01T10:00:00Z'),
      });

      expect(result).toEqual(mockEvent);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/calendars/primary/events'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });

    it('throws on API error', async () => {
      calendarService.setAccessToken('test-token');
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Quota exceeded' } }),
      });

      await expect(
        calendarService.createEvent({
          summary: 'Test',
          startDateTime: new Date(),
        }),
      ).rejects.toThrow('Quota exceeded');
    });
  });

  describe('updateEvent', () => {
    it('sends PATCH request with updates', async () => {
      calendarService.setAccessToken('test-token');
      const mockEvent = { id: 'event-1', summary: 'Updated' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEvent),
      });

      const result = await calendarService.updateEvent('event-1', {
        summary: 'Updated',
      });

      expect(result).toEqual(mockEvent);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/events/event-1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('deleteEvent', () => {
    it('sends DELETE request', async () => {
      calendarService.setAccessToken('test-token');
      mockFetch.mockResolvedValue({ ok: true, status: 204 });

      await calendarService.deleteEvent('event-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/events/event-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('throws when not authenticated', async () => {
      await expect(calendarService.deleteEvent('event-1')).rejects.toThrow(
        'Not authenticated with Google Calendar',
      );
    });

    it('throws on non-204 error', async () => {
      calendarService.setAccessToken('test-token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { message: 'Server error' } }),
      });

      await expect(calendarService.deleteEvent('event-1')).rejects.toThrow(
        'Server error',
      );
    });
  });

  describe('syncEvents', () => {
    it('fetches events without sync token', async () => {
      calendarService.setAccessToken('test-token');
      const mockResponse = { items: [], nextSyncToken: 'token-1' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await calendarService.syncEvents();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('timeMin='),
        expect.any(Object),
      );
    });

    it('uses sync token when provided', async () => {
      calendarService.setAccessToken('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [], nextSyncToken: 'token-2' }),
      });

      await calendarService.syncEvents('token-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('syncToken=token-1'),
        expect.any(Object),
      );
    });
  });
});
