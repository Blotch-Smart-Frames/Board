import { toDateInputValue, parseDateInput } from './date-input';

describe('toDateInputValue', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(toDateInputValue(new Date(2026, 2, 5))).toBe('2026-03-05');
  });
});

describe('parseDateInput', () => {
  it('returns null for an empty string', () => {
    expect(parseDateInput('')).toBeNull();
  });

  it('parses a YYYY-MM-DD string into a local Date', () => {
    const parsed = parseDateInput('2026-03-05');
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(5);
  });

  it('round-trips with toDateInputValue', () => {
    const original = new Date(2026, 11, 31);
    expect(parseDateInput(toDateInputValue(original))?.getTime()).toBe(original.getTime());
  });
});
