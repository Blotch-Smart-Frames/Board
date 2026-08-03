import { signal } from '@angular/core';
import type { User as FirebaseUser } from 'firebase/auth';
import { render, screen } from '@testing-library/angular';
import { AuthStore } from '../../core/auth/auth.store';
import { DashboardStore } from './data/dashboard.store';
import { DashboardPage } from './dashboard-page';

function fakeStore(
  overrides: Partial<{
    boards: unknown[];
    isLoadingBoards: boolean;
    totalCount: number;
    openCount: number;
    answeredCount: number;
    urgentCount: number;
    statusBreakdown: unknown[];
    urgentTickets: unknown[];
    myUrgentTickets: unknown[];
    recentActivity: unknown[];
  }> = {},
) {
  const resolve = () => ({ id: '', email: '', name: 'Unknown', photoURL: null, isOwner: false });
  return {
    boards: signal(overrides.boards ?? []),
    isLoadingBoards: signal(overrides.isLoadingBoards ?? false),
    totalCount: signal(overrides.totalCount ?? 0),
    openCount: signal(overrides.openCount ?? 0),
    answeredCount: signal(overrides.answeredCount ?? 0),
    urgentCount: signal(overrides.urgentCount ?? 0),
    statusBreakdown: signal(overrides.statusBreakdown ?? []),
    urgentTickets: signal(overrides.urgentTickets ?? []),
    myUrgentTickets: signal(overrides.myUrgentTickets ?? []),
    recentActivity: signal(overrides.recentActivity ?? []),
    userDisplay: signal(resolve),
  };
}

function setup(
  opts: {
    user?: Partial<FirebaseUser> | null;
    store?: ReturnType<typeof fakeStore>;
  } = {},
) {
  const store = opts.store ?? fakeStore();
  return {
    store,
    providers: [
      { provide: AuthStore, useValue: { user: signal(opts.user ?? { displayName: 'Alice' }) } },
    ],
    // The dashboard page provides DashboardStore itself in its @Component metadata,
    // so overriding it there is the only way to inject a fake for the component.
    componentProviders: [{ provide: DashboardStore, useValue: store }],
  };
}

describe('DashboardPage', () => {
  it('greets the user by first name (splits on first space or @)', async () => {
    const { providers, componentProviders } = setup({
      user: { displayName: 'Alice Anderson', email: 'alice@example.com' } as FirebaseUser,
    });
    await render(DashboardPage, { providers, componentProviders });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alice');
  });

  it('falls back to the email local-part when no display name is set', async () => {
    const { providers, componentProviders } = setup({
      user: { displayName: null, email: 'charlie@example.com' } as unknown as FirebaseUser,
    });
    await render(DashboardPage, { providers, componentProviders });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('charlie');
  });

  it('shows the board count in singular form for exactly one board', async () => {
    const { providers, componentProviders } = setup({ store: fakeStore({ boards: [{}] }) });
    await render(DashboardPage, { providers, componentProviders });

    expect(screen.getByText(/Here's what's happening across/)).toHaveTextContent(
      /across\s+1\s+board\./,
    );
  });

  it('uses the plural form when there are multiple boards', async () => {
    const { providers, componentProviders } = setup({
      store: fakeStore({ boards: [{}, {}, {}] }),
    });
    await render(DashboardPage, { providers, componentProviders });

    expect(screen.getByText(/Here's what's happening across/)).toHaveTextContent(
      /across\s+3\s+boards\./,
    );
  });

  it('shows a spinner while the board list is loading and hides the grid', async () => {
    const { providers, componentProviders } = setup({
      store: fakeStore({ isLoadingBoards: true }),
    });
    await render(DashboardPage, { providers, componentProviders });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Total tickets')).not.toBeInTheDocument();
    expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
  });

  it('renders the four metric cards with the store’s counts once loaded', async () => {
    const { providers, componentProviders } = setup({
      store: fakeStore({
        totalCount: 12,
        openCount: 7,
        answeredCount: 5,
        urgentCount: 3,
      }),
    });
    await render(DashboardPage, { providers, componentProviders });

    expect(screen.getByText('Total tickets')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Answered')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it("populates the 'Total' hint from the open count", async () => {
    const { providers, componentProviders } = setup({
      store: fakeStore({ totalCount: 8, openCount: 5 }),
    });
    await render(DashboardPage, { providers, componentProviders });

    expect(screen.getByText('5 still open')).toBeInTheDocument();
  });
});
