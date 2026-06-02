import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TButt } from './t-butt.js';

describe('t-butt confirm behavior', () => {
  let element: TButt;

  beforeEach(() => {
    element = new TButt();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('without confirm, click propagates to parent handler', async () => {
    await element.updateComplete;

    const clickSpy = vi.fn();
    element.addEventListener('click', clickSpy);

    const button = element.shadowRoot?.querySelector('button') as HTMLElement;
    button.click();
    await element.updateComplete;

    expect(clickSpy).toHaveBeenCalled();
  });

  it('with confirm, first click does NOT trigger parent handler', async () => {
    (element as any).confirm = true;
    await element.updateComplete;

    const clickSpy = vi.fn();
    element.addEventListener('click', clickSpy);

    const button = element.shadowRoot?.querySelector('button') as HTMLElement;
    button.click();
    await element.updateComplete;

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('with confirm, second click DOES trigger parent handler', async () => {
    (element as any).confirm = true;
    await element.updateComplete;

    const clickSpy = vi.fn();
    element.addEventListener('click', clickSpy);

    const button = element.shadowRoot?.querySelector('button') as HTMLElement;
    // First click — enters confirming state (intercepted)
    button.click();
    await element.updateComplete;
    // Second click — should bubble to parent handler
    button.click();
    await element.updateComplete;

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('confirming state shows confirmText instead of slot', async () => {
    (element as any).confirm = true;
    await element.updateComplete;

    const button = element.shadowRoot?.querySelector('button') as HTMLElement;
    button.click();
    await element.updateComplete;

    const confirmText = element.shadowRoot?.querySelector('.confirm-text');
    expect(confirmText).toBeTruthy();
    expect(confirmText?.textContent).toBe('Are you sure?');
  });

  it('Escape cancels confirming state and next click enters confirming again', async () => {
    (element as any).confirm = true;
    await element.updateComplete;

    const button = element.shadowRoot?.querySelector('button') as HTMLElement;
    button.click();
    await element.updateComplete;

    // Verify we are in confirming state
    expect(element.shadowRoot?.querySelector('.confirm-text')).toBeTruthy();

    // Escape should cancel confirming
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escapeEvent);
    await element.updateComplete;

    // Confirm-text should be gone
    expect(element.shadowRoot?.querySelector('.confirm-text')).toBeFalsy();

    // Click again — should enter confirming state again, NOT fire parent
    const clickSpy = vi.fn();
    element.addEventListener('click', clickSpy);
    button.click();
    await element.updateComplete;

    // Should be in confirming state again
    expect(element.shadowRoot?.querySelector('.confirm-text')).toBeTruthy();
    // Parent handler should NOT have been called
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('custom confirmText is displayed', async () => {
    (element as any).confirm = true;
    (element as any).confirmText = 'Delete this?';
    await element.updateComplete;

    const button = element.shadowRoot?.querySelector('button') as HTMLElement;
    button.click();
    await element.updateComplete;

    const confirmText = element.shadowRoot?.querySelector('.confirm-text');
    expect(confirmText).toBeTruthy();
    expect(confirmText?.textContent).toBe('Delete this?');
  });

  it('timeout auto-cancels confirming state', async () => {
    vi.useFakeTimers();

    (element as any).confirm = true;
    await element.updateComplete;

    const button = element.shadowRoot?.querySelector('button') as HTMLElement;
    button.click();
    await element.updateComplete;

    // Confirm we entered confirming state
    expect(element.shadowRoot?.querySelector('.confirm-text')).toBeTruthy();

    // Advance past the 3-second auto-cancel
    vi.advanceTimersByTime(3000);
    await element.updateComplete;

    // State should be reset — no confirm-text visible
    expect(element.shadowRoot?.querySelector('.confirm-text')).toBeFalsy();

    // Click again — should enter confirming state again, NOT fire parent handler
    const clickSpy = vi.fn();
    element.addEventListener('click', clickSpy);
    button.click();
    await element.updateComplete;

    // Should be in confirming state again
    expect(element.shadowRoot?.querySelector('.confirm-text')).toBeTruthy();
    // Parent handler should NOT have been called
    expect(clickSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('after timeout cancel, second click in new confirm cycle fires parent handler', async () => {
    vi.useFakeTimers();

    (element as any).confirm = true;
    await element.updateComplete;

    const button = element.shadowRoot?.querySelector('button') as HTMLElement;
    button.click(); // first click — enter confirming
    await element.updateComplete;
    vi.advanceTimersByTime(3000); // timeout cancels
    await element.updateComplete;

    // New confirm cycle: click once to enter confirming
    button.click();
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('.confirm-text')).toBeTruthy();

    // Second click should fire parent handler
    const clickSpy = vi.fn();
    element.addEventListener('click', clickSpy);
    button.click();
    await element.updateComplete;

    expect(clickSpy).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
