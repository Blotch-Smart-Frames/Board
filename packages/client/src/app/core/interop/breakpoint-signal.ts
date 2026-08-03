import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';

// Matches the source app's MUI `theme.breakpoints.down('md')` (900px) cutoff
// for the responsive drawer/toolbar — not Tailwind's own `md:` (768px), to
// preserve identical responsive behavior.
export const MOBILE_BREAKPOINT_QUERY = '(max-width: 899.98px)';

/** Reactive "is the viewport at/below the mobile breakpoint" signal. */
export function isMobileSignal(): Signal<boolean> {
  const breakpointObserver = inject(BreakpointObserver);
  return toSignal(breakpointObserver.observe(MOBILE_BREAKPOINT_QUERY).pipe(map((state) => state.matches)), {
    initialValue: breakpointObserver.isMatched(MOBILE_BREAKPOINT_QUERY),
  });
}
