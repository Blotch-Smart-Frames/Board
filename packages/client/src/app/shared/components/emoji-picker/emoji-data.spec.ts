import { EMOJI_CATEGORIES, EMOJIS } from './emoji-data';

const CATEGORY_IDS = EMOJI_CATEGORIES.map((c) => c.id);

describe('EMOJI_CATEGORIES', () => {
  it('exposes eight curated categories in a fixed order', () => {
    expect(CATEGORY_IDS).toEqual([
      'smileys',
      'people',
      'nature',
      'food',
      'activities',
      'travel',
      'objects',
      'symbols',
    ]);
  });

  it('gives every category a human-readable label', () => {
    for (const category of EMOJI_CATEGORIES) {
      expect(category.label.length).toBeGreaterThan(0);
    }
  });
});

describe('EMOJIS', () => {
  it('is a non-empty list', () => {
    expect(EMOJIS.length).toBeGreaterThan(0);
  });

  it('assigns every emoji to a known category', () => {
    for (const emoji of EMOJIS) {
      expect(CATEGORY_IDS).toContain(emoji.category);
    }
  });

  it('gives every emoji a char, a non-empty name and lowercase keywords', () => {
    for (const emoji of EMOJIS) {
      expect(emoji.char.length).toBeGreaterThan(0);
      expect(emoji.name.length).toBeGreaterThan(0);
      for (const keyword of emoji.keywords) {
        expect(keyword).toBe(keyword.toLowerCase());
      }
    }
  });

  it('has at least one emoji in each category so the picker never renders an empty tab', () => {
    for (const id of CATEGORY_IDS) {
      expect(EMOJIS.some((e) => e.category === id)).toBe(true);
    }
  });

  it('has no duplicate emoji characters', () => {
    const chars = EMOJIS.map((e) => e.char);
    expect(new Set(chars).size).toBe(chars.length);
  });
});
