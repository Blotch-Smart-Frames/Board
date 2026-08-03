/**
 * Helpers for `<input type="date">`, whose value is a local `YYYY-MM-DD` string.
 * Signal Forms forbid null field values, so the empty string is the "no date"
 * sentinel; these convert to/from real Date objects at the service boundary.
 */

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}
