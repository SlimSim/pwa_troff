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
});
