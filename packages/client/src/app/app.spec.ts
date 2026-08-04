import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { AuthStore } from './core/auth/auth.store';
import { VersionCheckService } from './core/version/version-check.service';
import { App } from './app';

const toastMock = vi.hoisted(() => vi.fn());
vi.mock('@spartan-ng/brain/sonner', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@spartan-ng/brain/sonner');
  return { ...actual, toast: toastMock };
});

function stubMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

const stubbedVersionCheck = { hasNewVersion: signal(false) };

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    toastMock.mockReset();
  });

  it('shows a loading spinner until auth resolves', async () => {
    stubMatchMedia();
    await render(App, {
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: { isAuthReady: signal(false), isAuthenticated: signal(false) },
        },
        { provide: VersionCheckService, useValue: stubbedVersionCheck },
      ],
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the sign-in page once ready but unauthenticated', async () => {
    stubMatchMedia();
    await render(App, {
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: { isAuthReady: signal(true), isAuthenticated: signal(false), login: vi.fn() },
        },
        { provide: VersionCheckService, useValue: stubbedVersionCheck },
      ],
    });

    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('renders the router outlet once authenticated', async () => {
    stubMatchMedia();
    await render(App, {
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            isAuthReady: signal(true),
            isAuthenticated: signal(true),
            user: signal({ displayName: 'Test User', email: 'test@example.com', photoURL: null }),
          },
        },
        { provide: VersionCheckService, useValue: stubbedVersionCheck },
      ],
    });

    expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('fires a persistent update toast once a new version is detected', async () => {
    stubMatchMedia();
    const hasNewVersion = signal(false);
    const { fixture } = await render(App, {
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: { isAuthReady: signal(true), isAuthenticated: signal(false), login: vi.fn() },
        },
        { provide: VersionCheckService, useValue: { hasNewVersion } },
      ],
    });

    expect(toastMock).not.toHaveBeenCalled();

    hasNewVersion.set(true);
    fixture.detectChanges();

    expect(toastMock).toHaveBeenCalledOnce();
    const [message, options] = toastMock.mock.calls[0];
    expect(message).toBe('New version available');
    expect(options.description).toBe('Reload the page to update.');
    expect(options.duration).toBe(Infinity);
    expect(options.action.label).toBe('Reload');

    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { reload: reloadSpy } });
    options.action.onClick();
    expect(reloadSpy).toHaveBeenCalled();

    // Guard against re-firing on subsequent poll intervals.
    hasNewVersion.set(false);
    fixture.detectChanges();
    hasNewVersion.set(true);
    fixture.detectChanges();
    expect(toastMock).toHaveBeenCalledOnce();
  });
});
