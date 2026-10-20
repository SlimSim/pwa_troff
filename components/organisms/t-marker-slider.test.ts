import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MarkerSlider } from './t-marker-slider.js';
import type { TroffMarker } from '../../types/troff.js';

/** Repository root (this file lives in components/organisms/). */
const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

/**
 * Builds a valid TroffMarker-shaped fixture for the slider's `markers`
 * property. This is fixture data only — NOT a reimplementation of any
 * component logic.
 */
function makeMarker(overrides: Partial<TroffMarker> = {}): TroffMarker {
  return {
    color: 'red',
    id: 'm1',
    info: '',
    name: 'Marker',
    time: 50,
    ...overrides,
  };
}

describe('t-marker-slider marker stacking (no z-index)', () => {
  let element: MarkerSlider;

  beforeEach(() => {
    element = new MarkerSlider();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  /** The rendered <t-marker> elements in DOM order (same order as `markers`). */
  function getMarkerElements(): HTMLElement[] {
    const markerEls = element.shadowRoot?.querySelectorAll('t-marker');
    return Array.from(markerEls ?? []) as HTMLElement[];
  }

  it('does not apply an inline z-index to any marker (first marker has info)', async () => {
    // The NEW fix renders markers without any inline z-index — whole-marker
    // elevation was reverted. No marker may carry an inline z-index, with or
    // without info.
    element.markers = [
      makeMarker({ id: 'm1', info: 'A description', time: 50 }),
      makeMarker({ id: 'm2', info: '', time: 50 }),
    ];
    await element.updateComplete;

    const [first, second] = getMarkerElements();
    expect(first.style.zIndex).toBe('');
    expect(second.style.zIndex).toBe('');
  });

  it('does not apply an inline z-index to any marker (second marker has info)', async () => {
    element.markers = [
      makeMarker({ id: 'm1', info: '', time: 50 }),
      makeMarker({ id: 'm2', info: 'A description', time: 50 }),
    ];
    await element.updateComplete;

    const [first, second] = getMarkerElements();
    expect(first.style.zIndex).toBe('');
    expect(second.style.zIndex).toBe('');
  });
});

/**
 * Feature: anchor-based zoom for t-marker-slider (scroll version).
 *
 * Instead of translating .slider-container (which pushed markers out of the
 * scrollable area of the ancestor .main-content), the new design keeps the
 * point under the zoom anchor fixed by adjusting the SCROLL position of the
 * nearest scrollable ancestor:
 *
 *   deltaScrollTop = anchorFraction * (newZoom - previousZoom) * layoutHeight
 *
 * The scroll container is found by walking up the composed-tree ancestors
 * from this.parentElement and taking the first element whose computed
 * overflowY is 'auto', 'scroll' or 'overlay'. A plain programmatic zoomLevel
 * set (how v2Script.ts applyMarkerSliderZoom zooms) must NOT touch any scroll
 * position, and .slider-container must never carry a transform anymore.
 */
describe('t-marker-slider anchor zoom via scroll', () => {
  let element: MarkerSlider;
  let wrapper: HTMLDivElement;

  beforeEach(() => {
    element = new MarkerSlider();
    wrapper = document.createElement('div');
    wrapper.style.overflowY = 'auto';
    wrapper.style.height = '800px';
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);
  });

  afterEach(() => {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
    vi.restoreAllMocks();
  });

  function getSliderContainer(): HTMLElement {
    const container = element.shadowRoot?.querySelector('.slider-container');
    expect(container).not.toBeNull();
    return container as HTMLElement;
  }

  /**
   * happy-dom 20.9.0's WheelEvent extends UIEvent and drops the MouseEvent
   * init fields (ctrlKey, clientY) in its constructor, so a gesture built
   * with `new WheelEvent(...)` never reaches the component's wheel handler.
   * Re-attach the gesture fields before dispatching.
   */
  function dispatchCtrlWheelGesture(clientY: number, deltaY: number): void {
    const event = new WheelEvent('wheel', {
      deltaY,
      bubbles: true,
      cancelable: true,
    });
    Object.assign(event, { ctrlKey: true, clientY });
    element.dispatchEvent(event);
  }

  /**
   * Layout: host is 800px tall, the track wrapper spans top 0..800, so a
   * wheel gesture at clientY 400 anchors at the vertical middle of the track
   * (anchorFraction 0.5). Call only after the shadow root has rendered.
   */
  function mockGeometry(): void {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 800));
    const trackWrapper = element.shadowRoot?.querySelector('.slider-track-wrapper') as HTMLElement;
    vi.spyOn(trackWrapper, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 800));
  }

  it('a ctrl+wheel zoom gesture scrolls the scrollable ancestor down', async () => {
    await element.updateComplete;
    mockGeometry();

    dispatchCtrlWheelGesture(400, -100); // zoom 1 -> 1.1, anchorFraction 0.5
    await element.updateComplete;

    expect(element.zoomLevel).toBeCloseTo(1.1, 6);
    // 0.5 * (1.1 - 1) * 800 = 40 (floating point: 40.000000000000036)
    expect(wrapper.scrollTop).toBeCloseTo(40, 6);
  });

  it('a second zoom gesture accumulates the scroll delta', async () => {
    await element.updateComplete;
    mockGeometry();

    dispatchCtrlWheelGesture(400, -100); // 1 -> 1.1, delta +40
    await element.updateComplete;
    dispatchCtrlWheelGesture(400, -100); // 1.1 -> 1.21, delta +44
    await element.updateComplete;

    expect(element.zoomLevel).toBeCloseTo(1.21, 6);
    // 40 + 0.5 * (1.21 - 1.1) * 800 = 84 (floating point: 84.00000000000009)
    expect(wrapper.scrollTop).toBeCloseTo(84, 6);
  });

  it('a programmatic zoomLevel set does not change the scroll position', async () => {
    await element.updateComplete;
    mockGeometry();

    dispatchCtrlWheelGesture(400, -100);
    await element.updateComplete;
    dispatchCtrlWheelGesture(400, -100);
    await element.updateComplete;
    expect(wrapper.scrollTop).toBeCloseTo(84, 6);

    // v2Script.ts applyMarkerSliderZoom zooms by setting zoomLevel directly.
    element.zoomLevel = 4;
    await element.updateComplete;

    expect(element.zoomLevel).toBe(4);
    expect(wrapper.scrollTop).toBeCloseTo(84, 6);
  });

  it('never applies a transform to .slider-container', async () => {
    await element.updateComplete;
    mockGeometry();

    dispatchCtrlWheelGesture(400, -100);
    await element.updateComplete;

    expect(getSliderContainer().style.transform).not.toContain('translate');
  });

  it('a zoom-out gesture scrolls back up (happy-dom stores negative scrollTop verbatim)', async () => {
    await element.updateComplete;
    mockGeometry();

    dispatchCtrlWheelGesture(400, -100); // 1 -> 1.1, scrollTop 40
    await element.updateComplete;
    expect(wrapper.scrollTop).toBeCloseTo(40, 6);

    // Lower minZoom so the zoom-out below (1.1 -> 0.99) is not clamped away.
    element.minZoom = 0.5;
    await element.updateComplete;

    dispatchCtrlWheelGesture(400, 100); // 1.1 -> 0.99
    await element.updateComplete;

    expect(element.zoomLevel).toBeCloseTo(0.99, 6);
    // 40 + 0.5 * (0.99 - 1.1) * 800 = -4 (floating point: -4.000000000000039).
    // happy-dom 20.9.0 does NOT clamp scrollTop to [0, max] — its setter
    // stores the raw value, so -4 is read back as -4 (a real browser would
    // clamp to 0).
    expect(wrapper.scrollTop).toBeCloseTo(-4, 6);
  });

  // -------------------------------------------------------------------------
  // Feature: two-finger pinch PAN (map-style "content follows the fingers").
  //
  // On each pinch touchmove the content follows the fingers' midpoint
  // movement in the vertical direction IN ADDITION to the zoom:
  //
  //   panDelta = -(midpointY - lastMidpointY)   // fingers down → content
  //                                             // follows down → scrollTop--
  //
  // The pan is applied to the scroll container FIRST (synchronously), the
  // zoom anchor fraction is then computed from the post-pan track rect, and
  // the zoom scroll delta (anchorFraction * (Z2 - Z1) * layoutHeight) is
  // applied after updateComplete. Zoom-only pinches (fixed midpoint) and
  // wheel zoom must behave exactly as before.
  //
  // happy-dom 20.9.0's TouchEvent (like WheelEvent) drops its init fields, so
  // touch gestures are built with a plain `new Event(type)` and the
  // `touches`/`changedTouches`/`targetTouches` collections are re-attached
  // before dispatching (the component reads `event.touches`, never a
  // constructor-initialized TouchList).
  // -------------------------------------------------------------------------

  function makeTouch(clientY: number, clientX = 0) {
    return { clientX, clientY } as Touch;
  }

  function dispatchTouchGesture(
    type: 'touchstart' | 'touchmove' | 'touchend',
    touchYs: number[]
  ): void {
    const touches = touchYs.map((y) => makeTouch(y));
    const event = new Event(type) as TouchEvent;
    Object.assign(event, { touches, changedTouches: touches, targetTouches: touches });
    element.dispatchEvent(event);
  }

  it('a pinch zoom with a fixed midpoint scrolls by f * (Z2 - Z1) * H0 (no pan)', async () => {
    await element.updateComplete;
    mockGeometry();

    // touchstart [300, 500]: midpoint 400, initial distance 200.
    dispatchTouchGesture('touchstart', [300, 500]);
    // touchmove [100, 700]: midpoint still 400 (panDelta 0), distance 600 →
    // scale 3 → zoom 1 -> 3. Anchor fraction at 400 on the mocked 0..800
    // track is 0.5, so delta = 0.5 * (3 - 1) * 800 = 800.
    dispatchTouchGesture('touchmove', [100, 700]);

    // zoomLevel is set synchronously by _setZoom, but the zoom scroll delta
    // is only applied after updateComplete (so the browser clamps against the
    // NEW scroll extent) — the pan-less pinch must not scroll synchronously.
    expect(element.zoomLevel).toBe(3);
    expect(wrapper.scrollTop).toBe(0);
    await element.updateComplete;

    expect(wrapper.scrollTop).toBe(800);
  });

  it('a pinch pan alone (constant distance) scrolls the container', async () => {
    await element.updateComplete;
    mockGeometry();

    // touchstart [300, 500]: midpoint 400, distance 200.
    dispatchTouchGesture('touchstart', [300, 500]);
    // touchmove [400, 600]: midpoint 500, distance 200 → scale 1 (zoom
    // unchanged), panDelta = -(500 - 400) = -100. Fingers moved down, so the
    // content follows down and scrollTop decreases.
    dispatchTouchGesture('touchmove', [400, 600]);
    await element.updateComplete;

    expect(element.zoomLevel).toBe(1);
    // happy-dom does NOT clamp scrollTop: a real browser would clamp this pan
    // to 0 (zoom 1 has no scrollable overflow), but happy-dom stores -100
    // verbatim — exactly what the pan math produces.
    expect(wrapper.scrollTop).toBe(-100);
  });

  it('a pinch zoom + pan combined keeps the content tracking the fingers', async () => {
    await element.updateComplete;
    mockGeometry();

    // touchstart [300, 500]: midpoint 400, distance 200.
    dispatchTouchGesture('touchstart', [300, 500]);
    // touchmove [150, 550]: midpoint 350, distance 400 → scale 2 (zoom 2),
    // panDelta = -(350 - 400) = +50 (fingers moved up → content follows up).
    dispatchTouchGesture('touchmove', [150, 550]);
    await element.updateComplete;

    expect(element.zoomLevel).toBe(2);
    // Pan is applied FIRST: scrollTop 0 + 50 = 50. The anchor fraction is then
    // read from the track rect. NOTE: mockGeometry() returns a STATIC
    // (0, 0, 800, 800) rect, so it cannot reflect the post-pan scroll — the
    // fraction is (350 - 0) / 800 = 0.4375 (not (350 + 50) / 800 = 0.5 as it
    // would be with a real layout). delta = round(0.4375 * (2 - 1) * 800)
    // = 350, so the final scrollTop is 50 + 350 = 400.
    expect(wrapper.scrollTop).toBe(400);
  });

  it('consecutive pinch moves accumulate zoom and pan (map-follow)', async () => {
    await element.updateComplete;
    mockGeometry();

    dispatchTouchGesture('touchstart', [300, 500]); // midpoint 400, distance 200
    // Move 1: [250, 550] → midpoint 400, distance 300, scale 1.5, panDelta 0.
    dispatchTouchGesture('touchmove', [250, 550]);
    await element.updateComplete;
    expect(element.zoomLevel).toBe(1.5);
    // 0.5 * (1.5 - 1) * 800 = 200
    expect(wrapper.scrollTop).toBe(200);

    // Move 2: [200, 600] → midpoint 400, distance 400, scale 2, panDelta 0.
    dispatchTouchGesture('touchmove', [200, 600]);
    await element.updateComplete;
    expect(element.zoomLevel).toBe(2);
    // 200 + 0.5 * (2 - 1.5) * 800 = 400
    expect(wrapper.scrollTop).toBe(400);

    // Move 3: [150, 450] → midpoint 300, distance 300, scale 1.5 → zoom OUT
    // 2 -> 1.5 while the fingers move UP: panDelta = -(300 - 400) = +100.
    dispatchTouchGesture('touchmove', [150, 450]);
    await element.updateComplete;
    expect(element.zoomLevel).toBe(1.5);
    // Pan first: 400 + 100 = 500; fraction (300 - 0) / 800 = 0.375;
    // delta = round(0.375 * (1.5 - 2) * 800) = -150 → 500 - 150 = 350.
    expect(wrapper.scrollTop).toBe(350);
  });

  it('a pinch inward below minZoom still pans (zoom clamped, pan proceeds)', async () => {
    await element.updateComplete;
    mockGeometry();

    // minZoom defaults to 1, so a pinch below zoom 1 is clamped to 1 — but the
    // pan must still be applied (the early-return only fires when BOTH the
    // zoom is unchanged AND panDelta is 0).
    expect(element.minZoom).toBe(1);

    dispatchTouchGesture('touchstart', [300, 500]); // midpoint 400, distance 200
    // touchmove [425, 475]: midpoint 450, distance 50 → scale 0.25 → zoom
    // 0.25 clamped to 1; panDelta = -(450 - 400) = -50 (fingers moved down →
    // content follows down → scrollTop decreases).
    dispatchTouchGesture('touchmove', [425, 475]);
    await element.updateComplete;

    expect(element.zoomLevel).toBe(1);
    // happy-dom does NOT clamp scrollTop (a real browser would clamp the pan
    // to 0 at zoom 1); -50 is stored verbatim.
    expect(wrapper.scrollTop).toBe(-50);
  });
});

