/**
 * Zoom-info popup logic (V2 port of the v1 `zoomInstructionDialog`).
 *
 * Pure logic, no DOM / no nDB / no Firebase — persistence is the parent's job.
 * - `isZoomNoop` detects the no-op case where the timeline is ALREADY zoomed
 *   to the active playing region (re-zooming would change nothing).
 * - `shouldShowZoomInfo` gates the popup on the no-op + the persisted
 *   suppression flag (nDB key 'zoomDontShowAgain', v1 compatible).
 */

/** nDB key for the "Don't show again" suppression flag (v1 compatible). */
export const ZOOM_INFO_DONT_SHOW_KEY = 'zoomDontShowAgain';

export interface ZoomWindow {
  startTime: number;
  endTime: number;
}

export function isZoomNoop(
  current: ZoomWindow,
  target: ZoomWindow,
  epsilon = 0.001
): boolean {
  return (
    Math.abs(current.startTime - target.startTime) <= epsilon &&
    Math.abs(current.endTime - target.endTime) <= epsilon
  );
}

export function shouldShowZoomInfo(noop: boolean, dontShowAgain: unknown): boolean {
  return noop && !dontShowAgain;
}
