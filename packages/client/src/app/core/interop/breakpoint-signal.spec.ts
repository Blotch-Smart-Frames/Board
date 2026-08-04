import { TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import {
  MOBILE_BREAKPOINT_QUERY,
  TOUCH_POINTER_QUERY,
  isMobileSignal,
  isTouchOrMobileSignal,
} from './breakpoint-signal';

describe('MOBILE_BREAKPOINT_QUERY', () => {
  // Guardrail against silent drift from the source app's MUI md-down breakpoint.
  it('matches the source app MUI md-down cutoff (899.98px)', () => {
    expect(MOBILE_BREAKPOINT_QUERY).toBe('(max-width: 899.98px)');
  });
});

describe('TOUCH_POINTER_QUERY', () => {
  it('targets coarse-pointer (touch) devices', () => {
    expect(TOUCH_POINTER_QUERY).toBe('(pointer: coarse)');
  });
});

describe('isMobileSignal', () => {
  // Subject (not BehaviorSubject) so we can observe the pre-emission seed value.
  let breakpoints$: Subject<{ matches: boolean }>;
  let breakpointObserver: {
    observe: ReturnType<typeof vi.fn>;
    isMatched: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    breakpoints$ = new Subject<{ matches: boolean }>();
    breakpointObserver = {
      observe: vi.fn(() => breakpoints$.asObservable()),
      isMatched: vi.fn(() => false),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: BreakpointObserver, useValue: breakpointObserver }],
    });
  });

  it('seeds the signal from BreakpointObserver.isMatched to avoid a first-tick flip', () => {
    breakpointObserver.isMatched.mockReturnValue(true);
    const isMobile = TestBed.runInInjectionContext(() => isMobileSignal());
    expect(isMobile()).toBe(true);
    expect(breakpointObserver.isMatched).toHaveBeenCalledWith(MOBILE_BREAKPOINT_QUERY);
  });

  it('observes MOBILE_BREAKPOINT_QUERY on the CDK observer', () => {
    TestBed.runInInjectionContext(() => isMobileSignal());
    expect(breakpointObserver.observe).toHaveBeenCalledWith(MOBILE_BREAKPOINT_QUERY);
  });

  it('reflects later matches emissions from the observer', async () => {
    const isMobile = TestBed.runInInjectionContext(() => isMobileSignal());
    TestBed.flushEffects();

    breakpoints$.next({ matches: true });
    TestBed.flushEffects();
    await Promise.resolve();
    expect(isMobile()).toBe(true);

    breakpoints$.next({ matches: false });
    TestBed.flushEffects();
    await Promise.resolve();
    expect(isMobile()).toBe(false);
  });
});

describe('isTouchOrMobileSignal', () => {
  let breakpoints$: Subject<{ matches: boolean }>;
  let breakpointObserver: {
    observe: ReturnType<typeof vi.fn>;
    isMatched: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    breakpoints$ = new Subject<{ matches: boolean }>();
    breakpointObserver = {
      observe: vi.fn(() => breakpoints$.asObservable()),
      isMatched: vi.fn(() => false),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: BreakpointObserver, useValue: breakpointObserver }],
    });
  });

  it('observes both the mobile breakpoint and coarse-pointer queries together', () => {
    TestBed.runInInjectionContext(() => isTouchOrMobileSignal());
    expect(breakpointObserver.observe).toHaveBeenCalledWith([
      MOBILE_BREAKPOINT_QUERY,
      TOUCH_POINTER_QUERY,
    ]);
  });

  it('seeds from BreakpointObserver.isMatched using the combined query set', () => {
    breakpointObserver.isMatched.mockReturnValue(true);
    const disabled = TestBed.runInInjectionContext(() => isTouchOrMobileSignal());
    expect(disabled()).toBe(true);
    expect(breakpointObserver.isMatched).toHaveBeenCalledWith([
      MOBILE_BREAKPOINT_QUERY,
      TOUCH_POINTER_QUERY,
    ]);
  });

  it('reflects later matches emissions (either query matching flips the signal true)', async () => {
    const disabled = TestBed.runInInjectionContext(() => isTouchOrMobileSignal());
    TestBed.flushEffects();

    breakpoints$.next({ matches: true });
    TestBed.flushEffects();
    await Promise.resolve();
    expect(disabled()).toBe(true);

    breakpoints$.next({ matches: false });
    TestBed.flushEffects();
    await Promise.resolve();
    expect(disabled()).toBe(false);
  });
});
