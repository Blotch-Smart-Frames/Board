import { Service, signal, computed, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'board-theme-mode';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredMode(): ThemeMode {
  /* v8 ignore next -- SSR guard: localStorage is always defined in jsdom @preserve */
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return isThemeMode(stored) ? stored : 'system';
}

function systemPrefersDark(): boolean {
  /* v8 ignore next -- SSR guard: window is always defined in jsdom @preserve */
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

@Service()
export class ThemeService {
  readonly mode = signal<ThemeMode>(readStoredMode());
  private readonly systemDark = signal(systemPrefersDark());

  readonly isDark = computed(() =>
    this.mode() === 'system' ? this.systemDark() : this.mode() === 'dark',
  );

  constructor() {
    /* v8 ignore next -- SSR guard: window is always defined in jsdom @preserve */
    if (typeof window !== 'undefined') {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (event) => this.systemDark.set(event.matches));
    }

    effect(() => {
      document.documentElement.classList.toggle('dark', this.isDark());
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }
}
