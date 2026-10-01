import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Header } from '../components/molecule/t-header.js';

/**
 * Swipe UP on t-header closes the open songlist (RED on current code).
 *
 * Desired feature (mirror of the pull-down open path): when the songlist is
 * open (header `expanded=true`), an upward swipe on the header must close it
 * — i.e. set `expanded=false` and dispatch `header-expand` with
 * `{ expanded: false }` (v2Script already consumes that event to hide the list).
 *
 * These tests import the REAL Header (never a re-implementation, always .js
 * imports, no `any`) and follow the touch-dispatch + pointer-fallback and
 * ~50px threshold conventions from tests/header-pull-down-songlist.test.ts.
 *
 * Current code only handles swipe DOWN when closed (_expandFromPull returns
 * early if expanded; _handlePullMove ignores dy <= 0), so test 1 fails RED.
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

/** Pointer-event fallback (mirrors the header pull-down test). */
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

/** Upward swipe past threshold (80px > the ~50px convention). Touch sequence. */
const swipeUpTouch = (target: EventTarget) => {
  dispatchTouch(target, 'touchstart', [touchPoint(200)]);
  dispatchTouch(target, 'touchmove', [touchPoint(120)]);
  dispatchTouch(target, 'touchend', []);
};

/** Upward swipe past threshold via pointer events (fallback). */
const swipeUpPointer = (target: EventTarget) => {
  dispatchPointer(target, 'pointerdown', 200);
  dispatchPointer(target, 'pointermove', 120);
  dispatchPointer(target, 'pointerup', 120);
};

/** Swipe UP: try touch, then pointer if still untouched (header-pull-down style). */
const swipeUp = (target: EventTarget, isUntouched: () => boolean) => {
  swipeUpTouch(target);
  if (isUntouched()) {
    swipeUpPointer(target);
  }
};

/** Downward swipe past threshold via touch. */
const swipeDownTouch = (target: EventTarget) => {
  dispatchTouch(target, 'touchstart', [touchPoint(100)]);
  dispatchTouch(target, 'touchmove', [touchPoint(180)]);
  dispatchTouch(target, 'touchend', []);
};

/** Downward swipe past threshold via pointer events (fallback). */
const swipeDownPointer = (target: EventTarget) => {
  dispatchPointer(target, 'pointerdown', 100);
  dispatchPointer(target, 'pointermove', 180);
  dispatchPointer(target, 'pointerup', 180);
};

describe('swipe up on t-header closes the open songlist', () => {
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

  it('swipe UP when expanded closes (expanded=false, header-expand {expanded:false})', async () => {
    await element.updateComplete;
    element.expanded = true;
    await element.updateComplete;

    const expandSpy = vi.fn();
    element.addEventListener('header-expand', expandSpy);

    const container = containerOf(element);
    swipeUp(container, () => element.expanded && expandSpy.mock.calls.length === 0);
    await element.updateComplete;

    expect(element.expanded).toBe(false);
    expect(expandSpy).toHaveBeenCalled();
    const event = expandSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.expanded).toBe(false);
  });

  it('swipe UP when closed does nothing harmful (stays false, no header-expand)', async () => {
    await element.updateComplete;
    expect(element.expanded).toBe(false);

    const expandSpy = vi.fn();
    element.addEventListener('header-expand', expandSpy);

    const container = containerOf(element);
    // Touch primarily, then pointer fallback — neither may open or close.
    swipeUpTouch(container);
    await element.updateComplete;
    swipeUpPointer(container);
    await element.updateComplete;

    expect(element.expanded).toBe(false);
    expect(expandSpy).not.toHaveBeenCalled();
  });

  it('guard: small upward move below threshold does NOT close', async () => {
    await element.updateComplete;
    element.expanded = true;
    await element.updateComplete;

    const expandSpy = vi.fn();
    element.addEventListener('header-expand', expandSpy);

    const container = containerOf(element);
    // Only 20px upward — below the ~50px threshold convention.
    dispatchTouch(container, 'touchstart', [touchPoint(200)]);
    dispatchTouch(container, 'touchmove', [touchPoint(180)]);
    dispatchTouch(container, 'touchend', []);
    await element.updateComplete;
    // Same small move via pointer fallback.
    dispatchPointer(container, 'pointerdown', 200);
    dispatchPointer(container, 'pointermove', 180);
    dispatchPointer(container, 'pointerup', 180);
    await element.updateComplete;

    expect(element.expanded).toBe(true);
    expect(expandSpy).not.toHaveBeenCalled();
  });

  it('guard: swipe DOWN when already expanded does NOT toggle/close (stays true)', async () => {
    await element.updateComplete;
    element.expanded = true;
    await element.updateComplete;

    const expandSpy = vi.fn();
    element.addEventListener('header-expand', expandSpy);

    const container = containerOf(element);
    swipeDownTouch(container);
    await element.updateComplete;
    if (expandSpy.mock.calls.length === 0 && element.expanded) {
      swipeDownPointer(container);
      await element.updateComplete;
    }

    expect(element.expanded).toBe(true);
    expect(expandSpy).not.toHaveBeenCalled();
  });

  it('symmetric guard: swipe DOWN when closed still opens (existing behavior preserved)', async () => {
    await element.updateComplete;
    expect(element.expanded).toBe(false);

    const expandSpy = vi.fn();
    element.addEventListener('header-expand', expandSpy);

    const container = containerOf(element);
    swipeDownTouch(container);
    await element.updateComplete;
    // Pointer-event based implementations: one downward swipe as fallback.
    if (!element.expanded && expandSpy.mock.calls.length === 0) {
      swipeDownPointer(container);
      await element.updateComplete;
    }
    await element.updateComplete;

    expect(element.expanded).toBe(true);
    expect(expandSpy).toHaveBeenCalled();
    const event = expandSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.expanded).toBe(true);
  });
});
