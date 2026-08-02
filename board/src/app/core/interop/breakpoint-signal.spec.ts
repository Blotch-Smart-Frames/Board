import { TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import { MOBILE_BREAKPOINT_QUERY, isMobileSignal } from './breakpoint-signal';

describe('MOBILE_BREAKPOINT_QUERY', () => {
  // Guardrail against silent drift from the source app's MUI md-down breakpoint.
  it('matches the source app MUI md-down cutoff (899.98px)', () => {
    expect(MOBILE_BREAKPOINT_QUERY).toBe('(max-width: 899.98px)');
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
