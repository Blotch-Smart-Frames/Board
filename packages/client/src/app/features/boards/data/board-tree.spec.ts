import type { Timestamp } from 'firebase/firestore';
import type { Board } from '../../../shared/types/board';
import {
  applyPreferencesPatch,
  buildSidebarTree,
  flattenSidebarTree,
  type FolderNode,
} from './board-tree';

function board(id: string): Board {
  return {
    id,
    title: id,
    ownerId: 'u1',
    collaborators: [],
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
  };
}

describe('applyPreferencesPatch', () => {
  it('merges board keys, folder fields and memberships, removing null entries', () => {
    const result = applyPreferencesPatch(
      {
        boards: { a: 'a0', b: 'a1' },
        folders: { f1: { name: 'Work', order: 'a2' }, f2: { name: 'Old', order: 'a3' } },
        boardFolders: { a: 'f1', b: 'f2' },
      },
      {
        boards: { b: 'a5' },
        folders: { f1: { collapsed: true }, f2: null, f3: { name: 'New', order: 'a4' } },
        boardFolders: { a: null, b: 'f3' },
      },
    );

    expect(result).toEqual({
      boards: { a: 'a0', b: 'a5' },
      folders: {
        f1: { name: 'Work', order: 'a2', collapsed: true },
        f3: { name: 'New', order: 'a4' },
      },
      boardFolders: { b: 'f3' },
    });
  });

  it('starts from empty maps when the preferences doc has none', () => {
    expect(applyPreferencesPatch({}, {})).toEqual({ boards: {}, folders: {}, boardFolders: {} });
  });
});

describe('buildSidebarTree', () => {
  it('interleaves folders and loose boards by order, nesting filed boards', () => {
    const tree = buildSidebarTree([board('a'), board('b'), board('c'), board('d')], {
      boards: { a: 'a0', b: 'a3', c: 'a1', d: 'a0' },
      folders: { f1: { name: 'Work', order: 'a2', collapsed: true } },
      boardFolders: { c: 'f1', d: 'f1' },
    });

    expect(tree.map((node) => node.id)).toEqual(['a', 'f1', 'b']);
    const folder = tree[1] as FolderNode;
    expect(folder.folder).toEqual({ id: 'f1', name: 'Work', order: 'a2', collapsed: true });
    expect(folder.boards.map((node) => node.id)).toEqual(['d', 'c']);
    expect(folder.boards.every((node) => node.folderId === 'f1')).toBe(true);
  });

  it('defaults folders to expanded', () => {
    const tree = buildSidebarTree([], { folders: { f1: { name: 'Work', order: 'a0' } } });

    expect((tree[0] as FolderNode).folder.collapsed).toBe(false);
  });

  it('synthesizes trailing keys for boards without a stored order', () => {
    const tree = buildSidebarTree([board('new'), board('a')], {
      boards: { a: 'a0' },
      folders: { f1: { name: 'Work', order: 'a1' } },
    });

    expect(tree.map((node) => node.id)).toEqual(['a', 'f1', 'new']);
    expect(tree[2].kind === 'board' && tree[2].board.order > 'a1').toBe(true);
  });

  it('falls back to the root for boards in a missing or partial folder', () => {
    const tree = buildSidebarTree([board('a'), board('b')], {
      boards: { a: 'a0', b: 'a1' },
      // f2 only has a stray collapse flag (e.g. toggled while deleted elsewhere).
      folders: { f2: { collapsed: true } as never },
      boardFolders: { a: 'gone', b: 'f2' },
    });

    expect(tree.map((node) => [node.kind, node.id])).toEqual([
      ['board', 'a'],
      ['board', 'b'],
    ]);
    expect(tree.every((node) => node.kind === 'board' && node.folderId === null)).toBe(true);
  });
});

describe('flattenSidebarTree', () => {
  it('lists boards in on-screen order with folder contents in place', () => {
    const tree = buildSidebarTree([board('a'), board('b'), board('c')], {
      boards: { a: 'a0', b: 'a2', c: 'a0' },
      folders: { f1: { name: 'Work', order: 'a1' } },
      boardFolders: { c: 'f1' },
    });

    expect(flattenSidebarTree(tree).map((b) => b.id)).toEqual(['a', 'c', 'b']);
  });
});
