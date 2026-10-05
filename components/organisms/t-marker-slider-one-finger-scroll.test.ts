import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarkerSlider } from './t-marker-slider.js';
import type { TroffMarker } from '../../types/troff.js';

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

describe('t-marker-slider one-finger scroll in markers area', () => {
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

  function mockGeometry(): void {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 800));
    const trackWrapper = element.shadowRoot?.querySelector(
      '.slider-track-wrapper'
    ) as HTMLElement;
    vi.spyOn(trackWrapper, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 60, 800));
    const presets = element.shadowRoot?.querySelector('.presets-container') as HTMLElement;
    vi.spyOn(presets, 'getBoundingClientRect').mockReturnValue(new DOMRect(60, 0, 740, 800));
  }

  function makeTouch(clientX: number, clientY: number): Touch {
    return { clientX, clientY } as Touch;
  }

  function dispatchTouch(type: 'touchstart' | 'touchmove' | 'touchend', touches: Touch[]): void {
    const event = new Event(type) as TouchEvent;
    Object.assign(event, { touches, changedTouches: touches, targetTouches: touches });
    element.dispatchEvent(event);
  }

  function collectValueChanged(): number[] {
    const values: number[] = [];
    element.addEventListener('value-changed', ((e: CustomEvent) => {
      values.push(e.detail.value);
    }) as EventListener);
    return values;
  }

  it('one-finger drag UP starting in markers area scrolls the wrapper up (content follows fingers)', async () => {
    element.markers = [makeMarker({ id: 'm1', time: 20 }), makeMarker({ id: 'm2', time: 80 })];
    element.min = 0;
    element.max = 100;
    element.value = 50;
    await element.updateComplete;
    mockGeometry();
    const valueEvents = collectValueChanged();
    const zoomBefore = element.zoomLevel;
    wrapper.scrollTop = 100;

    dispatchTouch('touchstart', [makeTouch(300, 400)]);
    dispatchTouch('touchmove', [makeTouch(300, 300)]);
    await element.updateComplete;

    // Fingers moved UP 100px -> content follows up -> scrollTop increases.
    expect(wrapper.scrollTop).toBeGreaterThan(100);
    expect(element.zoomLevel).toBe(zoomBefore);
    expect(valueEvents.length).toBe(0);
  });

  it('one-finger drag DOWN starting in markers area scrolls the wrapper down', async () => {
    element.markers = [makeMarker({ id: 'm1', time: 20 }), makeMarker({ id: 'm2', time: 80 })];
    element.min = 0;
    element.max = 100;
    element.value = 50;
    await element.updateComplete;
    mockGeometry();
    wrapper.scrollTop = 100;

    dispatchTouch('touchstart', [makeTouch(300, 400)]);
    dispatchTouch('touchmove', [makeTouch(300, 500)]);
    await element.updateComplete;

    expect(wrapper.scrollTop).toBeLessThan(100);
  });

  it('one-finger drag starting in a gap between markers also scrolls', async () => {
    element.markers = [makeMarker({ id: 'm1', time: 20 }), makeMarker({ id: 'm2', time: 80 })];
    element.min = 0;
    element.max = 100;
    element.value = 50;
    await element.updateComplete;
    mockGeometry();
    wrapper.scrollTop = 100;

    // clientX=500 is well outside the track (0..60) at a Y with no marker.
    dispatchTouch('touchstart', [makeTouch(500, 700)]);
    dispatchTouch('touchmove', [makeTouch(500, 600)]);
    await element.updateComplete;

    expect(wrapper.scrollTop).toBeGreaterThan(100);
  });

  it('tap in markers area without move does not scroll or scrub; drag on track still scrubs', async () => {
    element.markers = [makeMarker({ id: 'm1', time: 20 }), makeMarker({ id: 'm2', time: 80 })];
    element.min = 0;
    element.max = 100;
    element.value = 50;
    await element.updateComplete;
    mockGeometry();

    // Tap with no move.
    const tapValues = collectValueChanged();
    wrapper.scrollTop = 100;
    const valueBeforeTap = element.value;
    dispatchTouch('touchstart', [makeTouch(300, 400)]);
    dispatchTouch('touchend', []);
    await element.updateComplete;
    expect(wrapper.scrollTop).toBe(100);
    expect(element.value).toBe(valueBeforeTap);
    expect(tapValues.length).toBe(0);

    // Drag starting ON the track scrubs.
    const scrubValues = collectValueChanged();
    const scrollBeforeScrub = wrapper.scrollTop;
    const valueBeforeScrub = element.value;
    dispatchTouch('touchstart', [makeTouch(30, 400)]);
    dispatchTouch('touchmove', [makeTouch(30, 300)]);
    await element.updateComplete;
    expect(scrubValues.length).toBeGreaterThan(0);
    expect(element.value).not.toBe(valueBeforeScrub);
    expect(wrapper.scrollTop).toBe(scrollBeforeScrub);
  });
});
