import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Firebase config module before importing boardService
vi.mock('../config/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  googleProvider: { addScope: vi.fn() },
}));

// Mock the labelService to avoid Firestore calls during board creation
vi.mock('./labelService', () => ({
  initializeDefaultLabels: vi.fn().mockResolvedValue([]),
}));

// Mock all Firestore functions
const mockAddDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockWriteBatch = vi.fn(() => ({
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  serverTimestamp: vi.fn(() => new Date()),
  writeBatch: () => mockWriteBatch(),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
}));

describe('boardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBoard', () => {
    it('should call addDoc and return board data', async () => {
      const mockBoardData = {
        id: 'board-123',
        title: 'Test Board',
        ownerId: 'user-1',
        collaborators: [],
      };

      mockAddDoc.mockResolvedValue({ id: mockBoardData.id });
      mockGetDoc.mockResolvedValue({
        id: mockBoardData.id,
        exists: () => true,
        data: () => mockBoardData,
      });

      const { createBoard } = await import('./boardService');
      const result = await createBoard({ title: 'Test Board' }, 'user-1');

      expect(mockAddDoc).toHaveBeenCalled();
      expect(result.title).toBe('Test Board');
      expect(result.id).toBe('board-123');
    });
  });

  describe('getBoard', () => {
    it('should return null when board does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const { getBoard } = await import('./boardService');
      const result = await getBoard('non-existent');

      expect(result).toBeNull();
    });

    it('should return board data when it exists', async () => {
      const mockBoard = {
        id: 'board-1',
        title: 'My Board',
        ownerId: 'user-1',
        collaborators: [],
      };

      mockGetDoc.mockResolvedValue({
        id: mockBoard.id,
        exists: () => true,
        data: () => mockBoard,
      });

      const { getBoard } = await import('./boardService');
      const result = await getBoard('board-1');

      expect(result).not.toBeNull();
      expect(result?.title).toBe('My Board');
    });
  });

  describe('updateBoard', () => {
    it('should call updateDoc', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const { updateBoard } = await import('./boardService');
      await updateBoard('board-1', { title: 'Updated Title' });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('addList', () => {
    it('should create list with correct order', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      mockAddDoc.mockResolvedValue({ id: 'list-1' });

      mockGetDoc.mockResolvedValue({
        id: 'list-1',
        exists: () => true,
        data: () => ({
          id: 'list-1',
          title: 'New List',
          order: 0,
        }),
      });

      const { addList } = await import('./boardService');
      const result = await addList('board-1', { title: 'New List' });

      expect(mockAddDoc).toHaveBeenCalled();
      expect(result.order).toBe(0);
    });
  });

  describe('addTask', () => {
    it('should create task with correct parameters', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      mockAddDoc.mockResolvedValue({ id: 'task-1' });

      mockGetDoc.mockResolvedValue({
        id: 'task-1',
        exists: () => true,
        data: () => ({
          id: 'task-1',
          listId: 'list-1',
          title: 'New Task',
          order: 0,
          calendarSyncEnabled: false,
          createdBy: 'user-1',
        }),
      });

      const { addTask } = await import('./boardService');
      const result = await addTask(
        'board-1',
        'list-1',
        { title: 'New Task' },
        'user-1',
      );

      expect(mockAddDoc).toHaveBeenCalled();
      expect(result.title).toBe('New Task');
      expect(result.listId).toBe('list-1');
    });
  });
});
