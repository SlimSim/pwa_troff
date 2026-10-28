import { describe, it, expect } from 'vitest';
import { computeRevealScrollDelta } from '../utils/scroll-utils.js';
import type { ViewportRect } from '../utils/scroll-utils.js';

/**
 * Tests for computeRevealScrollDelta (utils/scroll-utils.ts) — the pure math
 * behind "scroll an expanding <t-details> back into view".
 *
 * Contract (AMENDED feature spec — the scroll respects the INSET visible area,
 * i.e. from the t-header's bottom edge to the t-footer's top edge):
 *  - Returns px to scroll DOWN.
 *  - The second argument is a bounds rect { top, bottom } (the visible box of
 *    the scroll container), not a viewport height.
 *  - 0 when the element is already fully visible above the bottom bound
 *    (rect.bottom <= bounds.bottom).
 *  - Otherwise min(rect.bottom - bounds.bottom, rect.top - bounds.top) — the
 *    clamp ensures the scroll never goes past the TOP of the element (the
 *    element top ends up at most aligned with the bounds top).
 *  - 0 when the clamp would be <= 0, i.e. when the top is already at or above
 *    the bounds top (user decision: never scroll up).
 *  - With bounds = { top: 0, bottom: 800 } the results equal the old
 *    "viewport height 800" behaviour.
 */
describe('computeRevealScrollDelta', () => {
  /** Viewport-aligned bounds: equivalent to the old viewportHeight = 800. */
  const viewport: ViewportRect = { top: 0, bottom: 800 };

  it('returns 0 when the whole element is already fully visible (rect.bottom <= bounds.bottom)', () => {
    expect(computeRevealScrollDelta({ top: 100, bottom: 700 }, viewport)).toBe(0);
  });

  it('returns 0 when rect.bottom exactly equals the bottom bound', () => {
    expect(computeRevealScrollDelta({ top: 300, bottom: 800 }, viewport)).toBe(0);
  });

  it('returns the amount the bottom overflows below the bottom bound when no clamping is needed', () => {
    // bottom is 200px below the bounds bottom; top is 500px from the
    // bounds top, so min(200, 500) = 200.
    expect(computeRevealScrollDelta({ top: 500, bottom: 1000 }, viewport)).toBe(200);
  });

  it('clamps the scroll to rect.top - bounds.top when the element is taller than the remaining space (never scrolls past the element top)', () => {
    // bottom is 200px below the bounds bottom, but the top is only 100px
    // from the bounds top → clamped to 100 so the element top ends up
    // aligned with the bounds top at most.
    expect(computeRevealScrollDelta({ top: 100, bottom: 1000 }, viewport)).toBe(100);
  });

  it('returns 0 when the element top is exactly at the top bound (clamp would be 0)', () => {
    expect(computeRevealScrollDelta({ top: 0, bottom: 900 }, viewport)).toBe(0);
  });

  it('returns 0 when the element top is already above the top bound (no scroll-up)', () => {
    expect(computeRevealScrollDelta({ top: -60, bottom: 900 }, viewport)).toBe(0);
  });

  describe('inset bounds (header bottom / footer top)', () => {
    /** Visible box of the scroll container: 60px header, footer top at 730. */
    const inset: ViewportRect = { top: 60, bottom: 730 };

    it('scrolls only up to the bottom bound so the element bottom lands visible above the footer', () => {
      // bottom overflows 800 - 730 = 70 below the footer top; top is
      // 300 - 60 = 240 below the header bottom → min(70, 240) = 70.
      // NOT 800 - window.innerHeight.
      expect(computeRevealScrollDelta({ top: 300, bottom: 800 }, inset)).toBe(70);
    });

    it('clamps to rect.top - bounds.top so the element top lands exactly on the container top edge', () => {
      // bottom overflows 1000 - 730 = 270, but the top is only
      // 100 - 60 = 40 below the header bottom → clamped to 40
      // (hidden behind the header is forbidden).
      expect(computeRevealScrollDelta({ top: 100, bottom: 1000 }, inset)).toBe(40);
    });

    it('returns 0 when the element bottom is exactly at the bottom bound', () => {
      expect(computeRevealScrollDelta({ top: 300, bottom: 730 }, inset)).toBe(0);
    });

    it('returns 0 when the element top is exactly at the top bound (no scroll-up)', () => {
      expect(computeRevealScrollDelta({ top: 60, bottom: 900 }, inset)).toBe(0);
    });
  });
});
