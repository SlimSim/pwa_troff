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

  it('applies ghost class when ghost property is set', async () => {
    element.ghost = true;
    await element.updateComplete;

    const button = element.shadowRoot?.querySelector('button') as HTMLElement;
    expect(button.classList.contains('ghost')).toBe(true);
  });
});

describe('t-butt keyboard modifier routing', () => {
  const created: TButt[] = [];

  const pressKey = (key: string, init: KeyboardEventInit = {}) => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    );
  };

  async function makeButt(opts: { key: string; shift?: boolean; alt?: boolean }) {
    const el = new TButt();
    el.key = opts.key;
    el.shift = opts.shift ?? false;
    el.alt = opts.alt ?? false;
    const clicks: Event[] = [];
    el.addEventListener('click', (e: Event) => clicks.push(e));
    document.body.appendChild(el);
    created.push(el);
    await el.updateComplete;
    return { el, clicks };
  }

  afterEach(() => {
    for (const el of created.splice(0)) {
      if (document.body.contains(el)) {
        document.body.removeChild(el);
      }
    }
    vi.restoreAllMocks();
  });

  it('plain button fires on plain key press', async () => {
    const { clicks } = await makeButt({ key: 'x' });
    pressKey('x');
    expect(clicks.length).toBe(1);
  });

  it('plain button does NOT fire on Shift+key', async () => {
    const { clicks } = await makeButt({ key: 'x' });
    pressKey('x', { shiftKey: true });
    expect(clicks.length).toBe(0);
  });

  it('plain button does NOT fire on Alt+key', async () => {
    const { clicks } = await makeButt({ key: 'x' });
    pressKey('x', { altKey: true });
    expect(clicks.length).toBe(0);
  });

  it('shift button fires on Shift+key', async () => {
    const { clicks } = await makeButt({ key: 'x', shift: true });
    pressKey('x', { shiftKey: true });
    expect(clicks.length).toBe(1);
  });

  it('shift button does NOT fire on plain key press', async () => {
    const { clicks } = await makeButt({ key: 'x', shift: true });
    pressKey('x');
    expect(clicks.length).toBe(0);
  });

  it('alt button fires on Alt+key', async () => {
    const { clicks } = await makeButt({ key: 'x', alt: true });
    pressKey('x', { altKey: true });
    expect(clicks.length).toBe(1);
  });

  it('alt button does NOT fire on plain key press', async () => {
    const { clicks } = await makeButt({ key: 'x', alt: true });
    pressKey('x');
    expect(clicks.length).toBe(0);
  });

  it('Ctrl/Meta must never trigger, even on plain button', async () => {
    const { clicks } = await makeButt({ key: 'x' });
    pressKey('x', { ctrlKey: true });
    pressKey('x', { metaKey: true });
    expect(clicks.length).toBe(0);
  });

  it('three buttons sharing one key: plain press triggers ONLY the plain button (exactly one click)', async () => {
    const plain = await makeButt({ key: 'b' });
    const withAlt = await makeButt({ key: 'b', alt: true });
    const withShift = await makeButt({ key: 'b', shift: true });
    pressKey('b');
    const total = plain.clicks.length + withAlt.clicks.length + withShift.clicks.length;
    expect(total).toBe(1);
    expect(plain.clicks.length).toBe(1);
    expect(withAlt.clicks.length).toBe(0);
    expect(withShift.clicks.length).toBe(0);
  });

  it('three buttons sharing one key: Shift+B triggers ONLY the shift button', async () => {
    const plain = await makeButt({ key: 'b' });
    const withAlt = await makeButt({ key: 'b', alt: true });
    const withShift = await makeButt({ key: 'b', shift: true });
    pressKey('b', { shiftKey: true });
    const total = plain.clicks.length + withAlt.clicks.length + withShift.clicks.length;
    expect(total).toBe(1);
    expect(withShift.clicks.length).toBe(1);
    expect(plain.clicks.length).toBe(0);
    expect(withAlt.clicks.length).toBe(0);
  });

  it('three buttons sharing one key: Alt+B triggers ONLY the alt button', async () => {
    const plain = await makeButt({ key: 'b' });
    const withAlt = await makeButt({ key: 'b', alt: true });
    const withShift = await makeButt({ key: 'b', shift: true });
    pressKey('b', { altKey: true });
    const total = plain.clicks.length + withAlt.clicks.length + withShift.clicks.length;
    expect(total).toBe(1);
    expect(withAlt.clicks.length).toBe(1);
    expect(plain.clicks.length).toBe(0);
    expect(withShift.clicks.length).toBe(0);
  });
});

describe('t-butt Shift+z prefix (zoom-out regression)', () => {
  const created: TButt[] = [];

  const pressKey = (key: string, init: KeyboardEventInit = {}) => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    );
  };

  async function makeZoomPair() {
    // Mirrors t-current-song-controls lines 449-450:
    // zoomOut button uses key "Shift+z", zoom button uses key "z".
    const zoomOut = new TButt();
    zoomOut.key = 'Shift+z';
    const zoomOutClicks: Event[] = [];
    zoomOut.addEventListener('click', (e: Event) => zoomOutClicks.push(e));
    document.body.appendChild(zoomOut);
    created.push(zoomOut);
    await zoomOut.updateComplete;

    const zoom = new TButt();
    zoom.key = 'z';
    const zoomClicks: Event[] = [];
    zoom.addEventListener('click', (e: Event) => zoomClicks.push(e));
    document.body.appendChild(zoom);
    created.push(zoom);
    await zoom.updateComplete;

    return { zoomOutClicks, zoomClicks };
  }

  afterEach(() => {
    for (const el of created.splice(0)) {
      if (document.body.contains(el)) {
        document.body.removeChild(el);
      }
    }
    vi.restoreAllMocks();
  });

  it('plain "z" triggers ONLY the zoom button (exactly one click)', async () => {
    const { zoomOutClicks, zoomClicks } = await makeZoomPair();
    pressKey('z');
    expect(zoomClicks.length).toBe(1);
    expect(zoomOutClicks.length).toBe(0);
  });

  it('Shift+Z triggers ONLY the zoom-out button (exactly one click)', async () => {
    const { zoomOutClicks, zoomClicks } = await makeZoomPair();
    pressKey('Z', { shiftKey: true });
    const total = zoomOutClicks.length + zoomClicks.length;
    expect(total).toBe(1);
    expect(zoomOutClicks.length).toBe(1);
    expect(zoomClicks.length).toBe(0);
  });
});
