import { TestBed } from '@angular/core/testing';
import { CalendarService } from './calendar.service';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) } as Response;
}

describe('CalendarService', () => {
  let service: CalendarService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalendarService);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when no access token has been set', async () => {
    await expect(
      service.createEvent({ summary: 'Test', startDateTime: new Date() }),
    ).rejects.toThrow('Not authenticated with Google Calendar');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('createEvent', () => {
    it('defaults the end time to one hour after the start and sends the auth header', async () => {
      service.setAccessToken('token-123');
      fetchMock.mockResolvedValue(jsonResponse({ id: 'event-1', summary: 'Test' }));

      const start = new Date('2026-05-01T10:00:00Z');
      const event = await service.createEvent({ summary: 'Test', startDateTime: start });

      expect(event).toEqual({ id: 'event-1', summary: 'Test' });
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/calendars/primary/events');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer token-123');
      const body = JSON.parse(options.body);
      expect(body.start.dateTime).toBe(start.toISOString());
      expect(body.end.dateTime).toBe(new Date('2026-05-01T11:00:00Z').toISOString());
    });
  });

  describe('updateEvent', () => {
    it('only sends fields that were provided', async () => {
      service.setAccessToken('token-123');
      fetchMock.mockResolvedValue(jsonResponse({ id: 'event-1' }));

      await service.updateEvent('event-1', { summary: 'Renamed' });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/events/event-1');
      expect(options.method).toBe('PATCH');
      expect(JSON.parse(options.body)).toEqual({ summary: 'Renamed' });
    });
  });

  describe('deleteEvent', () => {
    it('treats a 204 with no body as success', async () => {
      service.setAccessToken('token-123');
      fetchMock.mockResolvedValue({ ok: false, status: 204 } as Response);

      await expect(service.deleteEvent('event-1')).resolves.toBeUndefined();
    });

    it('throws when the API returns a real error', async () => {
      service.setAccessToken('token-123');
      fetchMock.mockResolvedValue({ ok: false, status: 404 } as Response);

      await expect(service.deleteEvent('event-1')).rejects.toThrow('Failed to delete calendar event');
    });
  });

  describe('syncEvents', () => {
    it('uses a syncToken for incremental sync when provided', async () => {
      service.setAccessToken('token-123');
      fetchMock.mockResolvedValue(jsonResponse({ items: [], nextSyncToken: 'next' }));

      await service.syncEvents('prev-token');

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('syncToken=prev-token');
      expect(url).not.toContain('timeMin');
    });

    it('falls back to a one-month timeMin window for an initial sync', async () => {
      service.setAccessToken('token-123');
      fetchMock.mockResolvedValue(jsonResponse({ items: [] }));

      await service.syncEvents();

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('timeMin=');
      expect(url).not.toContain('syncToken');
    });
  });

  describe('error handling', () => {
    it('surfaces the API error message from the response body', async () => {
      service.setAccessToken('token-123');
      fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Quota exceeded' } }, false, 429));

      await expect(service.syncEvents()).rejects.toThrow('Quota exceeded');
    });
  });
});
