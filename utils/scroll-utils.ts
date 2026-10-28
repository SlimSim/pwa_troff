/** The part of a bounding rect needed to compute a reveal scroll. */
export interface ViewportRect {
  top: number;
  bottom: number;
}

/**
 * Compute how many pixels to scroll DOWN to bring an element's bottom back
 * into view, without ever scrolling past the element's top.
 *
 * `bounds` is the visible box of the scroll container (e.g. from the t-header's
 * bottom edge to the t-footer's top edge); with `{ top: 0, bottom: H }` this
 * matches a plain viewport of height H.
 *
 * - `0` when the element is already fully visible (`rect.bottom <= bounds.bottom`).
 * - Otherwise `min(rect.bottom - bounds.bottom, rect.top - bounds.top)` — the
 *   clamp ensures the element's top ends up at most aligned with the bounds top.
 * - `0` when the clamp would be <= 0, i.e. when the top is already at or above
 *   the bounds top (never scroll up).
 */
export function computeRevealScrollDelta(rect: ViewportRect, bounds: ViewportRect): number {
  const overflowBelow = rect.bottom - bounds.bottom;
  if (overflowBelow <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(overflowBelow, rect.top - bounds.top));
}
