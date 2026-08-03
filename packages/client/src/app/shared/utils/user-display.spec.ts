import { getInitials, stringToColor } from './user-display';

describe('getInitials', () => {
  it('uses the first letter of the first two words', () => {
    expect(getInitials('Jane Doe')).toBe('JD');
    expect(getInitials('  Mary   Jane Watson ')).toBe('MJ');
  });

  it('falls back to the first two characters for a single word', () => {
    expect(getInitials('Cher')).toBe('CH');
  });
});

describe('stringToColor', () => {
  it('is deterministic for the same input', () => {
    expect(stringToColor('Jane Doe')).toBe(stringToColor('Jane Doe'));
  });

  it('returns a valid hsl() color string', () => {
    expect(stringToColor('Jane Doe')).toMatch(/^hsl\(\d+, 65%, 45%\)$/);
  });
});
