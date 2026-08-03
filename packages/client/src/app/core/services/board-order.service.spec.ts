import { TestBed } from '@angular/core/testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FIRESTORE_DB } from '../firebase/firebase.config';
import { BoardOrderService } from './board-order.service';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => ({ path: args.slice(1).join('/') })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
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

  it('merges a single board order key without touching siblings', async () => {
    await service.setBoardOrder('u1', 'board-2', 'a1');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'u1', 'preferences', 'boardOrder');
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { boards: { 'board-2': 'a1' } },
      { merge: true },
    );
  });
});
