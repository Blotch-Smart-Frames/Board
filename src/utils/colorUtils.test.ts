import { describe, it, expect } from 'vitest';
import { getContrastColor } from './colorUtils';

describe('getContrastColor', () => {
  it('returns black for white background', () => {
    expect(getContrastColor('#FFFFFF')).toBe('black');
  });

  it('returns white for black background', () => {
    expect(getContrastColor('#000000')).toBe('white');
  });

  it('returns white for dark blue', () => {
    expect(getContrastColor('#1a237e')).toBe('white');
  });

  it('returns black for yellow', () => {
    expect(getContrastColor('#FFFF00')).toBe('black');
  });

  it('returns black for light green', () => {
    expect(getContrastColor('#90EE90')).toBe('black');
  });

  it('returns white for dark red', () => {
    expect(getContrastColor('#8B0000')).toBe('white');
  });
});
