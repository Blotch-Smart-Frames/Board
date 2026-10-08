import { Component } from '@angular/core';
import { fireEvent, render, screen } from '@testing-library/angular';
import { HoldToConfirm } from './hold-to-confirm';

@Component({
  imports: [HoldToConfirm],
  template: `
    <button type="button" appHoldToConfirm [holdDuration]="1000" (confirmed)="onConfirmed()">
      <span class="hold-to-confirm-fill"></span>
      Hold to delete
    </button>
  `,
})
class Host {
  confirmedCount = 0;
  onConfirmed(): void {
    this.confirmedCount++;
  }
}

async function setup() {
  const view = await render(Host);
  const button = screen.getByRole('button', { name: 'Hold to delete' });
  const host = view.fixture.componentInstance;
  return { view, button, host };
}

describe('HoldToConfirm', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('confirms after the pointer is held for the full duration', async () => {
    const { view, button, host } = await setup();

    fireEvent.pointerDown(button, { button: 0 });
    view.fixture.detectChanges();
    expect(button).toHaveAttribute('data-holding');
    expect(button.style.getPropertyValue('--hold-duration')).toBe('1000ms');

    vi.advanceTimersByTime(999);
    expect(host.confirmedCount).toBe(0);

    vi.advanceTimersByTime(1);
    view.fixture.detectChanges();
    expect(host.confirmedCount).toBe(1);
    expect(button).not.toHaveAttribute('data-holding');
  });

  it.each(['pointerUp', 'pointerLeave', 'pointerCancel', 'blur'] as const)(
    'cancels when %s happens before the hold completes',
    async (eventName) => {
      const { view, button, host } = await setup();

      fireEvent.pointerDown(button, { button: 0 });
      vi.advanceTimersByTime(500);
      fireEvent[eventName](button);
      view.fixture.detectChanges();
      vi.advanceTimersByTime(1000);

      expect(host.confirmedCount).toBe(0);
      expect(button).not.toHaveAttribute('data-holding');
    },
  );

  it('ignores non-primary pointer buttons', async () => {
    const { button, host } = await setup();

    fireEvent.pointerDown(button, { button: 2 });
    vi.advanceTimersByTime(1000);

    expect(host.confirmedCount).toBe(0);
  });

  it('confirms when Enter or Space is held, ignoring key repeat', async () => {
    const { button, host } = await setup();

    fireEvent.keyDown(button, { key: 'Enter' });
    vi.advanceTimersByTime(500);
    fireEvent.keyDown(button, { key: 'Enter', repeat: true });
    vi.advanceTimersByTime(500);
    expect(host.confirmedCount).toBe(1);

    fireEvent.keyDown(button, { key: ' ' });
    vi.advanceTimersByTime(1000);
    expect(host.confirmedCount).toBe(2);
  });

  it('cancels when the key is released early and ignores unrelated keys', async () => {
    const { button, host } = await setup();

    fireEvent.keyDown(button, { key: 'Enter' });
    vi.advanceTimersByTime(500);
    fireEvent.keyUp(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: 'a' });
    fireEvent.keyUp(button, { key: 'a' });
    vi.advanceTimersByTime(1000);

    expect(host.confirmedCount).toBe(0);
  });

  it('confirms immediately on an assistive-tech click (detail 0), but not on a pointer click', async () => {
    const { button, host } = await setup();

    fireEvent.click(button, { detail: 1 });
    expect(host.confirmedCount).toBe(0);

    fireEvent.click(button, { detail: 0 });
    expect(host.confirmedCount).toBe(1);
  });

  it('does not double-confirm from a click while a hold is in progress', async () => {
    const { button, host } = await setup();

    fireEvent.pointerDown(button, { button: 0 });
    fireEvent.click(button, { detail: 0 });

    expect(host.confirmedCount).toBe(0);
  });

  it('suppresses the context menu so a touch long-press can complete', async () => {
    const { button } = await setup();

    expect(fireEvent.contextMenu(button)).toBe(false);
  });

  it('clears a pending hold when destroyed', async () => {
    const { view, button, host } = await setup();

    fireEvent.pointerDown(button, { button: 0 });
    view.fixture.destroy();
    vi.advanceTimersByTime(1000);

    expect(host.confirmedCount).toBe(0);
  });
});
