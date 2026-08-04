import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';

// Matches the source app's MUI `theme.breakpoints.down('md')` (900px) cutoff
// for the responsive drawer/toolbar — not Tailwind's own `md:` (768px), to
// preserve identical responsive behavior.
export const MOBILE_BREAKPOINT_QUERY = '(max-width: 899.98px)';

// Touch-primary devices (finger, stylus) — catches tablets in landscape that
// exceed the mobile viewport cutoff but still conflict with native touch scroll
// when drag-and-drop is active.
export const TOUCH_POINTER_QUERY = '(pointer: coarse)';

/** Reactive "is the viewport at/below the mobile breakpoint" signal. */
export function isMobileSignal(): Signal<boolean> {
  const breakpointObserver = inject(BreakpointObserver);
  return toSignal(
    breakpointObserver.observe(MOBILE_BREAKPOINT_QUERY).pipe(map((state) => state.matches)),
    {
      initialValue: breakpointObserver.isMatched(MOBILE_BREAKPOINT_QUERY),
    },
  );
}

// True whenever drag-and-drop should be suppressed to avoid fighting native
// touch scroll — either the viewport is at the mobile breakpoint or the primary
// pointer is coarse. `BreakpointObserver.observe([...])` emits a match when ANY
// of the supplied queries match, which is the semantic we want.
export function isTouchOrMobileSignal(): Signal<boolean> {
  const breakpointObserver = inject(BreakpointObserver);
  const queries = [MOBILE_BREAKPOINT_QUERY, TOUCH_POINTER_QUERY];
  return toSignal(breakpointObserver.observe(queries).pipe(map((state) => state.matches)), {
    initialValue: breakpointObserver.isMatched(queries),
  });
}
