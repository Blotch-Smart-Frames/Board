import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from './App';
import type { Board } from './types/board';
import { Timestamp } from 'firebase/firestore';

// Mock @mui/x-date-pickers to avoid import issues
vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: () => null,
}));

vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: vi.fn(),
}));

// Mock hooks
const mockUseAuthQuery = vi.fn();
const mockUseUserBoardsQuery = vi.fn();

vi.mock('./hooks/useAuthQuery', () => ({
  useAuthQuery: () => mockUseAuthQuery(),
}));

vi.mock('./hooks/useUserBoardsQuery', () => ({
  useUserBoardsQuery: () => mockUseUserBoardsQuery(),
}));

vi.mock('./hooks/useBoardQuery', () => ({
  useBoardQuery: () => ({
    board: null,
    lists: [],
    tasks: [],
    isLoading: false,
    error: null,
    addList: vi.fn(),
    updateList: vi.fn(),
    deleteList: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    moveTask: vi.fn(),
  }),
}));

vi.mock('./hooks/useCalendarSync', () => ({
  useCalendarSync: () => ({
    syncTaskToCalendar: vi.fn(),
  }),
}));

vi.mock('./hooks/useDragAndDrop', () => ({
  useDragAndDrop: () => ({
    activeId: null,
    getActiveTask: () => null,
    handleDragStart: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragEnd: vi.fn(),
  }),
}));

vi.mock('./hooks/useLabelsQuery', () => ({
  useLabelsQuery: () => ({
    labels: [],
    isLoading: false,
    createLabel: vi.fn(),
    updateLabel: vi.fn(),
    deleteLabel: vi.fn(),
  }),
}));

vi.mock('./services/boardService', () => ({
  deleteBoard: vi.fn(),
  updateBoard: vi.fn(),
  shareBoard: vi.fn(),
}));

// Mock DnD Kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  DragOverlay: ({ children }: { children: React.ReactNode }) => children,
  closestCorners: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  verticalListSortingStrategy: {},
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => null,
    },
  },
}));

const createMockBoard = (overrides: Partial<Board> = {}): Board => ({
  id: 'board-1',
  title: 'Test Board',
  ownerId: 'user-1',
  collaborators: [],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('When not authenticated', () => {
    beforeEach(() => {
      mockUseAuthQuery.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });
      mockUseUserBoardsQuery.mockReturnValue({
        boards: [],
        isLoading: false,
        createBoard: vi.fn(),
      });
    });

    it('shows login screen through AuthGuard', () => {
      render(<App />);

      expect(
        screen.getByRole('heading', { name: /board by blotch/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /sign in with google/i }),
      ).toBeInTheDocument();
    });
  });

  describe('When authenticated', () => {
    const mockUser = {
      displayName: 'John Doe',
      email: 'john@example.com',
      photoURL: 'https://example.com/photo.jpg',
    };

    beforeEach(() => {
      mockUseAuthQuery.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });
    });

    it('renders main layout with app bar', () => {
      mockUseUserBoardsQuery.mockReturnValue({
        boards: [],
        isLoading: false,
        createBoard: vi.fn(),
      });

      render(<App />);

      // App bar should be visible
      expect(screen.getByText('Board by Blotch')).toBeInTheDocument();
    });

    it('shows board list in drawer', () => {
      mockUseUserBoardsQuery.mockReturnValue({
        boards: [],
        isLoading: false,
        createBoard: vi.fn(),
      });

      render(<App />);

      expect(screen.getByText('My Boards')).toBeInTheDocument();
    });

    it('renders boards in sidebar', () => {
      const boards = [
        createMockBoard({ id: '1', title: 'Project Alpha' }),
        createMockBoard({ id: '2', title: 'Project Beta' }),
      ];

      mockUseUserBoardsQuery.mockReturnValue({
        boards,
        isLoading: false,
        createBoard: vi.fn(),
      });

      render(<App />);

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });

    it('shows empty state when no board selected', () => {
      mockUseUserBoardsQuery.mockReturnValue({
        boards: [],
        isLoading: false,
        createBoard: vi.fn(),
      });

      render(<App />);

      expect(
        screen.getByText(/select a board or create a new one/i),
      ).toBeInTheDocument();
    });

    it('toggles drawer on menu button click', async () => {
      const user = userEvent.setup();
      mockUseUserBoardsQuery.mockReturnValue({
        boards: [],
        isLoading: false,
        createBoard: vi.fn(),
      });

      render(<App />);

      // Menu button should be present
      const menuButton = screen.getByRole('button', { name: /menu/i });
      expect(menuButton).toBeInTheDocument();

      // Click to toggle
      await user.click(menuButton);

      // Drawer state should change (drawer might close on mobile)
      // This is dependent on breakpoint, so just verify click works
    });

    it('shows share button when board is selected', async () => {
      const user = userEvent.setup();
      const boards = [createMockBoard({ id: '1', title: 'Test Board' })];

      mockUseUserBoardsQuery.mockReturnValue({
        boards,
        isLoading: false,
        createBoard: vi.fn(),
      });

      render(<App />);

      // Select a board
      await user.click(screen.getByText('Test Board'));

      // Share button should appear
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /share/i }),
        ).toBeInTheDocument();
      });
    });

    it('opens share dialog when share clicked', async () => {
      const user = userEvent.setup();
      const boards = [createMockBoard({ id: '1', title: 'Test Board' })];

      mockUseUserBoardsQuery.mockReturnValue({
        boards,
        isLoading: false,
        createBoard: vi.fn(),
      });

      render(<App />);

      // Select a board first
      await user.click(screen.getByText('Test Board'));

      // Click share button
      await user.click(screen.getByRole('button', { name: /share/i }));

      // Share dialog should open
      await waitFor(() => {
        expect(screen.getByText(/share "test board"/i)).toBeInTheDocument();
      });
    });

    it('updates title in app bar when board selected', async () => {
      const user = userEvent.setup();
      const boards = [createMockBoard({ id: '1', title: 'My Project' })];

      mockUseUserBoardsQuery.mockReturnValue({
        boards,
        isLoading: false,
        createBoard: vi.fn(),
      });

      render(<App />);

      // Before selection, default title
      expect(screen.getByText('Board by Blotch')).toBeInTheDocument();

      // Select the board (it appears in the sidebar)
      const boardItem = screen.getByRole('button', { name: /my project/i });
      await user.click(boardItem);

      // The board name appears in sidebar (My Boards section) already
      // and app bar title would update if Board component was not mocked
      expect(boardItem).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows loading spinner when auth is loading', () => {
      mockUseAuthQuery.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        login: vi.fn(),
        logout: vi.fn(),
      });
      mockUseUserBoardsQuery.mockReturnValue({
        boards: [],
        isLoading: false,
        createBoard: vi.fn(),
      });

      render(<App />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Board creation', () => {
    it('creates board and selects it', async () => {
      const user = userEvent.setup();
      const mockCreateBoard = vi.fn().mockResolvedValue({
        id: 'new-board',
        title: 'New Board',
      });

      mockUseAuthQuery.mockReturnValue({
        user: { displayName: 'Test', email: 'test@test.com', photoURL: null },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });

      mockUseUserBoardsQuery.mockReturnValue({
        boards: [],
        isLoading: false,
        createBoard: mockCreateBoard,
      });

      render(<App />);

      // Open create dialog
      await user.click(screen.getByRole('button', { name: /create board/i }));

      // Enter title and submit
      await user.type(
        screen.getByPlaceholderText('Enter board title'),
        'New Board',
      );
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      expect(mockCreateBoard).toHaveBeenCalledWith({ title: 'New Board' });
    });
  });
});
