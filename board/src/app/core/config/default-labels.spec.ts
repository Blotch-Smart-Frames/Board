import { defaultLabels, labelColors } from './default-labels';

describe('defaultLabels', () => {
  it('exposes the six seeded label templates', () => {
    expect(defaultLabels.map((l) => l.name)).toEqual([
      'Hot',
      'Urgent',
      'Idea',
      'Favorite',
      'Watching',
      'Important',
    ]);
  });

  it('gives every label a hex color, an emoji and a non-empty name', () => {
    for (const label of defaultLabels) {
      expect(label.name.length).toBeGreaterThan(0);
      expect(label.emoji.length).toBeGreaterThan(0);
      expect(label.color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('labelColors', () => {
  it('exposes 16 palette hex colors', () => {
    expect(labelColors).toHaveLength(16);
  });

  it('contains only 6-digit uppercase hex values', () => {
    for (const color of labelColors) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('has no duplicate palette entries', () => {
    expect(new Set(labelColors).size).toBe(labelColors.length);
  });
});
