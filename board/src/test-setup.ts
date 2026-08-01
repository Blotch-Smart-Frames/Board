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

// jsdom doesn't implement ResizeObserver; Spartan primitives (select overlays,
// tabs pagination) rely on a shared observer that's constructed lazily on first
// afterRender, so the missing global crashes any spec that opens a select or
// switches views. A minimal stub matches the surface those primitives touch.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom stubs scrollIntoView as a no-op on newer versions but not on older ones;
// the CDK active-descendant key manager and select overlays call it eagerly.
Element.prototype.scrollIntoView ??= function scrollIntoViewPolyfill(): void {};
