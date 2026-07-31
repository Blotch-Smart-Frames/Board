import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { onSnapshot } from 'firebase/firestore';
import { FIRESTORE_DB } from '../../core/firebase/firebase.config';
import { AuthStore } from '../../core/auth/auth.store';
import { ThemeService } from '../../core/theme/theme.service';
import { UserService } from '../../core/services/user.service';
import { UserBoardsStore } from '../../features/boards/data/user-boards.store';
import { BoardWorkspace } from './board-workspace';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'collection', path: segments.join('/') })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ type: 'query', ref, constraints })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  onSnapshot: vi.fn(() => vi.fn()),
}));

function stubMatchMedia(matches = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      // CDK's BreakpointObserver still uses the legacy MediaQueryList API.
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

function commonProviders(boardId: string | null) {
  return [
    provideRouter([]),
    { provide: FIRESTORE_DB, useValue: {} },
    { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(boardId ? { boardId } : {})) } },
    { provide: AuthStore, useValue: { user: signal({ uid: 'u1' }) } },
    { provide: ThemeService, useValue: { mode: signal('system'), setMode: vi.fn() } },
    {
      provide: UserBoardsStore,
      useValue: { boards: signal([]), isLoading: signal(false), createBoard: vi.fn(), renameBoard: vi.fn(), deleteBoard: vi.fn() },
    },
  ];
}

describe('BoardWorkspace', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the empty state when no board is selected', async () => {
    stubMatchMedia();
    await render(BoardWorkspace, { providers: commonProviders(null) });

    expect(screen.getByText(/select a board or create a new one/i)).toBeInTheDocument();
  });

  it('shows a loading spinner while the selected board resolves', async () => {
    stubMatchMedia();
    await render(BoardWorkspace, { providers: commonProviders('board-1') });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows "board not found" once loading settles with no board', async () => {
    stubMatchMedia();
    vi.mocked(onSnapshot).mockImplementation((_ref: unknown, onNext: unknown) => {
      (onNext as (snapshot: unknown) => void)({ exists: () => false });
      return vi.fn();
    });

    await render(BoardWorkspace, { providers: commonProviders('missing-board') });

    expect(await screen.findByText('Board not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to boards/i })).toHaveAttribute('href', '/');
  });

  it('renders the kanban board by default and switches to the timeline view', async () => {
    const user = userEvent.setup();
    stubMatchMedia();
    const callbacks = new Map<string, (snapshot: unknown) => void>();
    vi.mocked(onSnapshot).mockImplementation((ref: unknown, onNext: unknown) => {
      const path =
        (ref as { path?: string }).path ?? (ref as { ref: { path: string } }).ref.path;
      callbacks.set(path, onNext as (snapshot: unknown) => void);
      return vi.fn();
    });

    await render(BoardWorkspace, {
      providers: [
        ...commonProviders('board-1'),
        { provide: UserService, useValue: { getUsersByIds: vi.fn().mockResolvedValue([]) } },
      ],
    });

    callbacks.get('boards/board-1')!({
      exists: () => true,
      id: 'board-1',
      data: () => ({ title: 'My Board', ownerId: 'u1', collaborators: [] }),
    });

    expect(await screen.findByRole('button', { name: /add another list/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /timeline view/i }));

    expect(await screen.findByText(/no lists in this board/i)).toBeInTheDocument();
  });

  it('toggles the desktop sidebar via the app bar menu button', async () => {
    const user = userEvent.setup();
    stubMatchMedia(false); // desktop
    await render(BoardWorkspace, { providers: commonProviders(null) });

    expect(document.querySelector('aside')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'menu' }));

    expect(document.querySelector('aside')).toBeNull();
  });
});
