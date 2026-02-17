import { useSyncExternalStore, useCallback } from 'react';

const BOARD_PATH_REGEX = /^\/board\/([^/]+)$/;
const PUSHSTATE_EVENT = 'pushstate';

function parseBoardId(): string | null {
  const match = window.location.pathname.match(BOARD_PATH_REGEX);
  return match ? match[1] : null;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('popstate', callback);
  window.addEventListener(PUSHSTATE_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(PUSHSTATE_EVENT, callback);
  };
}

export function useBoardIdFromUrl(): [
  string | null,
  (boardId: string | null) => void,
] {
  const boardId = useSyncExternalStore(subscribe, parseBoardId);

  const setBoardId = useCallback((newBoardId: string | null) => {
    const currentBoardId = parseBoardId();
    if (newBoardId === currentBoardId) return;

    const path = newBoardId ? `/board/${newBoardId}` : '/';
    history.pushState(null, '', path);
    window.dispatchEvent(new Event(PUSHSTATE_EVENT));
  }, []);

  return [boardId, setBoardId];
}
