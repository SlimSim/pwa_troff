import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from '../components/molecule/t-media-parent.js';
import { MediaFooter } from '../components/molecule/t-media-footer.js';
import type { TroffFirebaseGroupIdentifyer } from '../types/troff.js';

/**
 * Swipe up from t-media-footer closes the visible songlist (RED on current).
 *
 * Desired feature (mirror of the header pull-down open path): when the
 * songlist (`t-media-parent` with `visible = true`) is open, an upward swipe
 * starting from the `t-media-footer` must close it — i.e. go through the
 * existing close path (`visible = false` → `song-list-closed` event, which
 * v2Script consumes to collapse the header).
 *
 * These tests import the REAL MediaParent + MediaFooter (never a
 * re-implementation, always .js imports, no `any`, unknown casts only).
 *
 * After move of swipe handlers into t-media-footer (on its inner .footer-container,
 * mirroring t-header), the parent only listens for the emitted composed
 * 'footer-swipe-up' custom event (which crosses the shadow boundary) and
 * calls _handleFooterSwipeUp (which does the if(visible) close).
 *
 * This test now spies on the REAL footer-internal handlers (shadow-scoped).
 * Realistic NON-CROSSING (composed:false) dispatches to the inner container
 * now reach the footer's @touch/@pointer listeners inside its shadow, so
 * start/move/end are called, threshold emits the custom event, parent closes.
 *
 * Gesture convention mirrors t-header: upward swipe = clientY decrease past
 * ~50px threshold; both Touch and Pointer sequences tried.
 *
 * Keep the two guard tests unchanged in intent.
 */

const touchPoint = (clientY: number, clientX = 50) => ({ clientX, clientY, identifier: 1 });

/**
 * Dispatch a synthetic TouchEvent-like (happy-dom has no Touch ctor).
 * Use composed: false to simulate REAL native events originating INSIDE
 * t-media-footer's shadow DOM (on .footer-container). These reach the
 * handlers attached inside the shadow; the emitted custom event crosses out.
 */
const dispatchTouch = (target: EventTarget, type: string, points: ReturnType<typeof touchPoint>[]) => {
  const event = new Event(type, { bubbles: true, cancelable: true, composed: false });
  (event as unknown as Record<string, unknown>).touches = points;
  (event as unknown as Record<string, unknown>).changedTouches = points;
  (event as unknown as Record<string, unknown>).targetTouches = points;
  target.dispatchEvent(event);
  return event;
};

/**
 * Pointer-event fallback.
 * composed: false; dispatches originate inside footer's shadow and reach
 * its internal handlers (which then emit a composed custom event).
 */
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
    composed: false,
    clientX,
    clientY,
  });
  target.dispatchEvent(event);
  return event;
};

/** Upward swipe past threshold (80px > the ~50px convention from t-header). */
const swipeUp = (target: EventTarget) => {
  dispatchTouch(target, 'touchstart', [touchPoint(200)]);
  dispatchTouch(target, 'touchmove', [touchPoint(120)]);
  dispatchTouch(target, 'touchend', []);
};

/** Pointer-based upward swipe (fallback for pointer-based implementations). */
const swipeUpPointer = (target: EventTarget) => {
  dispatchPointer(target, 'pointerdown', 200);
  dispatchPointer(target, 'pointermove', 120);
  dispatchPointer(target, 'pointerup', 120);
};

/** Downward swipe — must NOT close the list. */
const swipeDown = (target: EventTarget) => {
  dispatchTouch(target, 'touchstart', [touchPoint(100)]);
  dispatchTouch(target, 'touchmove', [touchPoint(180)]);
  dispatchTouch(target, 'touchend', []);
};

