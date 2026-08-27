import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarkerSlider } from './t-marker-slider.js';
import type { TroffMarker } from '../../types/troff.js';

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
    const clickEvent = new MouseEvent('click', {
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
