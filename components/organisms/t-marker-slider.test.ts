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
