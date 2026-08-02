import { getContrastColor } from './color-utils';

describe('getContrastColor', () => {
  it('returns black for a light hex color', () => {
    expect(getContrastColor('#FFFFFF')).toBe('black');
  });

  it('returns white for a dark hex color', () => {
    expect(getContrastColor('#000000')).toBe('white');
  });

  it('returns white for a mid-tone red where luminance falls below 0.5', () => {
    // #EF4444 → r=239 g=68 b=68 → luminance ≈ 0.39
    expect(getContrastColor('#EF4444')).toBe('white');
  });

  it('returns black for a mid-tone yellow where luminance exceeds 0.5', () => {
    // #FBBF24 → r=251 g=191 b=36 → luminance ≈ 0.80
    expect(getContrastColor('#FBBF24')).toBe('black');
  });

  it('is case-insensitive for hex digits', () => {
    expect(getContrastColor('#ffffff')).toBe('black');
    expect(getContrastColor('#FFFFFF')).toBe('black');
  });
});
