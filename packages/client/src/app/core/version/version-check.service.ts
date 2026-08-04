import { Service, computed, inject, DestroyRef } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, from, interval, of, startWith, switchMap } from 'rxjs';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

async function fetchVersion(): Promise<string | null> {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const data = (await response.json()) as { buildHash?: string };
    return data.buildHash ?? null;
  } catch {
    return null;
  }
}

/**
 * Polls /version.json every 5 minutes and exposes hasNewVersion when the
 * remote hash differs from the build-stamped __BUILD_HASH__. Uses toSignal over
 * an interval-driven observable rather than a setInterval-inside-effect so
 * teardown is handled automatically by takeUntilDestroyed — the same idiom the
 * current-time-line component uses for its clock tick.
 */
@Service()
export class VersionCheckService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly remoteHash = toSignal(
    interval(POLL_INTERVAL_MS).pipe(
      startWith(0),
      switchMap(() => from(fetchVersion()).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(this.destroyRef),
    ),
    { initialValue: null as string | null },
  );

  readonly hasNewVersion = computed(() => {
    const hash = this.remoteHash();
    return !!hash && hash !== __BUILD_HASH__;
  });
}
