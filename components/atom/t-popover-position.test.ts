import { describe, it, expect } from 'vitest';
import { computePopupPosition } from '../../utils/popupPosition.js';
import type { PopupPositionInput } from '../../utils/popupPosition.js';

/**
 * Fixture helper — constructs the triggerRect shape required by
 * computePopupPosition. This is NOT a reimplementation of the
 * positioning logic; it only builds test input data.
 */
function makeRect(
  top: number,
  bottom: number,
  left: number,
  right: number
): PopupPositionInput['triggerRect'] {
  return {
    top,
    bottom,
    left,
    right,
    width: right - left,
    height: bottom - top,
  };
}

const VIEWPORT_W = 1000;
const VIEWPORT_H = 800;

describe('computePopupPosition', () => {
  it('applies default margin=8 and gap=4 and stays inside the viewport when no boundary is given', () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(300, 330, 200, 260),
      popupWidth: 200,
      popupHeight: 150,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });

    // gap=4 default → placed below the trigger
    expect(pos.top).toBe(330 + 4);
    // margin=8 default → clamped inside the viewport on both axes
    expect(pos.top).toBeGreaterThanOrEqual(8);
    expect(pos.top + 150).toBeLessThanOrEqual(VIEWPORT_H - 8);
    // centered horizontally on the trigger
    expect(pos.left).toBe(200 + 30 - 100);
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left + 200).toBeLessThanOrEqual(VIEWPORT_W - 8);
  });

  it('places the popup ABOVE the trigger when it is too tall for the space below', () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(700, 730, 200, 260),
      popupWidth: 200,
      popupHeight: 200,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });

    // Fallback above: triggerRect.top - popupHeight - gap(4)
    expect(pos.top).toBe(700 - 200 - 4);
    expect(pos.top).toBeLessThan(700);
    // Still fully inside the viewport vertically
    expect(pos.top).toBeGreaterThanOrEqual(8);
    expect(pos.top + 200).toBeLessThanOrEqual(VIEWPORT_H - 8);
  });

  it('places the popup BELOW the trigger when there is enough room below', () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(20, 50, 200, 260),
      popupWidth: 200,
      popupHeight: 100,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });

    // Preferred below: triggerRect.bottom + gap(4)
    expect(pos.top).toBe(50 + 4);
    expect(pos.top).toBeGreaterThan(50);
  });

  it('clamps vertically to the supplied boundary so the popup never exceeds boundary bottom', () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(660, 690, 200, 260),
      popupWidth: 200,
      popupHeight: 200,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
      boundaryRect: { top: 100, bottom: 700 },
    });

    // Never above boundaryTop + margin
    expect(pos.top).toBeGreaterThanOrEqual(100 + 8);
    // Never below boundaryBottom (popup fully inside the boundary)
    expect(pos.top + 200).toBeLessThanOrEqual(700);
    // Space below is too small (700 - 690 = 10), so it flips above the trigger
    expect(pos.top).toBe(660 - 200 - 4);
  });

  it('clamps vertically to the supplied boundary so the popup never goes above boundary top', () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(430, 460, 200, 260),
      popupWidth: 200,
      popupHeight: 350,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
      boundaryRect: { top: 100, bottom: 700 },
    });

    // Viewport alone would allow top=76 (space above the trigger is larger),
    // but the boundary forces the popup down to boundaryTop + margin.
    expect(pos.top).toBe(100 + 8);
    expect(pos.top).toBeGreaterThanOrEqual(100 + 8);
  });

  it('clamps horizontally to the viewport so the popup never exceeds the right screen edge', () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(100, 130, 900, 980),
      popupWidth: 240,
      popupHeight: 150,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });

    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left + 240).toBeLessThanOrEqual(VIEWPORT_W);
    // Centered position (820) exceeds the right edge → clamped
    expect(pos.left).toBe(VIEWPORT_W - 240 - 8);
  });

  it('clamps horizontally to the viewport so the popup never goes off the left screen edge', () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(100, 130, 0, 40),
      popupWidth: 300,
      popupHeight: 150,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });

    expect(pos.left).toBeGreaterThanOrEqual(8);
    // Centered position (-130) exceeds the left edge → clamped to margin
    expect(pos.left).toBe(8);
  });

  it('falls back to viewport bounds for vertical clamping when no boundary is supplied', () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(400, 430, 200, 260),
      popupWidth: 200,
      popupHeight: 600,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });

    // Neither side fits, and the above placement (-204) is clamped to the
    // viewport top margin (default margin=8) — i.e. viewport acts as boundary.
    expect(pos.top).toBe(8);
    expect(pos.top).toBeGreaterThanOrEqual(8);
    expect(pos.top + 600).toBeLessThanOrEqual(VIEWPORT_H);
  });

  it("preferPosition 'right' places the popup fully to the right of the trigger when space allows", () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(100, 130, 300, 360),
      popupWidth: 200,
      popupHeight: 150,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
      preferPosition: 'right',
    });

    // Right-side placement: popup left edge = trigger right edge + gap(4).
    expect(pos.left).toBe(360 + 4);
    // Still fully inside the viewport with margin=8 on both sides.
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left + 200).toBeLessThanOrEqual(VIEWPORT_W - 8);
  });

  it("preferPosition 'right' clamps to the right viewport edge when there is not enough room", () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(100, 130, 850, 910),
      popupWidth: 200,
      popupHeight: 150,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
      preferPosition: 'right',
    });

    // Unclamped right-side placement would be 910 + 4 = 914 → popup right
    // edge 1114 exceeds the viewport → clamp so the right edge stays at
    // viewportWidth - margin(8).
    expect(pos.left).toBe(VIEWPORT_W - 200 - 8);
    expect(pos.left + 200).toBeLessThanOrEqual(VIEWPORT_W);
  });

  it('defaults to centering when preferPosition is omitted', () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(100, 130, 300, 360),
      popupWidth: 200,
      popupHeight: 150,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });

    // Centered: trigger center (300 + 30) minus half the popup (100) → 130.
    // NOT the right-side placement (trigger.right + gap = 364).
    expect(pos.left).toBe(300 + 30 - 100);
    expect(pos.left).not.toBe(360 + 4);
  });

  describe("preferSide: 'up'", () => {
    it('places the popup ABOVE the trigger when the space above suffices', () => {
      const pos = computePopupPosition({
        triggerRect: makeRect(300, 335, 200, 260),
        popupWidth: 200,
        popupHeight: 100,
        viewportWidth: VIEWPORT_W,
        viewportHeight: VIEWPORT_H,
        preferSide: 'up',
      });

      // gap=4 → above placement: triggerRect.top - popupHeight - gap
      expect(pos.top).toBe(300 - 100 - 4);
      expect(pos.top).toBeLessThan(300);
      // Still fully inside the viewport with margin=8
      expect(pos.top).toBeGreaterThanOrEqual(8);
      expect(pos.top + 100).toBeLessThanOrEqual(VIEWPORT_H - 8);
    });

    it('falls back BELOW the trigger when there is no room above but room below', () => {
      const pos = computePopupPosition({
        triggerRect: makeRect(5, 40, 200, 260),
        popupWidth: 200,
        popupHeight: 100,
        viewportWidth: VIEWPORT_W,
        viewportHeight: VIEWPORT_H,
        preferSide: 'up',
      });

      // Above placement impossible (top 5 → only 1px above with gap)
      // → fall back below: triggerRect.bottom + gap(4)
      expect(pos.top).toBe(40 + 4);
      expect(pos.top).toBeGreaterThan(40);

      // The 'up' preference is observable when BOTH sides fit: it must pick
      // above, whereas the old down-first logic would pick below.
      const bothFit = computePopupPosition({
        triggerRect: makeRect(200, 235, 200, 260),
        popupWidth: 200,
        popupHeight: 100,
        viewportWidth: VIEWPORT_W,
        viewportHeight: VIEWPORT_H,
        preferSide: 'up',
      });
      expect(bothFit.top).toBe(200 - 100 - 4);
    });

    it('picks the side with more room when neither side fits and clamps inside the bounds', () => {
      const pos = computePopupPosition({
        triggerRect: makeRect(240, 275, 200, 260),
        popupWidth: 200,
        popupHeight: 300,
        viewportWidth: VIEWPORT_W,
        viewportHeight: 500,
        preferSide: 'up',
      });

      // spaceAbove = 240-4 = 236, spaceBelow = 500-275-4 = 221 → picks above:
      // top = 240-300-4 = -64 → clamped to the viewport top margin (8).
      expect(pos.top).toBe(8);
      expect(pos.top).toBeGreaterThanOrEqual(8);
      expect(pos.top + 300).toBeLessThanOrEqual(500);
    });
  });

  describe('horizontalAlign', () => {
    it("'right' aligns the popup's right edge with the trigger's right edge", () => {
      const pos = computePopupPosition({
        triggerRect: makeRect(100, 135, 50, 90),
        popupWidth: 200,
        popupHeight: 100,
        viewportWidth: VIEWPORT_W,
        viewportHeight: VIEWPORT_H,
        horizontalAlign: 'right',
      });

      // right-edge alignment: left = triggerRect.right - popupWidth = -110
      // → clamped to the left viewport margin (8).
      expect(pos.left).toBe(8);
      expect(pos.left).toBeGreaterThanOrEqual(8);
      expect(pos.left + 200).toBeLessThanOrEqual(VIEWPORT_W);

      // Distinguishing case: with the trigger further from the left edge the
      // right-edge alignment (140-200 = -60 → clamped to 8) still differs
      // from the old centered placement (100+20-100 = 20, no clamp).
      const nearEdge = computePopupPosition({
        triggerRect: makeRect(100, 135, 100, 140),
        popupWidth: 200,
        popupHeight: 100,
        viewportWidth: VIEWPORT_W,
        viewportHeight: VIEWPORT_H,
        horizontalAlign: 'right',
      });
      expect(nearEdge.left).toBe(8);
    });

    it("'left' aligns the popup's left edge with the trigger's left edge", () => {
      const pos = computePopupPosition({
        triggerRect: makeRect(100, 135, 50, 90),
        popupWidth: 200,
        popupHeight: 100,
        viewportWidth: VIEWPORT_W,
        viewportHeight: VIEWPORT_H,
        horizontalAlign: 'left',
      });

      // left-edge alignment: left = triggerRect.left (no clamping needed)
      expect(pos.left).toBe(50);
    });

    it("'left' clamps so the popup never exceeds the right viewport edge", () => {
      const pos = computePopupPosition({
        triggerRect: makeRect(100, 135, 950, 990),
        popupWidth: 200,
        popupHeight: 100,
        viewportWidth: VIEWPORT_W,
        viewportHeight: VIEWPORT_H,
        horizontalAlign: 'left',
      });

      // Unclamped left = 950 → clamped to viewportWidth - popupWidth - margin(8)
      expect(pos.left).toBe(VIEWPORT_W - 200 - 8);
      expect(pos.left + 200).toBeLessThanOrEqual(VIEWPORT_W);

      // Distinguishing case: left = 800 needs clamping to 792, whereas the
      // old centered placement (800+20-100 = 720) would still fit unclamped.
      const nearEdge = computePopupPosition({
        triggerRect: makeRect(100, 135, 800, 840),
        popupWidth: 200,
        popupHeight: 100,
        viewportWidth: VIEWPORT_W,
        viewportHeight: VIEWPORT_H,
        horizontalAlign: 'left',
      });
      expect(nearEdge.left).toBe(VIEWPORT_W - 200 - 8);
    });
  });

  it('combines preferSide "up" with horizontalAlign "right"', () => {
    const pos = computePopupPosition({
      triggerRect: makeRect(300, 335, 50, 90),
      popupWidth: 200,
      popupHeight: 100,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
      preferSide: 'up',
      horizontalAlign: 'right',
    });

    // Vertical: above → 300 - 100 - 4 = 196.
    // Horizontal: right-edge → 90 - 200 = -110 → clamped to 8.
    expect(pos.top).toBe(300 - 100 - 4);
    expect(pos.left).toBe(8);
  });

  it('defaults preferSide to down and keeps preferPosition behavior when horizontalAlign is unset', () => {
    const base = {
      triggerRect: makeRect(300, 330, 200, 260),
      popupWidth: 200,
      popupHeight: 150,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    };

    // Omitted preferSide must behave exactly like the explicit 'down' default.
    expect(computePopupPosition({ ...base, preferSide: 'down' })).toEqual(
      computePopupPosition(base)
    );

    // With horizontalAlign unset, preferPosition 'right' still applies:
    // popup sits fully to the right of the trigger (trigger.right + gap).
    expect(
      computePopupPosition({ ...base, preferPosition: 'right' }).left
    ).toBe(260 + 4);
    expect(
      computePopupPosition({
        ...base,
        preferPosition: 'right',
        horizontalAlign: undefined,
      }).left
    ).toBe(260 + 4);
  });
});
