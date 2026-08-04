export const GOOGLE_CONFIG = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  calendarApiBaseUrl: 'https://www.googleapis.com/calendar/v3',
  calendarId: 'primary',
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ],
};

export const getCalendarApiUrl = (path: string) => {
  return `${GOOGLE_CONFIG.calendarApiBaseUrl}${path}`;
};
