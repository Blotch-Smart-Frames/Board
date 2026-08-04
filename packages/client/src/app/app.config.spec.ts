import { appConfig } from './app.config';

describe('appConfig', () => {
  it('exposes a non-empty providers list for the browser bootstrap', () => {
    expect(Array.isArray(appConfig.providers)).toBe(true);
    expect(appConfig.providers.length).toBeGreaterThan(0);
  });
});
