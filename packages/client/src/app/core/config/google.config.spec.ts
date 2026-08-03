import { GOOGLE_CONFIG, getCalendarApiUrl } from './google.config';

describe('GOOGLE_CONFIG', () => {
  it('points at the v3 Calendar API base URL', () => {
    expect(GOOGLE_CONFIG.calendarApiBaseUrl).toBe('https://www.googleapis.com/calendar/v3');
  });

  it('defaults to the primary calendar', () => {
    expect(GOOGLE_CONFIG.calendarId).toBe('primary');
  });

  it('requests full calendar and event scopes', () => {
    expect(GOOGLE_CONFIG.scopes).toEqual([
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ]);
  });
});

describe('getCalendarApiUrl', () => {
  it('prepends the calendar API base URL to the given path', () => {
    expect(getCalendarApiUrl('/calendars/primary/events')).toBe(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    );
  });

  it('returns the base URL when given an empty path', () => {
    expect(getCalendarApiUrl('')).toBe('https://www.googleapis.com/calendar/v3');
  });
});
