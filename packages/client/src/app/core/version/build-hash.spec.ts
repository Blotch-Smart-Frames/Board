import { BUILD_HASH } from './build-hash';

// The value is stamped at build time by scripts/stamp-version.mjs, so tests
// only assert the exported shape — not the specific stamped value.
describe('BUILD_HASH', () => {
  it('is a non-empty string', () => {
    expect(typeof BUILD_HASH).toBe('string');
    expect(BUILD_HASH.length).toBeGreaterThan(0);
  });
});
