import '@testing-library/jest-dom/vitest';

// jsdom doesn't ship matchMedia; several Spartan primitives (sonner, dropdown,
// dialog overlays) touch it during their component teardown as well as their
// setup, so a global fallback avoids flaky failures when a spec forgets to stub
// it or when the stub is torn down before the fixture destroy runs.
if (typeof globalThis.matchMedia === 'undefined') {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
