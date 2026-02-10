import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Board } from './Board';
import type { Board as BoardType, List, Task } from '../../types/board';
import { Timestamp } from 'firebase/firestore';

// Mock TaskDialog to avoid DatePicker import issues
vi.mock('./TaskDialog', () => ({
  TaskDialog: () => null,
}));

// Mock @mui/x-date-pickers
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
const mockUseBoardQuery = vi.fn();
const mockUseCalendarSync = vi.fn();
const mockUseDragAndDrop = vi.fn();

vi.mock('../../hooks/useBoardQuery', () => ({
  useBoardQuery: () => mockUseBoardQuery(),
}));

vi.mock('../../hooks/useCalendarSync', () => ({
  useCalendarSync: () => mockUseCalendarSync(),
}));

vi.mock('../../hooks/useLabelsQuery', () => ({
  useLabelsQuery: () => ({
    labels: [],
    isLoading: false,
    createLabel: vi.fn(),
    updateLabel: vi.fn(),
    deleteLabel: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDragAndDrop', () => ({
  useDragAndDrop: () => mockUseDragAndDrop(),
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

const createMockBoard = (overrides: Partial<BoardType> = {}): BoardType => ({
  id: 'board-1',
  title: 'Test Board',
  ownerId: 'user-1',
  collaborators: [],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

const createMockList = (overrides: Partial<List> = {}): List => ({
  id: 'list-1',
  title: 'Test List',
  order: 0,
  createdAt: Timestamp.now(),
  ...overrides,
});

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  listId: 'list-1',
  title: 'Test Task',
  order: 0,
  calendarSyncEnabled: false,
  createdBy: 'user-1',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

describe('Board', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseDragAndDrop.mockReturnValue({
      activeId: null,
      getActiveTask: () => null,
      handleDragStart: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragEnd: vi.fn(),
    });

    mockUseCalendarSync.mockReturnValue({
      syncTaskToCalendar: vi.fn(),
    });
  });

  it('shows loading state', () => {
    mockUseBoardQuery.mockReturnValue({
      board: null,
      lists: [],
      tasks: [],
      isLoading: true,
      error: null,
      addList: vi.fn(),
      updateList: vi.fn(),
      deleteList: vi.fn(),
      addTask: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      moveTask: vi.fn(),
    });

    render(<Board boardId="board-1" />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error alert on error', () => {
    mockUseBoardQuery.mockReturnValue({
      board: null,
      lists: [],
      tasks: [],
      isLoading: false,
      error: 'Failed to load board',
      addList: vi.fn(),
      updateList: vi.fn(),
      deleteList: vi.fn(),
      addTask: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      moveTask: vi.fn(),
    });

    render(<Board boardId="board-1" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load board')).toBeInTheDocument();
  });

  it('shows not found message when board is null', () => {
    mockUseBoardQuery.mockReturnValue({
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
    });

    render(<Board boardId="board-1" />);

    expect(screen.getByText('Board not found')).toBeInTheDocument();
  });

  it('renders board title', () => {
    const board = createMockBoard({ title: 'My Board' });
    mockUseBoardQuery.mockReturnValue({
      board,
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
    });

    render(<Board boardId="board-1" />);

    expect(
      screen.getByRole('heading', { name: 'My Board' }),
    ).toBeInTheDocument();
  });

  it('renders all lists', () => {
    const board = createMockBoard();
    const lists = [
      createMockList({ id: 'list-1', title: 'To Do', order: 0 }),
      createMockList({ id: 'list-2', title: 'In Progress', order: 1 }),
      createMockList({ id: 'list-3', title: 'Done', order: 2 }),
    ];

    mockUseBoardQuery.mockReturnValue({
      board,
      lists,
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
    });

    render(<Board boardId="board-1" />);

    expect(screen.getByRole('heading', { name: 'To Do' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'In Progress' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument();
  });

  it('shows add list button', () => {
    const board = createMockBoard();
    mockUseBoardQuery.mockReturnValue({
      board,
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
    });

    render(<Board boardId="board-1" />);

    expect(
      screen.getByRole('button', { name: /add another list/i }),
    ).toBeInTheDocument();
  });

  it('renders tasks within their lists', () => {
    const board = createMockBoard();
    const lists = [createMockList({ id: 'list-1', title: 'To Do' })];
    const tasks = [
      createMockTask({ id: 'task-1', listId: 'list-1', title: 'Task 1' }),
      createMockTask({ id: 'task-2', listId: 'list-1', title: 'Task 2' }),
    ];

    mockUseBoardQuery.mockReturnValue({
      board,
      lists,
      tasks,
      isLoading: false,
      error: null,
      addList: vi.fn(),
      updateList: vi.fn(),
      deleteList: vi.fn(),
      addTask: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      moveTask: vi.fn(),
    });

    render(<Board boardId="board-1" />);

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('sorts lists by order', () => {
    const board = createMockBoard();
    const lists = [
      createMockList({ id: 'list-2', title: 'Second', order: 1 }),
      createMockList({ id: 'list-1', title: 'First', order: 0 }),
      createMockList({ id: 'list-3', title: 'Third', order: 2 }),
    ];

    mockUseBoardQuery.mockReturnValue({
      board,
      lists,
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
    });

    render(<Board boardId="board-1" />);

    const headings = screen.getAllByRole('heading', { level: 2 });
    const titles = headings.map((h) => h.textContent);

    expect(titles).toEqual(['First', 'Second', 'Third']);
  });
});
