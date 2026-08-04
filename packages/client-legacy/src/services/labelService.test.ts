import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({
  db: {},
}));

const mockAddDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockWriteBatch = vi.fn(() => ({
  update: vi.fn(),
  delete: vi.fn(),
  set: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
  writeBatch: () => mockWriteBatch(),
}));

describe('labelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createLabel', () => {
    it('creates a label and returns it', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockAddDoc.mockResolvedValue({ id: 'label-1' });
      mockGetDoc.mockResolvedValue({
        id: 'label-1',
        data: () => ({ name: 'Bug', color: '#EF4444' }),
      });

      const { createLabel } = await import('./labelService');
      const result = await createLabel('board-1', {
        name: 'Bug',
        color: '#EF4444',
      });

      expect(mockAddDoc).toHaveBeenCalled();
      expect(result.id).toBe('label-1');
      expect(result.name).toBe('Bug');
    });
  });

  describe('updateLabel', () => {
    it('calls updateDoc with updates', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const { updateLabel } = await import('./labelService');
      await updateLabel('board-1', 'label-1', { name: 'Updated' });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('deleteLabel', () => {
    it('removes label from tasks and deletes it', async () => {
      const batch = mockWriteBatch();
      mockWriteBatch.mockReturnValue(batch);

      mockGetDocs.mockResolvedValue({
        forEach: (cb: (doc: unknown) => void) => {
          cb({
            ref: {},
            data: () => ({ labelIds: ['label-1', 'label-2'] }),
          });
        },
      });

      const { deleteLabel } = await import('./labelService');
      await deleteLabel('board-1', 'label-1');

      expect(batch.update).toHaveBeenCalled();
      expect(batch.delete).toHaveBeenCalled();
      expect(batch.commit).toHaveBeenCalled();
    });
  });

  describe('getBoardLabels', () => {
    it('returns mapped labels', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'l1', data: () => ({ name: 'Bug', color: '#EF4444' }) },
          { id: 'l2', data: () => ({ name: 'Feature', color: '#3B82F6' }) },
        ],
      });

      const { getBoardLabels } = await import('./labelService');
      const result = await getBoardLabels('board-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('l1');
      expect(result[1].name).toBe('Feature');
    });
  });

  describe('initializeDefaultLabels', () => {
    it('returns existing labels when they exist', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [{ id: 'l1', data: () => ({ name: 'Existing', color: '#000' }) }],
      });

      const { initializeDefaultLabels } = await import('./labelService');
      const result = await initializeDefaultLabels('board-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Existing');
    });

    it('creates default labels when none exist', async () => {
      const batch = mockWriteBatch();
      mockWriteBatch.mockReturnValue(batch);

      // First call: getBoardLabels returns empty (no existing labels)
      // Second call: getBoardLabels returns created labels
      mockGetDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({
        docs: [{ id: 'l1', data: () => ({ name: 'Hot', color: '#EF4444' }) }],
      });

      const { initializeDefaultLabels } = await import('./labelService');
      const result = await initializeDefaultLabels('board-1');

      expect(batch.set).toHaveBeenCalled();
      expect(batch.commit).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
