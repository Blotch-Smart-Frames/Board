import { DOCUMENT, signal } from '@angular/core';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthStore } from '../../core/auth/auth.store';
import { McpConnectService } from '../../core/services/mcp-connect.service';
import type { McpConnectRequestInfo } from '../../shared/types/board';
import { ConnectPage } from './connect-page';

type FakeUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

const ALICE: FakeUser = {
  uid: 'u1',
  displayName: 'Alice',
  email: 'alice@example.com',
  photoURL: 'https://example.com/alice.png',
};

function makeInfo(overrides: Partial<McpConnectRequestInfo> = {}): McpConnectRequestInfo {
  return {
    clientName: 'Claude',
    clientUri: 'https://claude.ai',
    redirectHost: 'claude.ai',
    isLoopbackRedirect: false,
    expiresAt: 1_700_000_000_000,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function functionsError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

async function setup(options: {
  request?: string;
  user?: FakeUser | null;
  getRequest?: () => Promise<McpConnectRequestInfo>;
  decide?: () => Promise<{ redirectUrl: string }>;
}) {
  const service = {
    getRequest: vi.fn(options.getRequest ?? (() => Promise.resolve(makeInfo()))),
    decide: vi.fn(
      options.decide ?? (() => Promise.resolve({ redirectUrl: 'https://claude.ai/cb' })),
    ),
  };
  const assign = vi.fn();
  // Only the page's own `location` is faked; everything else forwards to the
  // real document so rendering keeps working.
  const fakeDocument = new Proxy(document, {
    get(target, prop) {
      if (prop === 'location') return { assign };
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  await render(ConnectPage, {
    inputs: { request: options.request },
    providers: [
      { provide: McpConnectService, useValue: service },
      {
        provide: AuthStore,
        useValue: { user: signal(options.user === undefined ? ALICE : options.user) },
      },
    ],
    componentProviders: [{ provide: DOCUMENT, useValue: fakeDocument }],
  });

  return { service, assign };
}

describe('ConnectPage', () => {
  it('explains that the link is incomplete when there is no request id', async () => {
    const { service } = await setup({});

    expect(screen.getByRole('heading', { name: /can't connect this app/i })).toBeInTheDocument();
    expect(screen.getByText(/missing its connection request/i)).toBeInTheDocument();
    expect(service.getRequest).not.toHaveBeenCalled();
  });

  it('shows a loading state while the request loads', async () => {
    const { service } = await setup({
      request: 'req-1',
      getRequest: () => deferred<McpConnectRequestInfo>().promise,
    });

    expect(
      await screen.findByRole('heading', { name: /loading connection request/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    expect(service.getRequest).toHaveBeenCalledWith('req-1');
  });

  it('tells the user to start again when the request has expired or was used', async () => {
    await setup({
      request: 'req-1',
      getRequest: () => Promise.reject(functionsError('functions/not-found')),
    });

    expect(await screen.findByText(/expired or was already used/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /allow/i })).not.toBeInTheDocument();
  });

  it('shows a generic message when the request fails to load for another reason', async () => {
    await setup({
      request: 'req-1',
      getRequest: () => Promise.reject(functionsError('functions/internal')),
    });

    expect(await screen.findByText(/couldn't load this connection request/i)).toBeInTheDocument();
  });

  it('shows who is asking, the signed-in account, the access granted and the redirect host', async () => {
    await setup({ request: 'req-1' });

    expect(
      await screen.findByRole('heading', { name: /connect claude to board/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText(/see your boards, lists, tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/create, edit, move, assign and delete tasks/i)).toBeInTheDocument();
    expect(screen.getByText('claude.ai')).toBeInTheDocument();
    expect(screen.queryByText(/runs on your computer/i)).not.toBeInTheDocument();
  });

  it('warns when the redirect goes to a loopback address and falls back to the email as a name', async () => {
    await setup({
      request: 'req-1',
      user: { uid: 'u1', displayName: null, email: 'bob@example.com', photoURL: null },
      getRequest: () =>
        Promise.resolve(
          makeInfo({
            clientName: 'Claude Code',
            redirectHost: 'localhost',
            isLoopbackRedirect: true,
          }),
        ),
    });

    expect(await screen.findByText(/this app runs on your computer/i)).toBeInTheDocument();
    expect(screen.getByText('localhost')).toBeInTheDocument();
    // The email doubles as the display name when there is no display name.
    expect(screen.getAllByText('bob@example.com')).toHaveLength(2);
  });

  it('falls back to a generic account label when no user is available', async () => {
    await setup({ request: 'req-1', user: null });

    expect(await screen.findByText('Your account')).toBeInTheDocument();
    expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument();
  });

  it('approves the request and sends the browser to the returned redirect URL', async () => {
    const user = userEvent.setup();
    const decision = deferred<{ redirectUrl: string }>();
    const { service, assign } = await setup({
      request: 'req-1',
      decide: () => decision.promise,
    });

    await user.click(await screen.findByRole('button', { name: /allow/i }));

    expect(service.decide).toHaveBeenCalledWith('req-1', true);
    expect(screen.getByRole('button', { name: /allow/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    decision.resolve({ redirectUrl: 'https://claude.ai/cb?code=abc' });

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://claude.ai/cb?code=abc'));
    // Still busy: the browser is on its way out.
    expect(screen.getByRole('button', { name: /allow/i })).toBeDisabled();
  });

  it('denies the request and sends the browser back to the app', async () => {
    const user = userEvent.setup();
    const decision = deferred<{ redirectUrl: string }>();
    const { service, assign } = await setup({
      request: 'req-1',
      decide: () => decision.promise,
    });

    await user.click(await screen.findByRole('button', { name: /cancel/i }));

    expect(service.decide).toHaveBeenCalledWith('req-1', false);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    decision.resolve({ redirectUrl: 'https://claude.ai/cb?error=access_denied' });

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://claude.ai/cb?error=access_denied'),
    );
  });

  it('shows the expired message and re-enables the buttons when the decision finds the request gone', async () => {
    const user = userEvent.setup();
    const { assign } = await setup({
      request: 'req-1',
      decide: () => Promise.reject(functionsError('functions/not-found')),
    });

    await user.click(await screen.findByRole('button', { name: /allow/i }));

    expect(await screen.findByText(/expired or was already used/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /allow/i })).toBeEnabled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('shows a generic error when the decision fails for another reason', async () => {
    const user = userEvent.setup();
    await setup({
      request: 'req-1',
      decide: () => Promise.reject(functionsError('functions/internal')),
    });

    await user.click(await screen.findByRole('button', { name: /cancel/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
  });
});
