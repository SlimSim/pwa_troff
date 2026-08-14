// Tests for computeZoomScrollDelta (utils/zoom.ts)
//
// Feature: anchor-based zoom for the marker slider (t-marker-slider). The
// translate-based fix (computeZoomTranslate) pushed markers out of the
// scrollable area of the ancestor `.main-content`, so the new design keeps the
// point under the zoom anchor fixed by adjusting the SCROLL position of the
// nearest scrollable ancestor instead:
//
//   deltaScrollTop = anchorFraction * (newZoom - previousZoom) * layoutHeight
//
// Zoom-in → positive delta (scroll down); zoom-out → negative delta (scroll
// up). The browser clamps scrollTop to [0, max], so the content always stays
// reachable.

import { describe, it, expect } from 'vitest';
import { computeZoomScrollDelta } from '../utils/zoom.js';

describe('computeZoomScrollDelta', () => {
  const layoutHeight = 1000;

  it('zooming in with the anchor at the vertical middle scrolls down by f * (Z2 - Z1) * H0', () => {
    expect(
      computeZoomScrollDelta({
        previousZoom: 1,
        newZoom: 2,
        anchorFraction: 0.5,
        layoutHeight,
      })
    ).toBe(500);
  });

  it('doubling the zoom doubles the scroll delta at the middle anchor', () => {
    expect(
      computeZoomScrollDelta({
        previousZoom: 2,
        newZoom: 4,
        anchorFraction: 0.5,
        layoutHeight,
      })
    ).toBe(1000);
  });

  it('a symmetric zoom-out produces the negative delta (round trip)', () => {
    expect(
      computeZoomScrollDelta({
        previousZoom: 4,
        newZoom: 2,
        anchorFraction: 0.5,
        layoutHeight,
      })
    ).toBe(-1000);
  });

  it('anchor at the top (f=0) never scrolls', () => {
    expect(
      computeZoomScrollDelta({
        previousZoom: 2,
        newZoom: 4,
        anchorFraction: 0,
        layoutHeight,
      })
    ).toBe(0);
  });

  it('anchor at the bottom (f=1) scrolls by the full (Z2 - Z1) * H0', () => {
    expect(
      computeZoomScrollDelta({
        previousZoom: 2,
        newZoom: 4,
        anchorFraction: 1,
        layoutHeight,
      })
    ).toBe(2000);
  });

  it('layoutHeight 0 yields 0 (nothing to scale against)', () => {
    expect(
      computeZoomScrollDelta({
        previousZoom: 2,
        newZoom: 4,
        anchorFraction: 0.5,
        layoutHeight: 0,
      })
    ).toBe(0);
  });

  it('no zoom change (Z1 === Z2) never scrolls', () => {
    expect(
      computeZoomScrollDelta({
        previousZoom: 1,
        newZoom: 1,
        anchorFraction: 0.5,
        layoutHeight,
      })
    ).toBe(0);
  });

  it('round trips to zero: delta(1 -> 2) + delta(2 -> 1) === 0 for the same anchor', () => {
    const zoomIn = computeZoomScrollDelta({
      previousZoom: 1,
      newZoom: 2,
      anchorFraction: 0.5,
      layoutHeight,
    });
    const zoomOut = computeZoomScrollDelta({
      previousZoom: 2,
      newZoom: 1,
      anchorFraction: 0.5,
      layoutHeight,
    });
    expect(zoomIn).toBe(500);
    expect(zoomOut).toBe(-500);
    expect(zoomIn + zoomOut).toBe(0);
  });

  // ---- additional edge cases ----

  it('an anchorFraction beyond [0, 1] extrapolates linearly (the component clamps f to 0..1)', () => {
    // The component computes f from getBoundingClientRect and clamps it to
    // [0, 1] in _getAnchorFraction; the pure function applies the formula
    // verbatim, so out-of-range fractions simply extrapolate linearly.
    expect(
      computeZoomScrollDelta({
        previousZoom: 2,
        newZoom: 4,
        anchorFraction: 1.5,
        layoutHeight,
      })
    ).toBe(3000);
    expect(
      computeZoomScrollDelta({
        previousZoom: 2,
        newZoom: 4,
        anchorFraction: -0.5,
        layoutHeight,
      })
    ).toBe(-1000);
  });

  it('zooming out from a high zoom produces a large negative delta', () => {
    expect(
      computeZoomScrollDelta({
        previousZoom: 8,
        newZoom: 4,
        anchorFraction: 0.5,
        layoutHeight,
      })
    ).toBe(-2000);
  });

  it('handles fractional 10% wheel steps (1 -> 1.1 with H0 = 800)', () => {
    expect(
      computeZoomScrollDelta({
        previousZoom: 1,
        newZoom: 1.1,
        anchorFraction: 0.5,
        layoutHeight: 800,
      })
    ).toBe(40);
  });
});
