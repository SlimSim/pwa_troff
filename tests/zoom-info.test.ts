import { describe, it, expect } from 'vitest';
import {
  ZOOM_INFO_DONT_SHOW_KEY,
  isZoomNoop,
  shouldShowZoomInfo,
} from '../utils/zoom-info.js';

/**
 * Tests for the v2 zoom-info popup logic (port of the v1
 * `zoomInstructionDialog` in scriptTroffClass.ts `zoomToMarker()`).
 *
 * Pure logic, no DOM / no nDB / no Firebase:
 * - `isZoomNoop` detects the no-op case where the timeline is ALREADY zoomed
 *   to the active playing region (re-zooming would change nothing).
 * - `shouldShowZoomInfo` gates the popup on the no-op + the persisted
 *   suppression flag (nDB key 'zoomDontShowAgain', v1 compatible).
 *
 * NOTE: `utils/zoom-info.ts` does NOT exist yet. Importing it fails, which
 * makes every test in this file RED until the utility is created. That is
 * intentional.
 */
describe('ZOOM_INFO_DONT_SHOW_KEY', () => {
  it("is 'zoomDontShowAgain' (v1 nDB compatibility)", () => {
    expect(ZOOM_INFO_DONT_SHOW_KEY).toBe('zoomDontShowAgain');
  });
});

describe('isZoomNoop', () => {
  it('returns true when current window exactly equals target window', () => {
    expect(
      isZoomNoop({ startTime: 10, endTime: 20 }, { startTime: 10, endTime: 20 })
    ).toBe(true);
  });

  it('returns false when start differs', () => {
    expect(
      isZoomNoop({ startTime: 10, endTime: 20 }, { startTime: 11, endTime: 20 })
    ).toBe(false);
  });

  it('returns false when end differs', () => {
    expect(
      isZoomNoop({ startTime: 10, endTime: 20 }, { startTime: 10, endTime: 21 })
    ).toBe(false);
  });

  it('treats differences within epsilon as a no-op', () => {
    expect(
      isZoomNoop(
        { startTime: 10, endTime: 20 },
        { startTime: 10.0005, endTime: 19.9995 },
        0.001
      )
    ).toBe(true);
  });

  it('treats differences beyond epsilon as NOT a no-op', () => {
    expect(
      isZoomNoop(
        { startTime: 10, endTime: 20 },
        { startTime: 10.01, endTime: 20 },
        0.001
      )
    ).toBe(false);
  });
});

describe('shouldShowZoomInfo', () => {
  it('shows when noop and never suppressed', () => {
    expect(shouldShowZoomInfo(true, false)).toBe(true);
    expect(shouldShowZoomInfo(true, undefined)).toBe(true);
    expect(shouldShowZoomInfo(true, null)).toBe(true);
  });

  it('hides when suppressed (truthy dontShowAgain)', () => {
    expect(shouldShowZoomInfo(true, true)).toBe(false);
  });

  it('hides when not a no-op, even if never suppressed', () => {
    expect(shouldShowZoomInfo(false, false)).toBe(false);
    expect(shouldShowZoomInfo(false, undefined)).toBe(false);
  });

  it('hides when not a no-op and suppressed', () => {
    expect(shouldShowZoomInfo(false, true)).toBe(false);
  });
});
