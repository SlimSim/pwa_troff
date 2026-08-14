// Anchor-based zoom scroll computation for the marker slider.
//
// While zooming, the slider content (`.slider-container`) is scaled vertically
// with the TOP edge fixed. To keep the point under the zoom anchor fixed on
// screen, the scroll position of the nearest scrollable ancestor is adjusted
// instead of applying a transform (a transform does not affect the scrollable
// area, so translated content can end up outside it and become unreachable):
//
//   deltaScrollTop = anchorFraction * (newZoom - previousZoom) * layoutHeight
//
// Zoom-in → positive delta (scroll down); zoom-out → negative delta (scroll
// up). The result is a scroll offset because the content is top-anchored in
// layout, and the browser clamps scrollTop to [0, max], so all content stays
// reachable. The delta is rounded to an integer pixel offset (scrollTop is an
// integer in practice, and this keeps step-wise deltas exact).

export interface ZoomScrollParams {
  /** Z1 — zoom level before this gesture step. */
  previousZoom: number;
  /** Z2 — zoom level after this gesture step (caller clamps to minZoom). */
  newZoom: number;
  /** f — vertical fraction (0=top, 1=bottom) of the track under the anchor. */
  anchorFraction: number;
  /** H0 px — layout height the zoom scales against. */
  layoutHeight: number;
}

export function computeZoomScrollDelta(params: ZoomScrollParams): number {
  const { previousZoom, newZoom, anchorFraction, layoutHeight } = params;
  return Math.round(anchorFraction * (newZoom - previousZoom) * layoutHeight);
}