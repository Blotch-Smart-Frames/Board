import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { AuthStore } from './core/auth/auth.store';
import { VersionCheckService } from './core/version/version-check.service';
import { App } from './app';

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
});
