import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useBoardIdFromUrl } from './useBoardIdFromUrl';

describe('useBoardIdFromUrl', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/');
  });

  it('returns null when URL has no board path', () => {
    const { result } = renderHook(() => useBoardIdFromUrl());
    expect(result.current[0]).toBeNull();
  });

  it('parses boardId from /board/{id} URL', () => {
    history.replaceState(null, '', '/board/abc-123');
    const { result } = renderHook(() => useBoardIdFromUrl());
    expect(result.current[0]).toBe('abc-123');
  });

  it('returns null for non-board paths', () => {
    history.replaceState(null, '', '/terms.html');
    const { result } = renderHook(() => useBoardIdFromUrl());
    expect(result.current[0]).toBeNull();
  });

  it('returns null for /board/ with no id', () => {
    history.replaceState(null, '', '/board/');
    const { result } = renderHook(() => useBoardIdFromUrl());
    expect(result.current[0]).toBeNull();
  });

  it('returns null for nested board paths', () => {
    history.replaceState(null, '', '/board/abc/extra');
    const { result } = renderHook(() => useBoardIdFromUrl());
    expect(result.current[0]).toBeNull();
  });

  it('updates URL when setBoardId is called', () => {
    const { result } = renderHook(() => useBoardIdFromUrl());

    act(() => {
      result.current[1]('my-board');
    });

    expect(result.current[0]).toBe('my-board');
    expect(window.location.pathname).toBe('/board/my-board');
  });

  it('clears URL to / when setBoardId is called with null', () => {
    history.replaceState(null, '', '/board/abc-123');
    const { result } = renderHook(() => useBoardIdFromUrl());

    act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBeNull();
    expect(window.location.pathname).toBe('/');
  });

  it('does not push duplicate history entry for same boardId', () => {
    history.replaceState(null, '', '/board/abc-123');
    const { result } = renderHook(() => useBoardIdFromUrl());
    const lengthBefore = history.length;

    act(() => {
      result.current[1]('abc-123');
    });

    expect(history.length).toBe(lengthBefore);
  });

  it('reacts to popstate (back/forward navigation)', () => {
    const { result } = renderHook(() => useBoardIdFromUrl());

    act(() => {
      result.current[1]('board-1');
    });
    expect(result.current[0]).toBe('board-1');

    act(() => {
      result.current[1]('board-2');
    });
    expect(result.current[0]).toBe('board-2');

    // Simulate browser back by restoring previous URL and firing popstate
    // (history.back() is async in jsdom, so we simulate manually)
    act(() => {
      history.replaceState(null, '', '/board/board-1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current[0]).toBe('board-1');
  });
});
