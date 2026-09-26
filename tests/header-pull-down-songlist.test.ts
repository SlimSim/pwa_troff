import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Header } from '../components/molecule/t-header.js';

/**
 * Swipe down from header reveals songlist instead of browser reload (RED).
 *
 * Desired feature: pulling/swiping down from the `t-header` must NOT trigger
 * the browser's pull-to-refresh (app reload on mobile). Instead it must pull
 * the songlist down (open it) — i.e. expand the header, which is the existing
 * open path (`header-expand` with `{ expanded: true }` → v2Script sets
 * `songList.visible = true`).
 *
 * These tests import the REAL Header component (never a re-implementation)
 * and fail on current code because:
 *  - t-header has no touch/pointer pull-down handling at all (click-only),
 *  - its styles contain neither `overscroll-behavior` nor `touch-action`,
 *  - nothing calls `preventDefault()` on a downward swipe from the header.
 */

const containerOf = (el: Header): HTMLElement => {
  const container = el.shadowRoot?.querySelector('.header-container') as HTMLElement | null;
  if (!container) throw new Error('Expected shadow root to contain <.header-container>');
  return container;
};

const touchPoint = (clientY: number, clientX = 50) => ({ clientX, clientY, identifier: 1 });

/** Dispatch a synthetic TouchEvent-like (happy-dom has no Touch ctor). */
const dispatchTouch = (target: EventTarget, type: string, points: ReturnType<typeof touchPoint>[]) => {
  const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
  (event as unknown as Record<string, unknown>).touches = points;
  (event as unknown as Record<string, unknown>).changedTouches = points;
  (event as unknown as Record<string, unknown>).targetTouches = points;
  target.dispatchEvent(event);
  return event;
};

/** Pointer-event fallback (some implementations listen to pointer events). */
const dispatchPointer = (
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  clientY: number,
  clientX = 50
) => {
  const event = new PointerEvent(type, {
    pointerId: 1,
    pointerType: 'touch',
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX,
    clientY,
  });
  target.dispatchEvent(event);
  return event;
};

/** Simulate a downward pull gesture; tries touch, then pointer if untouched. */
const pullDown = (target: EventTarget) => {
  dispatchTouch(target, 'touchstart', [touchPoint(100)]);
  const move = dispatchTouch(target, 'touchmove', [touchPoint(180)]);
  dispatchTouch(target, 'touchend', []);
  return move;
};

describe('swipe down from header reveals songlist (no browser reload)', () => {
  let element: Header;

  beforeEach(() => {
    element = new Header();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('suppresses browser pull-to-refresh on pull-down from the header', async () => {
    await element.updateComplete;
    const container = containerOf(element);

    // Accept ANY of the standard suppression mechanisms:
    // (a) CSS opt-out on the header, or (b) preventDefault on the gesture.
    const cssText = String(
      (Header as unknown as { styles?: { cssText?: string } }).styles?.cssText ?? ''
    );
    const cssOptsOut =
      /overscroll-behavior\s*:\s*none/.test(cssText) || /touch-action\s*:/.test(cssText);

    const move = pullDown(container);

    expect(
      cssOptsOut || move.defaultPrevented,
      'pull-down from header must suppress pull-to-refresh via ' +
        'overscroll-behavior:none / touch-action / preventDefault() ' +
        `(cssOptsOut=${cssOptsOut}, defaultPrevented=${move.defaultPrevented})`
    ).toBe(true);
  });

  it('pulling down from the header expands it (opens the songlist via header-expand)', async () => {
    await element.updateComplete;
    expect(element.expanded).toBe(false);

    const expandSpy = vi.fn();
    element.addEventListener('header-expand', expandSpy);

    const container = containerOf(element);
    pullDown(container);
    // Pointer-event based implementations: one downward swipe as fallback.
    if (!element.expanded && expandSpy.mock.calls.length === 0) {
      dispatchPointer(container, 'pointerdown', 100);
      dispatchPointer(container, 'pointermove', 180);
      dispatchPointer(container, 'pointerup', 180);
    }
    await element.updateComplete;

    expect(element.expanded).toBe(true);
    expect(expandSpy).toHaveBeenCalled();
    const event = expandSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.expanded).toBe(true);
  });

  it('guard: swiping UP from the header does not expand it', async () => {
    await element.updateComplete;
    expect(element.expanded).toBe(false);

    const expandSpy = vi.fn();
    element.addEventListener('header-expand', expandSpy);

    const container = containerOf(element);
    dispatchTouch(container, 'touchstart', [touchPoint(200)]);
    dispatchTouch(container, 'touchmove', [touchPoint(120)]);
    dispatchTouch(container, 'touchend', []);
    await element.updateComplete;

    expect(element.expanded).toBe(false);
    expect(expandSpy).not.toHaveBeenCalled();
  });
});
