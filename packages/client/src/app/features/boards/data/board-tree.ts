import type {
  BoardFolderData,
  BoardPreferences,
  BoardPreferencesPatch,
} from '../../../core/services/board-order.service';
import { compareOrder, getOrderAtEnd } from '../../../shared/utils/ordering';
import type { Board } from '../../../shared/types/board';

export type BoardWithOrder = Board & { order?: string };

export interface BoardFolder {
  id: string;
  name: string;
  order: string;
  collapsed: boolean;
}

export interface BoardNode {
  kind: 'board';
  id: string;
  board: Board & { order: string };
  folderId: string | null;
}

export interface FolderNode {
  kind: 'folder';
  id: string;
  folder: BoardFolder;
  boards: BoardNode[];
}

/** A top-level sidebar entry: a folder (with its boards) or a board outside any folder. */
export type SidebarNode = BoardNode | FolderNode;

export const orderOf = (node: SidebarNode): string =>
  node.kind === 'board' ? node.board.order : node.folder.order;

/** Mirrors Firestore's merge semantics locally, so pending writes can be shown optimistically. */
export function applyPreferencesPatch(
  preferences: BoardPreferences,
  patch: BoardPreferencesPatch,
): BoardPreferences {
  const folders = { ...preferences.folders };
  for (const [id, change] of Object.entries(patch.folders ?? {})) {
    if (change === null) delete folders[id];
    else folders[id] = { ...folders[id], ...change } as BoardFolderData;
  }

  const boardFolders = { ...preferences.boardFolders };
  for (const [id, folderId] of Object.entries(patch.boardFolders ?? {})) {
    if (folderId === null) delete boardFolders[id];
    else boardFolders[id] = folderId;
  }

  return { boards: { ...preferences.boards, ...patch.boards }, folders, boardFolders };
}

// Boards without a stored key (empty order) get an "at the end" key synthesized
// on every render, then each level is sorted by key.
function sortLevel<T extends SidebarNode>(nodes: T[]): T[] {
  for (const node of nodes) {
    if (node.kind === 'board' && !node.board.order) {
      node.board.order = getOrderAtEnd(nodes.map((n) => ({ order: orderOf(n) })));
    }
  }
  return nodes.sort((a, b) => compareOrder(orderOf(a), orderOf(b)));
}

/**
 * Arranges boards into the sidebar's folder tree. A board pointing at a folder
 * that no longer exists falls back to the root rather than disappearing.
 */
export function buildSidebarTree(boards: Board[], preferences: BoardPreferences): SidebarNode[] {
  const folders = new Map<string, FolderNode>();
  for (const [id, data] of Object.entries(preferences.folders ?? {})) {
    // A partial entry (e.g. a collapse toggle racing a delete on another device)
    // isn't a usable folder; its boards fall back to the root.
    if (typeof data.name !== 'string' || typeof data.order !== 'string') continue;
    folders.set(id, {
      kind: 'folder',
      id,
      folder: { id, name: data.name, order: data.order, collapsed: data.collapsed ?? false },
      boards: [],
    });
  }

  const root: SidebarNode[] = [...folders.values()];
  for (const board of boards) {
    const folder = folders.get(preferences.boardFolders?.[board.id] ?? '');
    const node: BoardNode = {
      kind: 'board',
      id: board.id,
      board: { ...board, order: preferences.boards?.[board.id] ?? '' },
      folderId: folder?.id ?? null,
    };
    (folder?.boards ?? root).push(node);
  }

  for (const folder of folders.values()) sortLevel(folder.boards);
  return sortLevel(root);
}

/** The sidebar's boards in on-screen order, folders flattened in place. */
export function flattenSidebarTree(nodes: SidebarNode[]): BoardWithOrder[] {
  return nodes.flatMap((node) =>
    node.kind === 'board' ? [node.board] : node.boards.map((child) => child.board),
  );
}