describe('swipe up from t-media-footer closes the visible songlist', () => {
  let element: MediaParent;
  let footerStartSpy: ReturnType<typeof vi.spyOn>;
  let footerMoveSpy: ReturnType<typeof vi.spyOn>;
  let footerEndSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Skip the async _loadSongs() from connectedCallback; populate state
    // directly so the component renders without touching Cache/nDB.
    vi.spyOn(
      MediaParent.prototype as unknown as { _loadSongs: () => Promise<void> },
      '_loadSongs'
    ).mockResolvedValue(undefined);
    // Neutralize the close-triggered scroll timer (setTimeout 350ms) so it
    // cannot outlive the test and pollute happy-dom teardown.
    vi.spyOn(
      MediaParent.prototype as unknown as { _scrollActiveSongIntoView: () => void },
      '_scrollActiveSongIntoView'
    ).mockImplementation(() => {});

    element = new MediaParent();
    document.body.appendChild(element);

    (element as unknown as { songs: Array<{ songKey: string; title: string }> }).songs = [
      { songKey: 'a', title: 'Tango' },
    ];
    (element as unknown as { groups: TroffFirebaseGroupIdentifyer[] }).groups = [];
    element.currentFilter = 'tracks';

    // Ensure footer is rendered (reusing footerGestureTarget logic + await)
    // then spy on its REAL internal handlers (the shadow-scoped ones on
    // .footer-container). These are the correct ones now that handlers live
    // inside t-media-footer (parent only reacts to the emitted custom event).
    await footerGestureTarget();
    const footerEl = element.shadowRoot?.querySelector('t-media-footer') as
      | (MediaFooter & { shadowRoot: ShadowRoot })
      | null;
    expect(footerEl, 'expected a real <t-media-footer> inside <t-media-parent>').not.toBeNull();
    expect(footerEl instanceof MediaFooter).toBe(true);

    footerStartSpy = vi.spyOn(
      footerEl as unknown as {
        _handleFooterSwipeStart: (e: Event) => void;
        _handleFooterSwipeMove: (e: Event) => void;
        _handleFooterSwipeEnd: () => void;
      },
      '_handleFooterSwipeStart'
    );
    footerMoveSpy = vi.spyOn(
      footerEl as unknown as {
        _handleFooterSwipeStart: (e: Event) => void;
        _handleFooterSwipeMove: (e: Event) => void;
        _handleFooterSwipeEnd: () => void;
      },
      '_handleFooterSwipeMove'
    );
    footerEndSpy = vi.spyOn(
      footerEl as unknown as {
        _handleFooterSwipeStart: (e: Event) => void;
        _handleFooterSwipeMove: (e: Event) => void;
        _handleFooterSwipeEnd: () => void;
      },
      '_handleFooterSwipeEnd'
    );

    // Re-render after spying so Lit re-evaluates the template expressions
    // and binds the (now-spied) handler functions to the inner container.
    footerEl!.requestUpdate();
    await footerEl!.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  /**
    * Gesture origin: the inner .footer-container of the REAL t-media-footer.
    * We dispatch with composed:false to simulate native events originating
    * inside the footer's shadow DOM. These now correctly reach the handlers
    * that are attached inside the shadow (on the container itself).
    */
  async function footerGestureTarget(): Promise<EventTarget> {
    await element.updateComplete;
    const footer = element.shadowRoot?.querySelector('t-media-footer') as
      | (MediaFooter & { shadowRoot: ShadowRoot })
      | null;
    expect(footer, 'expected a real <t-media-footer> inside <t-media-parent>').not.toBeNull();
    expect(footer instanceof MediaFooter).toBe(true);
    await footer!.updateComplete;
    const container = footer!.shadowRoot?.querySelector('.footer-container') as HTMLElement | null;
    expect(container, 'expected <.footer-container> inside <t-media-footer>').not.toBeNull();
    return container!;
  }

  async function openList(): Promise<void> {
    element.visible = true;
    await element.updateComplete;
    expect(element.visible).toBe(true);
  }

  it('swipe-up from the footer when the songlist is visible closes it', async () => {
    await openList();
    const closedSpy = vi.fn();
    element.addEventListener('song-list-closed', closedSpy);

    const target = await footerGestureTarget();
    swipeUp(target);
    await element.updateComplete;
    await element.updateComplete;
    // Pointer-event based implementations: one upward swipe as fallback.
    if (element.visible && closedSpy.mock.calls.length === 0) {
      swipeUpPointer(target);
      await element.updateComplete;
      await element.updateComplete;
    }

    // Now that handlers are inside footer's shadow, the non-crossing dispatch
    // legitimately calls the footer's _handleFooterSwipe* (which emit the
    // composed custom event consumed by parent).
    expect(footerStartSpy).toHaveBeenCalled();
    expect(footerMoveSpy).toHaveBeenCalled();
    expect(footerEndSpy).toHaveBeenCalled();

    expect(
      !element.visible || closedSpy.mock.calls.length > 0,
      'swipe-up from t-media-footer must close the songlist via the existing ' +
        `close path (visible=false → song-list-closed), but visible=${element.visible} ` +
        `and song-list-closed fired ${closedSpy.mock.calls.length}x`
    ).toBe(true);
  });

  it('guard: swipe-DOWN from the footer does NOT close the visible songlist', async () => {
    await openList();
    const closedSpy = vi.fn();
    element.addEventListener('song-list-closed', closedSpy);

    const target = await footerGestureTarget();
    swipeDown(target);
    await element.updateComplete;
    await element.updateComplete;

    expect(element.visible).toBe(true);
    expect(closedSpy).not.toHaveBeenCalled();
  });

  it('guard: swipe-up from the footer when the songlist is NOT visible does nothing harmful', async () => {
    element.visible = false;
    await element.updateComplete;
    const closedSpy = vi.fn();
    element.addEventListener('song-list-closed', closedSpy);

    const target = await footerGestureTarget();
    expect(() => swipeUp(target)).not.toThrow();
    await element.updateComplete;
    await element.updateComplete;

    expect(element.visible).toBe(false);
    expect(closedSpy).not.toHaveBeenCalled();
  });
});
