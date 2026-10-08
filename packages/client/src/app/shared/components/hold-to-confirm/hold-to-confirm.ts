import { DestroyRef, Directive, inject, input, output, signal } from '@angular/core';

/**
 * Press-and-hold guard for irreversible actions. `confirmed` fires only after
 * the pointer (or Enter/Space) has been held for `holdDuration` ms; releasing
 * early cancels. While held the host gets `data-holding`, which drives a
 * `.hold-to-confirm-fill` child (see styles.css) as a progress fill.
 *
 * Assistive tech activates buttons with a synthetic click (`detail === 0`) that
 * has no press to hold, so that path confirms directly.
 */
@Directive({
  selector: '[appHoldToConfirm]',
  host: {
    '[attr.data-holding]': 'holding() ? "" : null',
    '[style.--hold-duration]': 'holdDuration() + "ms"',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'cancel()',
    '(pointerleave)': 'cancel()',
    '(pointercancel)': 'cancel()',
    '(keydown)': 'onKeyDown($event)',
    '(keyup)': 'onKeyUp($event)',
    '(blur)': 'cancel()',
    '(click)': 'onClick($event)',
    // A touch long-press would otherwise open the context menu mid-hold.
    '(contextmenu)': '$event.preventDefault()',
  },
})
export class HoldToConfirm {
  readonly holdDuration = input(2000);
  readonly confirmed = output<void>();

  protected readonly holding = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button === 0) this.start();
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (!isActivationKey(event)) return;
    // Suppress the native keyboard click so only a completed hold confirms.
    event.preventDefault();
    if (!event.repeat) this.start();
  }

  protected onKeyUp(event: KeyboardEvent): void {
    if (!isActivationKey(event)) return;
    event.preventDefault();
    this.cancel();
  }

  protected onClick(event: MouseEvent): void {
    if (event.detail === 0 && !this.holding()) this.confirmed.emit();
  }

  protected cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.holding.set(false);
  }

  private start(): void {
    if (this.holding()) return;
    this.holding.set(true);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.holding.set(false);
      this.confirmed.emit();
    }, this.holdDuration());
  }
}

function isActivationKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' ';
}
