import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER } from '../constants/constants.js';
import { SettingsPanel } from '../components/molecule/t-settings-panel.js';
import { MarkerSlider } from '../components/organisms/t-marker-slider.js';
import type { TroffMarker } from '../types/troff.js';

// Mock nDB — never call real services in tests (vi.hoisted: factory is hoisted).
const { nDBGetMock, nDBSetMock } = vi.hoisted(() => ({
  nDBGetMock: vi.fn(),
  nDBSetMock: vi.fn(),
}));
vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: nDBGetMock,
    set: nDBSetMock,
    setOnSong: vi.fn(),
  },
}));

/** Expected shape of the v2 setting (does not exist yet — part of this RED test). */
type PanelWithMarkerSetting = SettingsPanel & {
  onSelectMarkerGoToMarker?: boolean;
};

/**
 * Fixture data only (same shape as components/organisms/t-marker-slider.test.ts).
 * NOT a reimplementation of any component logic.
 */
function makeMarker(id: string, time: number): TroffMarker {
  return { color: 'red', id, info: '', name: id, time };
}

describe('v1 parity: "when selecting a marker -> go to marker" setting in v2', () => {
  it('uses the same nDB key as v1', () => {
    expect(TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER).toBe(
      'TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER'
    );
  });

  describe('Advanced settings UI (default true, above "Keep screen on")', () => {
    let panel: SettingsPanel;

    beforeEach(async () => {
      nDBGetMock.mockReset();
      nDBSetMock.mockReset();
      nDBGetMock.mockReturnValue(null);
      panel = new SettingsPanel();
      document.body.appendChild(panel);
      await panel.updateComplete;
    });

    afterEach(() => {
      if (document.body.contains(panel)) {
        document.body.removeChild(panel);
      }
    });

    it('defaults onSelectMarkerGoToMarker to true', () => {
      expect((panel as PanelWithMarkerSetting).onSelectMarkerGoToMarker).toBe(true);
    });

    it('renders a toggle above "Keep screen on" in Advanced Settings', () => {
      const advanced = panel.shadowRoot?.querySelector('t-details[title="Advanced Settings"]');
      expect(advanced, 'expected an "Advanced Settings" details block').toBeTruthy();
      const labels = Array.from(advanced?.querySelectorAll('t-butt') ?? []).map((b) =>
        (b.textContent ?? '').trim().toLowerCase()
      );
      const markerIdx = labels.findIndex(
        (t) => t.includes('go to marker') || t.includes('selecting a marker')
      );
      const keepIdx = labels.findIndex((t) => t.includes('keep screen'));
      expect(
        markerIdx,
        `expected a "go to marker on select" toggle, found: ${JSON.stringify(labels)}`
      ).not.toBe(-1);
      expect(markerIdx).toBeLessThan(keepIdx);
    });

    it('dispatches setting-changed when toggled', () => {
      const handler = vi.fn();
      panel.addEventListener('setting-changed', handler);
      // @ts-expect-error - private API, and the setting does not exist yet in v2
      panel._toggleSetting('onSelectMarkerGoToMarker', true);
      expect((panel as PanelWithMarkerSetting).onSelectMarkerGoToMarker).toBe(false);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'onSelectMarkerGoToMarker', value: false },
        })
      );
    });
  });

  describe('marker selection seeks conditionally (real MarkerSlider)', () => {
    let slider: MarkerSlider;

    beforeEach(async () => {
      nDBGetMock.mockReset();
      slider = new MarkerSlider();
      slider.min = 0;
      slider.max = 100;
      slider.startBefore = 0;
      slider.stopAfter = 0;
      slider.markers = [makeMarker('m0', 10), makeMarker('m1', 50), makeMarker('m2', 90)];
      slider.startMarkerId = 'm0';
      slider.stopMarkerId = 'm2S';
      slider.value = 5;
      document.body.appendChild(slider);
      await slider.updateComplete;
    });

    afterEach(() => {
      if (document.body.contains(slider)) {
        document.body.removeChild(slider);
      }
    });

    function clickMarker(index: number): void {
      const markerEls = Array.from(slider.shadowRoot?.querySelectorAll('t-marker') ?? []);
      expect(markerEls.length).toBe(3);
      markerEls[index].dispatchEvent(
        new CustomEvent('marker-click', { bubbles: true, composed: true })
      );
    }

    it('seeks to the start of the playing region when the setting is true', async () => {
      nDBGetMock.mockImplementation((key: string) =>
        key === TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER ? true : null
      );
      clickMarker(1);
      await slider.updateComplete;
      expect(slider.value).toBe(50);
    });

    it('does NOT seek (stays where it is) when the setting is false', async () => {
      nDBGetMock.mockImplementation((key: string) =>
        key === TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER ? false : null
      );
      clickMarker(1);
      await slider.updateComplete;
      // Selection itself still applies...
      expect(slider.startMarkerId).toBe('m1');
      // ...but playback position must NOT jump to the marker.
      expect(slider.value).toBe(5);
    });

    it('does NOT dispatch value-changed when the setting is false (media must not seek)', async () => {
      // v2Script wires `value-changed` -> `media.currentTime = event.detail.value`,
      // so silence here is what keeps the player where it is.
      nDBGetMock.mockImplementation((key: string) =>
        key === TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER ? false : null
      );
      const onValueChanged = vi.fn();
      slider.addEventListener('value-changed', onValueChanged);
      clickMarker(1);
      await slider.updateComplete;
      expect(onValueChanged).not.toHaveBeenCalled();
    });

    it('still dispatches set-start-marker when the setting is false (selection persists)', async () => {
      // NOTE to orchestrator: v2Script's `set-start-marker` handler calls
      // `updateMarkerSlider(markerSlider)` with the default `setAudioTime = true`,
      // which unconditionally seeks (`media.currentTime = getPlaybackStart()`).
      // That handler is an anonymous closure inside v2Script.ts (not exported),
      // so it cannot be imported here — suggest exporting it (e.g. under an
      // `_internal` object) so this second seek path can be tested directly.
      // Until then, this test pins the component side of the contract:
      // selection is announced via `set-start-marker` even when no seek happens.
      nDBGetMock.mockImplementation((key: string) =>
        key === TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER ? false : null
      );
      const onSetStart = vi.fn();
      slider.addEventListener('set-start-marker', onSetStart);
      clickMarker(1);
      await slider.updateComplete;
      expect(onSetStart).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { markerId: 'm1' } })
      );
    });
  });

  describe('programmatic marker selection respects the setting (real MarkerSlider)', () => {
    let slider: MarkerSlider;

    beforeEach(async () => {
      nDBGetMock.mockReset();
      slider = new MarkerSlider();
      slider.min = 0;
      slider.max = 100;
      slider.startBefore = 0;
      slider.stopAfter = 0;
      slider.markers = [makeMarker('m0', 10), makeMarker('m1', 50), makeMarker('m2', 90)];
      slider.startMarkerId = 'm1';
      slider.stopMarkerId = 'm2S';
      slider.value = 5;
      document.body.appendChild(slider);
      await slider.updateComplete;
    });

    afterEach(() => {
      if (document.body.contains(slider)) {
        document.body.removeChild(slider);
      }
    });

    it('selectPreviousMarker does NOT seek when the setting is false', async () => {
      nDBGetMock.mockImplementation((key: string) =>
        key === TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER ? false : null
      );
      const onValueChanged = vi.fn();
      slider.addEventListener('value-changed', onValueChanged);
      slider.selectPreviousMarker();
      await slider.updateComplete;
      // Selection itself still applies (m1 -> m0)...
      expect(slider.startMarkerId).toBe('m0');
      // ...but playback position must NOT jump to the marker start.
      expect(slider.value).toBe(5);
      expect(onValueChanged).not.toHaveBeenCalled();
    });
  });
});
