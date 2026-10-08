import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { arrivals, ARRIVAL_WINDOW_MS } from './arrivals';

function setup(initial: { scope: string | null; ids: string[] | undefined }) {
  const scope = signal(initial.scope);
  const ids = signal(initial.ids);
  const fresh = TestBed.runInInjectionContext(() =>
    arrivals(() => ({ scope: scope(), ids: ids() })),
  );
  const settle = () => TestBed.tick();
  return { scope, ids, fresh, settle };
}

describe('arrivals', () => {
  afterEach(() => vi.useRealTimers());

  it('treats the first loaded snapshot as already known', () => {
    const { ids, fresh, settle } = setup({ scope: 'b1', ids: undefined });
    settle();
    expect(fresh().size).toBe(0);

    ids.set(['a', 'b']);
    settle();
    expect(fresh().size).toBe(0);
  });

  it('reports ids added after the first snapshot', () => {
    const { ids, fresh, settle } = setup({ scope: 'b1', ids: ['a'] });
    settle();

    ids.set(['a', 'b']);
    settle();

    expect([...fresh()]).toEqual(['b']);
  });

  it('keeps previously seen ids known when they disappear and come back', () => {
    const { ids, fresh, settle } = setup({ scope: 'b1', ids: ['a', 'b'] });
    settle();

    ids.set(['a']);
    settle();
    ids.set(['a', 'b']);
    settle();

    expect(fresh().size).toBe(0);
  });

  it('starts over when the scope changes or the source reloads', () => {
    const { scope, ids, fresh, settle } = setup({ scope: 'b1', ids: ['a'] });
    settle();

    scope.set('b2');
    ids.set(['x', 'y']);
    settle();
    expect(fresh().size).toBe(0);

    ids.set(undefined);
    settle();
    ids.set(['x', 'y', 'z']);
    settle();
    expect(fresh().size).toBe(0);
  });

  it('notices an arrival even when nothing read the previous snapshot', () => {
    const { ids, fresh, settle } = setup({ scope: 'b1', ids: [] });
    settle();

    ids.set(['a']);
    settle();
    ids.set(['a', 'b']);
    settle();

    expect([...fresh()]).toEqual(['b']);
  });

  it('expires the fresh set after the arrival window', () => {
    vi.useFakeTimers();
    const { ids, fresh, settle } = setup({ scope: 'b1', ids: ['a'] });
    settle();

    ids.set(['a', 'b']);
    settle();
    expect(fresh().has('b')).toBe(true);

    vi.advanceTimersByTime(ARRIVAL_WINDOW_MS);
    expect(fresh().size).toBe(0);

    // A later snapshot still diffs against everything seen so far.
    ids.set(['a', 'b', 'c']);
    settle();
    expect([...fresh()]).toEqual(['c']);
  });
});
