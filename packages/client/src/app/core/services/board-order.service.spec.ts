import { TestBed } from '@angular/core/testing';
import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore';
import { FIRESTORE_DB } from '../firebase/firebase.config';
import { BoardOrderService } from './board-order.service';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => ({ path: args.slice(1).join('/') })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteField: vi.fn(() => 'DELETE'),
}));

describe('BoardOrderService', () => {
  let service: BoardOrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: FIRESTORE_DB, useValue: {} }],
    });
    service = TestBed.inject(BoardOrderService);
  });

  it('returns an empty map when no preferences doc exists', async () => {
    vi.mocked(getDoc).mockResolvedValue({ data: () => undefined } as never);

    expect(await service.getBoardOrder('u1')).toEqual({});
  });

  it('returns the stored boards order map', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      data: () => ({ boards: { 'board-1': 'a0' } }),
    } as never);

    expect(await service.getBoardOrder('u1')).toEqual({ 'board-1': 'a0' });
  });

  it('merges board order keys without touching siblings', async () => {
    await service.updatePreferences('u1', { boards: { 'board-1': 'a0', 'board-2': 'a1' } });

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'u1', 'preferences', 'boardOrder');
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { boards: { 'board-1': 'a0', 'board-2': 'a1' } },
      { merge: true },
    );
  });

  it('writes folder and membership changes in the same merge, deleting null entries', async () => {
    await service.updatePreferences('u1', {
      boards: { 'board-1': 'a0' },
      folders: { 'folder-1': { name: 'Work', order: 'a1' }, 'folder-2': null },
      boardFolders: { 'board-1': 'folder-1', 'board-2': null },
    });

    expect(deleteField).toHaveBeenCalledTimes(2);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      {
        boards: { 'board-1': 'a0' },
        folders: { 'folder-1': { name: 'Work', order: 'a1' }, 'folder-2': 'DELETE' },
        boardFolders: { 'board-1': 'folder-1', 'board-2': 'DELETE' },
      },
      { merge: true },
    );
  });

  it('omits sections the patch does not touch', async () => {
    await service.updatePreferences('u1', { folders: { 'folder-1': { collapsed: true } } });

    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { folders: { 'folder-1': { collapsed: true } } },
      { merge: true },
    );
  });
});
