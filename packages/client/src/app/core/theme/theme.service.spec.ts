import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

function stubMatchMedia(matches: boolean) {
  const listeners: ((event: { matches: boolean }) => void)[] = [];
  const mql = {
    matches,
    addEventListener: (_event: string, cb: (event: { matches: boolean }) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  );
  return { emit: (next: boolean) => listeners.forEach((cb) => cb({ matches: next })) };
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to system mode and follows the OS preference', () => {
    stubMatchMedia(true);
    const service = TestBed.inject(ThemeService);

    expect(service.mode()).toBe('system');
    expect(service.isDark()).toBe(true);
  });

  it('reads a previously stored mode from localStorage', () => {
    localStorage.setItem('board-theme-mode', 'dark');
    stubMatchMedia(false);

    const service = TestBed.inject(ThemeService);

    expect(service.mode()).toBe('dark');
    expect(service.isDark()).toBe(true);
  });

  it('reacts to a live OS preference change while in system mode', () => {
    const media = stubMatchMedia(false);
    const service = TestBed.inject(ThemeService);
    expect(service.isDark()).toBe(false);

    media.emit(true);

    expect(service.isDark()).toBe(true);
  });

  it('setMode persists the choice and overrides the system preference', () => {
    stubMatchMedia(false);
    const service = TestBed.inject(ThemeService);

    service.setMode('dark');

    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('board-theme-mode')).toBe('dark');
  });

  it('toggles the "dark" class on <html> to match isDark', () => {
    stubMatchMedia(false);
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    service.setMode('dark');
    TestBed.flushEffects();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