// ---------------------------------------------------------------------------
// Marker cross-over guards
//
// When the user selects an end marker whose time is before the current start
// marker, the start marker should snap to the first (earliest) marker.
// Conversely, selecting a start marker whose time is after the current end
// marker should snap the end marker to the last (latest) marker.
// ---------------------------------------------------------------------------
describe('t-marker-slider marker cross-over guards', () => {
  let element: MarkerSlider;

  const markers: TroffMarker[] = [
    { color: 'green', id: 'm1', info: '', name: 'Start', time: 10 },
    { color: 'blue', id: 'm2', info: '', name: 'Mid', time: 50 },
    { color: 'red', id: 'm3', info: '', name: 'End', time: 90 },
  ];

  beforeEach(() => {
    element = new MarkerSlider();
    element.markers = markers;
    element.min = 0;
    element.max = 100;
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('clicking an end marker before the current start resets start to the first marker', async () => {
    // Set start=m3 (90), stop=m3 (90) — start is at or after stop
    element.startMarkerId = 'm3';
    element.stopMarkerId = 'm3S';
    await element.updateComplete;

    // Now click the stop button on m1 (time=10) — stop would be 10, start is 90
    const markerEl = element.shadowRoot?.querySelectorAll('t-marker')[0] as HTMLElement;
    const stopBtn = markerEl.shadowRoot?.querySelector('.stop-button') as HTMLElement;
    stopBtn.click();
    await element.updateComplete;

    // Start should snap to the first marker (m1)
    expect(element.startMarkerId).toBe('m1');
    // Stop should be m1 (the new stop marker)
    expect(element.stopMarkerId).toBe('m1S');
  });

  it('clicking a start marker after the current end resets end to the last marker', async () => {
    // Set start=m1 (10), stop=m1 (10) — end is at or before start
    element.startMarkerId = 'm1';
    element.stopMarkerId = 'm1S';
    await element.updateComplete;

    // Now click the start button on m3 (time=90) — start would be 90, stop is 10
    const markerEl = element.shadowRoot?.querySelectorAll('t-marker')[2] as HTMLElement;
    const startBtn = markerEl.shadowRoot?.querySelector('.marker-name-button') as HTMLElement;
    startBtn.click();
    await element.updateComplete;

    // Stop should snap to the last marker (m3)
    expect(element.stopMarkerId).toBe('m3S');
    // Start should be m3 (the new start marker)
    expect(element.startMarkerId).toBe('m3');
  });

  it('clicking end marker after start does NOT reset start', async () => {
    // start=m1 (10), stop=m3 (90) — valid region
    element.startMarkerId = 'm1';
    element.stopMarkerId = 'm3S';
    await element.updateComplete;

    // Click stop button on m2 (time=50) — stop=50 > start=10, no cross-over
    const markerEl = element.shadowRoot?.querySelectorAll('t-marker')[1] as HTMLElement;
    const stopBtn = markerEl.shadowRoot?.querySelector('.stop-button') as HTMLElement;
    stopBtn.click();
    await element.updateComplete;

    // Start should remain m1
    expect(element.startMarkerId).toBe('m1');
    expect(element.stopMarkerId).toBe('m2S');
  });

  it('clicking start marker before end does NOT reset end', async () => {
    // start=m1 (10), stop=m3 (90) — valid region
    element.startMarkerId = 'm1';
    element.stopMarkerId = 'm3S';
    await element.updateComplete;

    // Click start button on m2 (time=50) — start=50 < stop=90, no cross-over
    const markerEl = element.shadowRoot?.querySelectorAll('t-marker')[1] as HTMLElement;
    const startBtn = markerEl.shadowRoot?.querySelector('.marker-name-button') as HTMLElement;
    startBtn.click();
    await element.updateComplete;

    // Stop should remain m3
    expect(element.startMarkerId).toBe('m2');
    expect(element.stopMarkerId).toBe('m3S');
  });

  it('dispatches set-stop-marker when start crosses stop', async () => {
    element.startMarkerId = 'm3';
    element.stopMarkerId = 'm3S';
    await element.updateComplete;

    const stopEvents: string[] = [];
    element.addEventListener('set-stop-marker', ((e: CustomEvent) => {
      stopEvents.push(e.detail.markerId);
    }) as EventListener);

    // Click stop button on m1
    const markerEl = element.shadowRoot?.querySelectorAll('t-marker')[0] as HTMLElement;
    const stopBtn = markerEl.shadowRoot?.querySelector('.stop-button') as HTMLElement;
    stopBtn.click();
    await element.updateComplete;

    // Should dispatch set-stop-marker for the reset (m1) AND the original click (m1)
    expect(stopEvents).toContain('m1');
  });

  it('dispatches set-start-marker when stop crosses start', async () => {
    element.startMarkerId = 'm1';
    element.stopMarkerId = 'm1S';
    await element.updateComplete;

    const startEvents: string[] = [];
    element.addEventListener('set-start-marker', ((e: CustomEvent) => {
      startEvents.push(e.detail.markerId);
    }) as EventListener);

    // Click start button on m3
    const markerEl = element.shadowRoot?.querySelectorAll('t-marker')[2] as HTMLElement;
    const startBtn = markerEl.shadowRoot?.querySelector('.marker-name-button') as HTMLElement;
    startBtn.click();
    await element.updateComplete;

    // Should dispatch set-start-marker for the reset (m3) AND the original click (m3)
    expect(startEvents).toContain('m3');
  });
});

// ---------------------------------------------------------------------------
// Feature: click after active playing region extends stop to last marker (#43)
//
// When the user clicks on the timeline track at a position AFTER the current
// playback stop time (past the active playing region), the LAST marker in the
// markers array should be selected as the stop marker, extending the region.
// ---------------------------------------------------------------------------
describe('t-marker-slider click past playback stop extends stop marker (#43)', () => {
  let element: MarkerSlider;

  const markers: TroffMarker[] = [
    { color: 'green', id: 'm1', info: '', name: 'Start', time: 10 },
    { color: 'blue', id: 'm2', info: '', name: 'Mid', time: 50 },
    { color: 'red', id: 'm3', info: '', name: 'End', time: 90 },
  ];

  beforeEach(() => {
    element = new MarkerSlider();
    element.markers = markers;
    element.min = 0;
    element.max = 100;
    element.startMarkerId = 'm1';
    element.stopMarkerId = 'm2S'; // playback region: 10..50
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  /**
   * Simulates a click on the track wrapper at the given clientY.
   * The track wrapper is mocked to be 100px tall starting at top=0.
   *
   * Formula: positionPercent = (1 - clickY / rect.height) * 100
   *   → clickY = 0   → positionPercent = 100 → time = max (100)
   *   → clickY = 100 → positionPercent = 0   → time = min (0)
   */
  function simulateTrackClick(clientY: number): void {
    const trackWrapper = element.shadowRoot?.querySelector(
      '.slider-track-wrapper'
    ) as HTMLElement;
    vi.spyOn(trackWrapper, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 100, 100)
    );
    const clickEvent = new MouseEvent('mousedown', {
      clientY,
      bubbles: true,
      cancelable: true,
    });
    trackWrapper.dispatchEvent(clickEvent);
  }

  it('clicking after playback stop sets the last marker as stop', async () => {
    await element.updateComplete;

    // Playback stop = 50 (m2 time). With a 100px track, value = clientY,
    // so clientY=80 → value=80 > 50 (past the stop).
    simulateTrackClick(80);

    // The last marker (m3, time=90) should now be the stop marker.
    expect(element.stopMarkerId).toBe('m3S');
  });

  it('clicking before playback stop does NOT change marker selection', async () => {
    await element.updateComplete;

    const stopMarkerIdBefore = element.stopMarkerId;

    // Playback stop = 50. clientY=20 → value=20 < 50 (before the stop).
    simulateTrackClick(20);

    // Stop marker should remain unchanged.
    expect(element.stopMarkerId).toBe(stopMarkerIdBefore);
  });

  it('clicking at exactly playback stop does NOT change marker selection', async () => {
    await element.updateComplete;

    // Playback stop = 50. clientY=50 → value=50 == stop.
    simulateTrackClick(50);

    // Stop marker should remain unchanged (not past the region).
    expect(element.stopMarkerId).toBe('m2S');
  });

  it('dispatches set-stop-marker with the last marker ID when clicking past stop', async () => {
    await element.updateComplete;

    const stopEvents: string[] = [];
    element.addEventListener('set-stop-marker', ((e: CustomEvent) => {
      stopEvents.push(e.detail.markerId);
    }) as EventListener);

    // Click past the stop time (clientY=80 → value=80 > 50).
    simulateTrackClick(80);

    expect(stopEvents).toContain('m3');
  });

  it('still dispatches value-changed when clicking past stop', async () => {
    await element.updateComplete;

    const valueChangedEvents: number[] = [];
    element.addEventListener('value-changed', ((e: CustomEvent) => {
      valueChangedEvents.push(e.detail.value);
    }) as EventListener);

    // Click past the stop time (clientY=80 → value=80 > 50).
    simulateTrackClick(80);

    expect(valueChangedEvents.length).toBe(1);
    expect(valueChangedEvents[0]).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// Feature: gesture zoom persistence notification (regression: pinch/ctrl+wheel
// zoom lost on restart).
//
// `MarkerSlider._setZoom` is called from `_handleWheel` (ctrl/meta+wheel) and
// `_handleTouchMove` (two-finger pinch). It sets `zoomLevel` and adjusts the
// ancestor scrollTop but dispatches NO event and persists nothing, while
// `v2Script.ts` only persists the button path. The component MUST notify the
// persistence layer via a bubbling/composed `zoom-changed` CustomEvent with
// detail containing at least `{ zoomLevel: number }` so v2Script can save.
//
// Exactly one notification per effective zoom change; no notification when
// zoom is unchanged and panDelta == 0. Programmatic `zoomLevel = X` (how
// applyMarkerSliderZoom zooms) must NOT fire the gesture event.
// ---------------------------------------------------------------------------
describe('t-marker-slider gesture persistence notification', () => {
  let element: MarkerSlider;
  let wrapper: HTMLDivElement;

  beforeEach(() => {
    element = new MarkerSlider();
    wrapper = document.createElement('div');
    wrapper.style.overflowY = 'auto';
    wrapper.style.height = '800px';
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);
  });

  afterEach(() => {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
    vi.restoreAllMocks();
  });

  function dispatchCtrlWheelGesture(clientY: number, deltaY: number): void {
    const event = new WheelEvent('wheel', {
      deltaY,
      bubbles: true,
      cancelable: true,
    });
    Object.assign(event, { ctrlKey: true, clientY });
    element.dispatchEvent(event);
  }

  function mockGeometry(): void {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 800));
    const trackWrapper = element.shadowRoot?.querySelector('.slider-track-wrapper') as HTMLElement;
    vi.spyOn(trackWrapper, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 800));
  }

  function makeTouch(clientY: number, clientX = 0) {
    return { clientX, clientY } as Touch;
  }

  function dispatchTouchGesture(
    type: 'touchstart' | 'touchmove' | 'touchend',
    touchYs: number[]
  ): void {
    const touches = touchYs.map((y) => makeTouch(y));
    const event = new Event(type) as TouchEvent;
    Object.assign(event, { touches, changedTouches: touches, targetTouches: touches });
    element.dispatchEvent(event);
  }

  function collectZoomChanged(): { events: CustomEvent[]; listener: EventListener } {
    const events: CustomEvent[] = [];
    const listener = ((e: Event) => {
      events.push(e as CustomEvent);
    }) as EventListener;
    element.addEventListener('zoom-changed', listener);
    return { events, listener };
  }

  it('ctrl+wheel zoom dispatches zoom-changed once with new zoomLevel ~1.1', async () => {
    await element.updateComplete;
    mockGeometry();
    const { events } = collectZoomChanged();

    dispatchCtrlWheelGesture(400, -100); // zoom 1 -> 1.1
    await element.updateComplete;

    expect(element.zoomLevel).toBeCloseTo(1.1, 6);
    expect(events.length).toBe(1);
    expect(typeof events[0].detail.zoomLevel).toBe('number');
    expect(events[0].detail.zoomLevel).toBeCloseTo(1.1, 6);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('pinch zoom with fixed midpoint dispatches zoom-changed once with zoomLevel 3', async () => {
    await element.updateComplete;
    mockGeometry();
    const { events } = collectZoomChanged();

    dispatchTouchGesture('touchstart', [300, 500]); // midpoint 400, distance 200
    dispatchTouchGesture('touchmove', [100, 700]); // midpoint 400, distance 600 -> zoom 3
    await element.updateComplete;

    expect(element.zoomLevel).toBe(3);
    expect(events.length).toBe(1);
    expect(events[0].detail.zoomLevel).toBe(3);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('pinch pan alone (constant distance, midpoint move) dispatches zoom-changed', async () => {
    await element.updateComplete;
    mockGeometry();
    const { events } = collectZoomChanged();

    dispatchTouchGesture('touchstart', [300, 500]); // midpoint 400, distance 200
    dispatchTouchGesture('touchmove', [400, 600]); // midpoint 500, distance 200 -> pan only
    await element.updateComplete;

    expect(element.zoomLevel).toBe(1);
    expect(wrapper.scrollTop).toBe(-100);
    // Position changed so the persistence layer must be notified.
    expect(events.length).toBe(1);
    expect(typeof events[0].detail.zoomLevel).toBe('number');
  });

  it('dispatches no event when zoom unchanged and no pan (zoom-out clamped at minZoom)', async () => {
    await element.updateComplete;
    mockGeometry();
    expect(element.zoomLevel).toBe(1);
    expect(element.minZoom).toBe(1);
    const { events } = collectZoomChanged();

    // deltaY > 0 -> zoom 1 * 0.9 = 0.9 clamped back to minZoom 1, panDelta 0.
    dispatchCtrlWheelGesture(400, 100);
    await element.updateComplete;

    expect(element.zoomLevel).toBe(1);
    expect(events.length).toBe(0);
  });

  it('programmatic zoomLevel set dispatches NOTHING', async () => {
    await element.updateComplete;
    mockGeometry();
    const { events } = collectZoomChanged();

    // v2Script.ts applyMarkerSliderZoom zooms by setting zoomLevel directly.
    element.zoomLevel = 4;
    await element.updateComplete;

    expect(element.zoomLevel).toBe(4);
    expect(events.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Feature: vertical audio waveform display in t-marker-slider
//
// The component gains a `waveformPeaks: number[]` property (default []) and a
// <canvas class="waveform-canvas"> rendered in the shadow DOM INSIDE
// .slider-track-wrapper AFTER the .playback-region (the region is the
// wrapper's FIRST child so the solid region paints BEHIND the waveform;
// time flows top→bottom, so the waveform sits under the vertical timeline
// track — the merged track + waveform column). The canvas is styled
// `.waveform-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: pointer; }`
// (explicit width/height — a <canvas> is a REPLACED element, so `inset: 0`
// alone does NOT stretch it), seeks
// on mousedown exactly like the track, and is included in the single-finger
// touch-drag hit area (expandedRight extends past the waveform's right edge,
// not just the track wrapper's right edge + 15px).
// ---------------------------------------------------------------------------
describe('t-marker-slider waveform display', () => {
  let element: MarkerSlider;

  beforeEach(() => {
    element = new MarkerSlider();
    document.body.appendChild(element);

    // happy-dom's canvas support is incomplete — the component draws the
    // waveform through a 2d context, so stub getContext('2d') with a no-op.
    const ctxStub = new Proxy({} as object, { get: () => vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctxStub as unknown as CanvasRenderingContext2D
    );
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  function getWaveformCanvas(): HTMLCanvasElement | null {
    return element.shadowRoot?.querySelector('canvas.waveform-canvas') ?? null;
  }

  function getTrackWrapper(): HTMLElement {
    const trackWrapper = element.shadowRoot?.querySelector('.slider-track-wrapper');
    expect(trackWrapper).not.toBeNull();
    return trackWrapper as HTMLElement;
  }

  function getPresetsContainer(): HTMLElement {
    const presets = element.shadowRoot?.querySelector('.presets-container');
    expect(presets).not.toBeNull();
    return presets as HTMLElement;
  }

  it('exposes waveformPeaks, defaulting to an empty array', async () => {
    await element.updateComplete;

    expect(element.waveformPeaks).toEqual([]);
  });

  it('declares waveformPeaks as a reactive property and keeps an assigned value across re-render', async () => {
    // Declared with @property so external wiring (v2Script setting
    // markerSlider.waveformPeaks) triggers a re-render.
    expect(MarkerSlider.elementProperties.has('waveformPeaks')).toBe(true);

    element.waveformPeaks = [0.1, 0.5, 1];
    await element.updateComplete;

    expect(element.waveformPeaks).toEqual([0.1, 0.5, 1]);
  });

  it('renders the canvas inside the track wrapper, AFTER the playback region (region paints behind)', async () => {
    await element.updateComplete;

    const canvas = getWaveformCanvas();
    expect(canvas).not.toBeNull();

    // Merged column: the canvas lives INSIDE .slider-track-wrapper, but the
    // .playback-region is the FIRST child (paint order = DOM order), so the
    // solid region paints BEHIND the waveform.
    const wrapper = getTrackWrapper();
    const region = wrapper.firstElementChild;
    expect(region?.classList.contains('playback-region')).toBe(true);
    expect(canvas?.previousElementSibling).toBe(region);
    // The separate sibling canvas column is gone: the wrapper is directly
    // followed by the presets container.
    expect(wrapper.nextElementSibling).toBe(getPresetsContainer());
  });

  it('styles .waveform-canvas with explicit sizing to absolutely fill the track wrapper (position: absolute; width/height: 100%)', async () => {
    const cssText = String(MarkerSlider.styles);
    const ruleMatch = /\.waveform-canvas\s*\{([^}]*)\}/.exec(cssText);

    expect(ruleMatch).not.toBeNull();
    const ruleBody = ruleMatch?.[1] ?? '';
    expect(ruleBody).toMatch(/position:\s*absolute/);
    // Explicit sizing: <canvas> is a replaced element, so only an explicit
    // width/height (not `inset: 0`) makes it stretch to the wrapper.
    expect(ruleBody).toMatch(/width:\s*100%/);
    expect(ruleBody).toMatch(/height:\s*100%/);
    expect(ruleBody).toMatch(/cursor:\s*pointer/);
  });

  /**
   * Regression: canvas-sizing feedback loop (white canvas + sad face).
   *
   * `<canvas>` is a REPLACED element (like `<img>`): for an absolutely
   * positioned replaced element, `width: auto`/`height: auto` resolve to the
   * INTRINSIC size (the width/height attributes, default 300×150) — `inset: 0`
   * does NOT stretch it. The old rule
   * `.waveform-canvas { position: absolute; inset: 0; cursor: pointer; }`
   * therefore fed `_drawWaveform()` the intrinsic 300×150 rect instead of the
   * real column size, and each redraw did
   * `canvas.width = rect.width × devicePixelRatio` (300 → 450 → 675 → …),
   * growing the intrinsic size exponentially until the browser cap
   * (`width="33554433"` = last step before 2^25 at dpr 1.5) → allocation
   * failure → white canvas with the sad-face icon.
   *
   * The fix is an explicit `width` AND `height` in the rule (CSS then wins
   * over the intrinsic size). This test pins BOTH declarations so neither can
   * ever be silently dropped again — dropping either one is exactly how the
   * bug shipped.
   */
  it('regression: .waveform-canvas declares BOTH explicit width and height so intrinsic-size feedback cannot grow canvas.width', async () => {
    const cssText = String(MarkerSlider.styles);
    const ruleMatch = /\.waveform-canvas\s*\{([^}]*)\}/.exec(cssText);

    expect(ruleMatch).not.toBeNull();
    const ruleBody = ruleMatch?.[1] ?? '';
    // Both explicit — `inset: 0` alone does not size a replaced element.
    expect(ruleBody).toMatch(/width:\s*100%/);
    expect(ruleBody).toMatch(/height:\s*100%/);
  });

  it('mousedown on the waveform canvas seeks like the track (value + value-changed)', async () => {
    await element.updateComplete;

    const canvas = getWaveformCanvas();
    expect(canvas).not.toBeNull();

    // Track and canvas share the same vertical extent: a 100px-tall slider.
    // The seek math maps clientY to value as value = (clientY / height) * 100
    // (min 0, max 100), so clientY 80 -> value 80.
    vi.spyOn(getTrackWrapper(), 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 100, 100)
    );
    vi.spyOn(canvas as HTMLCanvasElement, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 100, 100)
    );

    const valueChanged: number[] = [];
    element.addEventListener('value-changed', ((e: CustomEvent) => {
      valueChanged.push(e.detail.value);
    }) as EventListener);

    (canvas as HTMLCanvasElement).dispatchEvent(
      new MouseEvent('mousedown', { clientY: 80, bubbles: true, cancelable: true })
    );

    expect(element.value).toBe(80);
    expect(valueChanged).toEqual([80]);
  });

  /**
   * Layout used by the touch-drag hit-area tests:
   *  - track wrapper occupies x 0..50, y 0..800
   *  - waveform canvas occupies x 50..100, y 0..800
   *
   * The legacy hit area only covered trackRect.right + 15 = x 65. A touch on
   * the waveform canvas at x 80 must count as a drag-seek, not a scroll.
   */
  function mockTrackAndWaveformGeometry(): void {
    vi.spyOn(getTrackWrapper(), 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 50, 800)
    );
    const canvas = getWaveformCanvas();
    if (canvas) {
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(50, 0, 50, 800));
    }
  }

  function dispatchSingleTouchStart(clientX: number, clientY: number): void {
    const touch = { clientX, clientY } as Touch;
    const event = new Event('touchstart') as TouchEvent;
    Object.assign(event, { touches: [touch], changedTouches: [touch], targetTouches: [touch] });
    element.dispatchEvent(event);
  }

  it('a single-finger touchstart over the waveform canvas (beyond track right + 15) drag-seeks', async () => {
    await element.updateComplete;
    mockTrackAndWaveformGeometry();

    // x 80 is inside the waveform canvas (50..100) but beyond the legacy
    // expandedRight of 65. Seek math: value = (clientY / height) * 100, so
    // y 600 on the 800px track -> value 75.
    dispatchSingleTouchStart(80, 600);

    expect(element.value).toBe(75);
  });

  it('a single-finger touchstart within the legacy track hit area still drag-seeks (regression)', async () => {
    await element.updateComplete;
    mockTrackAndWaveformGeometry();

    // x 30 was already inside the old expanded area (0 - 15 .. 50 + 15).
    // y 600 on the 800px track -> value 75.
    dispatchSingleTouchStart(30, 600);

    expect(element.value).toBe(75);
  });
});

// ---------------------------------------------------------------------------
// Feature: merge the slider track column with the waveform column (one column)
//
// Approved design: the <canvas class="waveform-canvas"> lives INSIDE
// .slider-track-wrapper AFTER the .playback-region — the region is the
// wrapper's FIRST child (paint order = DOM order), so the SOLID, full-width
// region (left: 0; right: 0; NO opacity) paints BEHIND the waveform while the
// thumb (z-index: 10) stays on top. The 5px center .slider-track line is gone
// (CSS rule and element removed). The wrapper widens to
// `width: var(--waveform-width)` (31px mobile / 42px ≥576px, declared in
// stylesheets/variables.css)
// with no horizontal padding, and the separate sibling canvas column is
// removed — the wrapper's next sibling is now .presets-container. The thumb
// gains a full-width .thumb-line
// (`width: var(--waveform-width)`) nested inside .slider-thumb so it travels
// with the thumb.
//
// The visual tweaks (no center track line, solid full-width region behind the
// waveform) are locked by the tests below.
// ---------------------------------------------------------------------------
describe('t-marker-slider merged track + waveform column', () => {
  let element: MarkerSlider;

  beforeEach(() => {
    element = new MarkerSlider();
    document.body.appendChild(element);

    // happy-dom's canvas support is incomplete — the component draws the
    // waveform through a 2d context, so stub getContext('2d') with a no-op
    // (same pattern as the waveform display suite above).
    const ctxStub = new Proxy({} as object, { get: () => vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctxStub as unknown as CanvasRenderingContext2D
    );
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  function getWrapper(): HTMLElement {
    const wrapper = element.shadowRoot?.querySelector('.slider-track-wrapper');
    expect(wrapper).not.toBeNull();
    return wrapper as HTMLElement;
  }

  function getPresetsContainer(): HTMLElement {
    const presets = element.shadowRoot?.querySelector('.presets-container');
    expect(presets).not.toBeNull();
    return presets as HTMLElement;
  }

  /** Body of the first rule matching `pattern` in the component's static CSS. */
  function getStyleRuleBody(pattern: RegExp): string {
    const match = pattern.exec(String(MarkerSlider.styles));
    expect(
      match,
      `expected MarkerSlider.styles to contain a rule matching ${pattern}`
    ).not.toBeNull();
    return match?.[1] ?? '';
  }

  it('renders the waveform canvas INSIDE .slider-track-wrapper (sibling column removed)', async () => {
    await element.updateComplete;

    const wrapper = getWrapper();
    expect(wrapper.querySelector('canvas.waveform-canvas')).not.toBeNull();
    // The old sibling canvas between wrapper and presets is gone: the
    // wrapper is directly followed by the presets container.
    expect(wrapper.nextElementSibling).toBe(getPresetsContainer());
  });

  it('widens .slider-track-wrapper to var(--waveform-width)', () => {
    const ruleBody = getStyleRuleBody(/\.slider-track-wrapper\s*\{([^}]*)\}/);
    expect(ruleBody).toMatch(/width:\s*var\(--waveform-width\)/);
  });

  // --waveform-width is mobile-first responsive in stylesheets/variables.css:
  // 31px at the base :root (mobile), 42px inside @media (min-width: 576px)
  // (larger screens). The consumers (.slider-track-wrapper and .thumb-line)
  // both just use width: var(--waveform-width) and need no change.
  it('declares a mobile-first base --waveform-width: 31px in stylesheets/variables.css', () => {
    const css = readFileSync(path.join(repoRoot, 'stylesheets', 'variables.css'), 'utf-8');
    expect(/--waveform-width:\s*31px\s*;/.exec(css)).not.toBeNull();
  });

  it('declares a @media (min-width: 576px) block in stylesheets/variables.css', () => {
    const css = readFileSync(path.join(repoRoot, 'stylesheets', 'variables.css'), 'utf-8');
    expect(/@media\s*\(min-width:\s*576px\)/.exec(css)).not.toBeNull();
  });

  it('sets --waveform-width: 42px inside the @media (min-width: 576px) block', () => {
    const css = readFileSync(path.join(repoRoot, 'stylesheets', 'variables.css'), 'utf-8');
    expect(
      /@media\s*\(min-width:\s*576px\)\s*\{[\s\S]*?--waveform-width:\s*42px\s*;/.exec(css)
    ).not.toBeNull();
  });

  it('renders .playback-region solid and full width (no opacity, no --slider-playback-region-width)', () => {
    const ruleBody = getStyleRuleBody(/\.playback-region\s*\{([^}]*)\}/);
    // Solid: no opacity declaration at all (the waveform shows through only
    // where the canvas itself is transparent, not via a faded region).
    expect(ruleBody).not.toMatch(/opacity:/);
    // Full width: anchored to BOTH edges instead of the old centered
    // --slider-playback-region-width band.
    expect(ruleBody).toMatch(/left:\s*0(?![-\w.])/);
    expect(ruleBody).toMatch(/right:\s*0(?![-\w.])/);
    expect(ruleBody).not.toMatch(/--slider-playback-region-width/);
  });

  it('renders a .thumb-line element inside .slider-thumb', async () => {
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.slider-thumb .thumb-line')).not.toBeNull();
  });

  it('spans .thumb-line across the full waveform column width', () => {
    const ruleBody = getStyleRuleBody(/\.thumb-line\s*\{([^}]*)\}/);
    expect(ruleBody).toMatch(/width:\s*var\(--waveform-width\)/);
  });

  it('keeps .thumb-line inside the thumb so it follows the thumb position', async () => {
    element.value = 30;
    await element.updateComplete;

    const thumb = element.shadowRoot?.querySelector('.slider-thumb');
    expect(thumb).not.toBeNull();

    let thumbLine = element.shadowRoot?.querySelector('.slider-thumb .thumb-line');
    expect(thumbLine).not.toBeNull();
    // The line has no position of its own — it rides along with the thumb,
    // which IS positioned inline from `value`.
    expect(thumbLine?.parentElement).toBe(thumb);
    expect(thumb?.getAttribute('style') ?? '').toContain('top: calc(30%)');

    // Moving the value re-positions the thumb; the line stays nested inside,
    // so it inherits the movement.
    element.value = 70;
    await element.updateComplete;
    expect(thumb?.getAttribute('style') ?? '').toContain('top: calc(70%)');
    thumbLine = element.shadowRoot?.querySelector('.slider-thumb .thumb-line');
    expect(thumbLine?.parentElement).toBe(thumb);
  });

  it('still seeks (value-changed) from mousedown on the canvas in its new home inside the wrapper', async () => {
    await element.updateComplete;

    const wrapper = getWrapper();
    const canvas = wrapper.querySelector('canvas.waveform-canvas') as HTMLCanvasElement | null;
    expect(canvas).not.toBeNull();

    // Seek math reads the wrapper rect: a 100px-tall track means
    // value = (1 - clientY / 100) * 100, so clientY 80 -> value 80.
    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100));

    const valueChanged: number[] = [];
    element.addEventListener('value-changed', ((e: CustomEvent) => {
      valueChanged.push(e.detail.value);
    }) as EventListener);

    canvas?.dispatchEvent(
      new MouseEvent('mousedown', { clientY: 80, bubbles: true, cancelable: true })
    );

    expect(element.value).toBe(80);
    // Exactly one seek per click — the wrapper's own mousedown handler must
    // not fire a second time now that the canvas is its child.
    expect(valueChanged).toEqual([80]);
  });

  it('still draws waveformPeaks onto the canvas inside the wrapper', async () => {
    await element.updateComplete;

    const wrapper = getWrapper();
    const canvas = wrapper.querySelector('canvas.waveform-canvas') as HTMLCanvasElement | null;
    expect(canvas).not.toBeNull();

    // _drawWaveform bails out on a zero-sized rect, so give the canvas a real
    // size and hand it some peaks. A successful draw resizes the backing
    // store (happy-dom's default canvas width is 300), which is observable
    // without a real 2d context.
    vi.spyOn(canvas as HTMLCanvasElement, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 42, 800)
    );
    element.waveformPeaks = [0.1, 0.5, 1];
    await element.updateComplete;

    expect((canvas as HTMLCanvasElement).width).toBe(
      Math.round(42 * (window.devicePixelRatio || 1))
    );
  });

  /**
   * Mocks the waveform canvas geometry (same 42×800 rect as the draw test
   * above) and swaps in a STABLE 2d context so fillRect/clearRect call
   * history is observable — the shared beforeEach stub hands out a fresh
   * `vi.fn()` on every property access, which cannot be asserted on.
   */
  function mockWaveformCanvasDrawContext(): {
    fillRect: ReturnType<typeof vi.fn>;
    clearRect: ReturnType<typeof vi.fn>;
  } {
    const canvas = getWrapper().querySelector('canvas.waveform-canvas') as HTMLCanvasElement | null;
    expect(canvas).not.toBeNull();
    vi.spyOn(canvas as HTMLCanvasElement, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 42, 800)
    );
    const fillRect = vi.fn();
    const clearRect = vi.fn();
    vi.spyOn(canvas as HTMLCanvasElement, 'getContext').mockReturnValue({
      fillRect,
      clearRect,
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    return { fillRect, clearRect };
  }

  /**
   * Regression (song switch): the OLD waveform stays visible for a moment
   * because, while the next song's peaks generate, `waveformPeaks` is
   * cleared to [] — but `_drawWaveform()` early-returns on empty peaks
   * WITHOUT clearing the canvas, leaving the previous song's bars painted.
   * Empty peaks must wipe the canvas instead of bailing out.
   */
  it('wipes the canvas when waveformPeaks becomes empty (song switch clears the old waveform)', async () => {
    await element.updateComplete;

    const { fillRect, clearRect } = mockWaveformCanvasDrawContext();

    // Draw first so the canvas is NOT blank (a successful draw paints one
    // bar per peak via fillRect, same path as the existing draw test).
    element.waveformPeaks = [0.1, 0.5, 1];
    await element.updateComplete;
    expect(fillRect).toHaveBeenCalled();

    // Snapshot the counters, then simulate the song switch: the peaks are
    // cleared while the next song's peaks are still generating.
    const fillRectCallsAfterDraw = fillRect.mock.calls.length;
    const clearRectCallsAfterDraw = clearRect.mock.calls.length;
    element.waveformPeaks = [];
    await element.updateComplete;

    expect(
      clearRect,
      'empty peaks must clear the old waveform off the canvas'
    ).toHaveBeenCalledTimes(clearRectCallsAfterDraw + 1);
    expect(fillRect, 'no new bars may be drawn for empty peaks').toHaveBeenCalledTimes(
      fillRectCallsAfterDraw
    );
  });

  /** Companion redraw guard: after an empty-peaks wipe, fresh peaks must draw again. */
  it('draws again after a clear when new peaks arrive', async () => {
    await element.updateComplete;

    const { fillRect } = mockWaveformCanvasDrawContext();

    element.waveformPeaks = [0.1, 0.5, 1];
    await element.updateComplete;
    const fillRectCallsAfterFirstDraw = fillRect.mock.calls.length;
    expect(fillRectCallsAfterFirstDraw).toBeGreaterThan(0);

    // Song switch clears the peaks mid-load…
    element.waveformPeaks = [];
    await element.updateComplete;

    // …then the next song's peaks arrive — the new waveform must be drawn.
    element.waveformPeaks = [0.2, 0.4];
    await element.updateComplete;

    expect(fillRect.mock.calls.length).toBeGreaterThan(fillRectCallsAfterFirstDraw);
  });
});

// ---------------------------------------------------------------------------
// Feature: visual tweaks — remove the 5px center track line; make the
// playback region solid, full width and BEHIND the waveform.
//
// Tweak 1: the `.slider-track` CSS rule and the `<div class="slider-track">`
// element are gone. The column keeps its `.slider-track-wrapper` container and
// `--slider-track-width` stays in stylesheets/variables.css (still used by
// components/atom/t-vertical-slider.ts).
//
// Tweak 2: `.playback-region` is solid (NO opacity declaration), full width
// (`left: 0; right: 0` — no `--slider-playback-region-width` reference; that
// variable is removed from stylesheets/variables.css) and is the FIRST child
// of .slider-track-wrapper, so paint order (= DOM order) puts it BEHIND the
// canvas while the thumb (z-index: 10) still rides on top.
//
// All tests here are RED until the tweaks are implemented.
// ---------------------------------------------------------------------------
describe('t-marker-slider visual tweaks: no center track line, solid full-width region behind waveform', () => {
  let element: MarkerSlider;

  beforeEach(() => {
    element = new MarkerSlider();
    document.body.appendChild(element);

    // Same happy-dom canvas stub as the suites above — the component draws the
    // waveform through a 2d context on every update.
    const ctxStub = new Proxy({} as object, { get: () => vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctxStub as unknown as CanvasRenderingContext2D
    );
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  function getWrapper(): HTMLElement {
    const wrapper = element.shadowRoot?.querySelector('.slider-track-wrapper');
    expect(wrapper).not.toBeNull();
    return wrapper as HTMLElement;
  }

  /**
   * First rule body matching `pattern` in the component's static CSS, or null
   * when no such rule exists (the presence-asserting variant used by the
   * suite above cannot express "rule must be absent").
   */
  function findStyleRuleBody(pattern: RegExp): string | null {
    return pattern.exec(String(MarkerSlider.styles))?.[1] ?? null;
  }

  it('has no .slider-track rule in MarkerSlider.styles', () => {
    // Class-selector semantics: /\.slider-track\s*\{/ does NOT match
    // `.slider-track-wrapper {` (the -wrapper suffix keeps it from matching),
    // so a null result means the center-track rule is truly gone while the
    // wrapper rule survives untouched.
    const ruleBody = findStyleRuleBody(/\.slider-track\s*\{([^}]*)\}/);
    expect(ruleBody, 'expected the .slider-track CSS rule to be removed').toBeNull();
  });

  it('renders no .slider-track element', async () => {
    await element.updateComplete;

    // querySelector('.slider-track') matches ONLY that exact class, so a
    // .slider-track-wrapper element does not satisfy it.
    expect(element.shadowRoot?.querySelector('.slider-track')).toBeNull();
  });

  it('paints the playback region FIRST (behind) and the canvas after it', async () => {
    await element.updateComplete;

    const wrapper = getWrapper();
    const region = wrapper.firstElementChild;
    expect(region?.classList.contains('playback-region')).toBe(true);

    const canvas = wrapper.querySelector('canvas.waveform-canvas');
    expect(canvas).not.toBeNull();
    expect(region?.nextElementSibling).toBe(canvas);
    expect(canvas?.previousElementSibling).toBe(region);
  });

  it('makes .playback-region solid and full width with no --slider-playback-region-width reference', () => {
    const cssText = String(MarkerSlider.styles);
    expect(cssText, 'MarkerSlider styles must not reference the removed variable').not.toMatch(
      /--slider-playback-region-width/
    );

    const ruleBody = findStyleRuleBody(/\.playback-region\s*\{([^}]*)\}/);
    expect(ruleBody, 'expected a .playback-region rule in MarkerSlider static styles').not.toBeNull();
    // Solid (no opacity), full width (both edges) instead of the old
    // centered, translucent --slider-playback-region-width band.
    expect(ruleBody ?? '').not.toMatch(/opacity:/);
    expect(ruleBody ?? '').toMatch(/left:\s*0(?![-\w.])/);
    expect(ruleBody ?? '').toMatch(/right:\s*0(?![-\w.])/);
  });

  it('no longer declares --slider-playback-region-width in stylesheets/variables.css', () => {
    // Same file + path logic as the --waveform-width test in the suite above;
    // `--slider-track-width` must remain (t-vertical-slider still uses it).
    const css = readFileSync(path.join(repoRoot, 'stylesheets', 'variables.css'), 'utf-8');
    expect(
      /--slider-playback-region-width\s*:/.exec(css),
      'expected --slider-playback-region-width to be removed from stylesheets/variables.css'
    ).toBeNull();
  });
});
