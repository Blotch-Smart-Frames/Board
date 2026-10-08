import { computed, effect, linkedSignal, type Signal } from '@angular/core';

export interface ArrivalSource {
  /** Identity of the collection (e.g. board or task id). A new scope starts over with nothing fresh. */
  scope: string | null;
  /** Ids currently present, or `undefined` while loading. */
  ids: readonly string[] | undefined;
}

interface ArrivalState {
  scope: string | null;
  known: ReadonlySet<string> | null;
  fresh: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();

/** How long an id stays "fresh" — long enough to cover its entrance, short enough not to replay on a later re-render. */
export const ARRIVAL_WINDOW_MS = 1000;

/**
 * Tracks which ids genuinely just arrived in a live collection, so only those
 * items animate in. The first loaded snapshot of a scope is never fresh (no
 * page-load cascade), ids seen before stay known (a card dragged between lists
 * or re-shown by a filter doesn't replay), and each fresh set expires after
 * {@link ARRIVAL_WINDOW_MS}. Must be called in an injection context.
 */
export function arrivals(source: () => ArrivalSource): Signal<ReadonlySet<string>> {
  const state = linkedSignal<ArrivalSource, ArrivalState>({
    source,
    computation: ({ scope, ids }, previous) => {
      if (!ids) return { scope, known: null, fresh: NONE };
      const prior = previous?.value;
      if (!prior?.known || prior.scope !== scope) {
        return { scope, known: new Set(ids), fresh: NONE };
      }
      const known = prior.known;
      const fresh = ids.filter((id) => !known.has(id));
      return {
        scope,
        known: fresh.length ? new Set([...known, ...fresh]) : known,
        fresh: fresh.length ? new Set(fresh) : NONE,
      };
    },
  });

  // Reading state on every change (not only when something renders it) keeps each
  // snapshot diffed against the one before it, and expires the fresh set.
  effect((onCleanup) => {
    if (state().fresh.size === 0) return;
    const timer = setTimeout(() => state.update((s) => ({ ...s, fresh: NONE })), ARRIVAL_WINDOW_MS);
    onCleanup(() => clearTimeout(timer));
  });

  return computed(() => state().fresh);
}
