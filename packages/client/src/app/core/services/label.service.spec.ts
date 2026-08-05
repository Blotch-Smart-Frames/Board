import { TestBed } from '@angular/core/testing';
import { addDoc, getDoc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { FIRESTORE_DB } from '../firebase/firebase.config';
import { LabelService } from './label.service';

function fakeBatch() {
  return {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
}

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  doc: vi.fn((_collectionOrDb: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn((collectionRef: unknown, ...constraints: unknown[]) => ({
    collectionRef,
    constraints,
  })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  writeBatch: vi.fn(),
}));

describe('LabelService', () => {
  let service: LabelService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: FIRESTORE_DB, useValue: {} }] });
    service = TestBed.inject(LabelService);
  });

  describe('createLabel', () => {
    it('places a new label after all existing labels', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [{ data: () => ({ order: 'a0' }) }],
      } as never);
      vi.mocked(addDoc).mockResolvedValue({ id: 'label-2' } as never);
      vi.mocked(getDoc).mockResolvedValue({
        id: 'label-2',
        data: () => ({ name: 'Hot', color: '#EF4444', order: 'a1' }),
      } as never);

      const label = await service.createLabel('board-1', { name: 'Hot', color: '#EF4444' });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'Hot', color: '#EF4444', emoji: null }),
      );
      const [, payload] = vi.mocked(addDoc).mock.calls[0];
      expect((payload as { order: string }).order > 'a0').toBe(true);
      expect(label).toEqual({ id: 'label-2', name: 'Hot', color: '#EF4444', order: 'a1' });
    });
  });

  describe('updateLabel', () => {
    it('merges updates and stamps updatedAt', async () => {
      await service.updateLabel('board-1', 'label-1', { name: 'Renamed' });

      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        name: 'Renamed',
        updatedAt: 'SERVER_TIMESTAMP',
      });
    });
  });

  describe('deleteLabel', () => {
    it('strips the label from every task that referenced it, then deletes the label', async () => {
      const batch = fakeBatch();
      vi.mocked(writeBatch).mockReturnValue(batch as never);
      const taskDocRef = { id: 'task-1' };
      vi.mocked(getDocs).mockResolvedValue({
        docs: [{ ref: taskDocRef, data: () => ({ labelIds: ['label-1', 'label-2'] }) }],
      } as never);

      await service.deleteLabel('board-1', 'label-1');

      expect(batch.update).toHaveBeenCalledWith(
        taskDocRef,
        expect.objectContaining({ labelIds: ['label-2'] }),
      );
      expect(batch.delete).toHaveBeenCalledTimes(1);
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it('treats a matched task with no labelIds field as an empty list', async () => {
      const batch = fakeBatch();
      vi.mocked(writeBatch).mockReturnValue(batch as never);
      const taskDocRef = { id: 'task-1' };
      vi.mocked(getDocs).mockResolvedValue({
        docs: [{ ref: taskDocRef, data: () => ({}) }],
      } as never);

      await service.deleteLabel('board-1', 'label-1');

      expect(batch.update).toHaveBeenCalledWith(
        taskDocRef,
        expect.objectContaining({ labelIds: [] }),
      );
    });
  });

  describe('initializeDefaultLabels', () => {
    it('returns existing labels without writing when the board already has labels', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [{ id: 'l1', data: () => ({ name: 'Existing', order: 'a0' }) }],
      } as never);

      const labels = await service.initializeDefaultLabels('board-1');

      expect(labels).toEqual([{ id: 'l1', name: 'Existing', order: 'a0' }]);
      expect(writeBatch).not.toHaveBeenCalled();
    });

    it('seeds all default labels with increasing order when the board has none', async () => {
      const batch = fakeBatch();
      vi.mocked(writeBatch).mockReturnValue(batch as never);
      vi.mocked(getDocs)
        .mockResolvedValueOnce({ docs: [] } as never) // initial empty check
        .mockResolvedValueOnce({
          docs: [{ id: 'l1', data: () => ({ name: 'Hot', order: 'a0' }) }],
        } as never); // re-fetch after seeding

      const labels = await service.initializeDefaultLabels('board-1');

      expect(batch.set).toHaveBeenCalledTimes(6);
      const orders = batch.set.mock.calls.map(
        ([, payload]) => (payload as { order: string }).order,
      );
      const sorted = [...orders].sort();
      expect(orders).toEqual(sorted);
      expect(new Set(orders).size).toBe(6);
      expect(batch.commit).toHaveBeenCalledTimes(1);
      expect(labels).toEqual([{ id: 'l1', name: 'Hot', order: 'a0' }]);
    });
  });
});
