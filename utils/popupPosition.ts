export interface PopupPositionInput {
  triggerRect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
  popupWidth: number;
  popupHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  boundaryRect?: { top: number; bottom: number } | null;
  margin?: number;
  gap?: number;
  /** Popover: prefer the popup fully to the right of the trigger (default centers it). */
  preferPosition?: 'center' | 'right';
  /** Dropdown: prefer opening down or up (default 'down'). Falls back to the side
   *  with more room, then clamps inside the bounds so the popup never goes off-screen. */
  preferSide?: 'down' | 'up';
  /** Dropdown: align an edge of the popup with the matching edge of the trigger.
   *  When set, overrides preferPosition. */
  horizontalAlign?: 'left' | 'right';
}

export function computePopupPosition(input: PopupPositionInput): { top: number; left: number } {
  const MARGIN = input.margin ?? 8;
  const GAP = input.gap ?? 4;
  const { triggerRect, popupWidth, popupHeight, viewportWidth, viewportHeight } = input;

  // Vertical bounds: boundary rect if provided, otherwise the viewport.
  const boundsTop = input.boundaryRect ? input.boundaryRect.top : 0;
  const boundsBottom = input.boundaryRect ? input.boundaryRect.bottom : viewportHeight;

  const spaceBelow = boundsBottom - triggerRect.bottom - GAP;
  const spaceAbove = triggerRect.top - boundsTop - GAP;

  const preferDown = (input.preferSide ?? 'down') !== 'up';

  // Prefer the requested side; fall back to the side with more room; then
  // clamp inside the bounds so the popup never goes off-screen.
  let top: number;
  if (preferDown) {
    if (spaceBelow >= popupHeight) {
      top = triggerRect.bottom + GAP;
    } else if (spaceAbove >= popupHeight) {
      top = triggerRect.top - popupHeight - GAP;
    } else if (spaceBelow >= spaceAbove) {
      top = triggerRect.bottom + GAP;
    } else {
      top = triggerRect.top - popupHeight - GAP;
    }
  } else {
    if (spaceAbove >= popupHeight) {
      top = triggerRect.top - popupHeight - GAP;
    } else if (spaceBelow >= popupHeight) {
      top = triggerRect.bottom + GAP;
    } else if (spaceAbove >= spaceBelow) {
      top = triggerRect.top - popupHeight - GAP;
    } else {
      top = triggerRect.bottom + GAP;
    }
  }
  top = Math.max(boundsTop + MARGIN, Math.min(top, boundsBottom - popupHeight - MARGIN));

  // Horizontal: edge alignment (dropdown), right-of-trigger (popover),
  // or centered (default). Either way, clamp to the viewport.
  let left: number;
  if (input.horizontalAlign === 'right') {
    left = triggerRect.right - popupWidth;
  } else if (input.horizontalAlign === 'left') {
    left = triggerRect.left;
  } else if (input.preferPosition === 'right') {
    left = triggerRect.right + GAP;
  } else {
    left = triggerRect.left + triggerRect.width / 2 - popupWidth / 2;
  }
  left = Math.max(MARGIN, Math.min(left, viewportWidth - popupWidth - MARGIN));

  return { top, left };
}
