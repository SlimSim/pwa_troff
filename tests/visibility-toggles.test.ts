import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsPanel } from '../components/molecule/t-settings-panel.js';
import { CurrentSongControls } from '../components/molecule/t-current-song-controls.js';
import { nDB } from '../assets/internal/db.js';
import {
  TROFF_SETTING_UI_ZOOM_SHOW,
  TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW,
  TROFF_SETTING_UI_LOOP_BUTTONS_SHOW,
} from '../constants/constants.js';
import type { DetailsElement } from '../components/atom/t-details.js';
import type { TButt } from '../components/atom/t-butt.js';

/**
 * Visibility toggles (v1 parity) — RED tests.
 *
 * Feature: `t-settings-panel` (div.global-settings) gains a `t-details`
 * titled "Visibility" immediately after the "Theme" section, with three
 * toggle buttons (zoom buttons / play-full-song button / loop-count
 * selector). The toggles persist to nDB under the exact keys v1 uses (see
 * TROFF_SETTING_UI_*_SHOW in constants/constants.ts, matching the
 * `data-st-save-value-key` ids in v1.html/index.html), and
 * `t-current-song-controls` hides/shows the three control groups based on
 * those nDB values (default: visible, matching v1's default-active
 * buttons).
 *
 * Assumptions for the implementer (consistent with this codebase):
 * - toggles are `t-butt` with the `toggle` attribute, `active` when the
 *   control group is visible (v1 defaults to active/shown);
 * - clicking a toggle writes a boolean to nDB under its v1 key (the same
 *   direct-nDB pattern this component already uses for
 *   `TROFF_SETTING_PREFER_VERSION`), so the value survives reloads;
 * - `t-current-song-controls` consults the nDB values (falling back to
 *   visible when unset) and removes or hides (`hidden` attribute /
 *   `display:none`) the corresponding controls.
 */

// Literal v1 key strings, as used by v1.html/index.html
// (`data-st-save-value-key` / element ids).
const V1_ZOOM_KEY = 'TROFF_SETTING_UI_ZOOM_SHOW';
const V1_PLAY_FULL_SONG_KEY = 'TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW';
const V1_LOOP_KEY = 'TROFF_SETTING_UI_LOOP_BUTTONS_SHOW';

// ---------- shared helpers ----------

function globalDetailsTitles(panel: SettingsPanel): string[] {
  const globalSettings = panel.shadowRoot?.querySelector('.global-settings');
  if (!globalSettings) return [];
  return Array.from(globalSettings.querySelectorAll('t-details')).map((d) =>
    (d.getAttribute('title') ?? '').trim()
  );
}

function findDetailsByTitle(panel: SettingsPanel, title: string): DetailsElement | undefined {
  const globalSettings = panel.shadowRoot?.querySelector('.global-settings');
  if (!globalSettings) return undefined;
  const all = Array.from(globalSettings.querySelectorAll('t-details')) as DetailsElement[];
  return all.find((d) => (d.getAttribute('title') ?? '').trim() === title);
}

interface VisibilityToggles {
  zoom?: TButt;
  playFullSong?: TButt;
  loopCount?: TButt;
}

function getVisibilityToggles(panel: SettingsPanel): VisibilityToggles {
  const visibility = findDetailsByTitle(panel, 'Visibility');
  if (!visibility) return {};
  const buttons = Array.from(visibility.querySelectorAll('t-butt')) as TButt[];
  const textOf = (b: TButt): string => (b.textContent ?? '').toLowerCase();
  return {
    zoom: buttons.find((b) => textOf(b).includes('zoom')),
    playFullSong: buttons.find((b) => textOf(b).includes('play full song')),
    loopCount: buttons.find((b) => textOf(b).includes('loop')),
  };
}

function findZoomButtons(el: CurrentSongControls): TButt[] {
  const buttons = Array.from(el.shadowRoot?.querySelectorAll('t-butt') ?? []) as TButt[];
  return buttons.filter((b) => {
    const text = (b.textContent ?? '').trim().toLowerCase();
    return text === 'zoom' || text === 'zoom out';
  });
}

function findPlayFullSongButton(el: CurrentSongControls): TButt | undefined {
  const buttons = Array.from(el.shadowRoot?.querySelectorAll('t-butt') ?? []) as TButt[];
  return buttons.find((b) => (b.textContent ?? '').toLowerCase().includes('play full song'));
}

function findLoopButtonsContainer(el: CurrentSongControls): HTMLElement | null {
  return el.shadowRoot?.querySelector('.loop-buttons') as HTMLElement | null;
}

/** A control counts as shown only when present in the DOM and not hidden. */
function isShown(node: Element | null | undefined): boolean {
  if (!node) return false;
  const html = node as HTMLElement;
  if (html.hasAttribute('hidden')) return false;
  if (html.style.display === 'none') return false;
  if (html.closest('[hidden]')) return false;
  return true;
}

// ---------- (1) Visibility t-details after Theme with three toggles ----------

describe('global-settings Visibility section (after Theme)', () => {
  let panel: SettingsPanel;

  beforeEach(async () => {
    window.localStorage.clear();
    panel = new SettingsPanel();
    document.body.appendChild(panel);
    await panel.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    vi.restoreAllMocks();
  });

  it('renders a t-details titled "Visibility" inside div.global-settings', async () => {
    await panel.updateComplete;

    const visibility = findDetailsByTitle(panel, 'Visibility');
    expect(
      visibility,
      'expected div.global-settings to contain t-details[title="Visibility"]'
    ).toBeTruthy();
  });

  it('places the Visibility section immediately after the Theme section', async () => {
    await panel.updateComplete;

    const titles = globalDetailsTitles(panel);
    expect(titles).toContain('Theme');
    expect(titles).toContain('Visibility');
    expect(titles.indexOf('Visibility')).toBe(titles.indexOf('Theme') + 1);
  });

  it('contains three toggles: zoom buttons, play-full-song button, loop-count selector', async () => {
    await panel.updateComplete;

    const toggles = getVisibilityToggles(panel);
    expect(toggles.zoom, 'expected a zoom-visibility toggle t-butt').toBeTruthy();
    expect(toggles.playFullSong, 'expected a play-full-song-visibility toggle t-butt').toBeTruthy();
    expect(toggles.loopCount, 'expected a loop-count-visibility toggle t-butt').toBeTruthy();
    const all: TButt[] = [toggles.zoom!, toggles.playFullSong!, toggles.loopCount!];
    for (const t of all) {
      expect(
        t.hasAttribute('toggle'),
        `expected "${t.textContent?.trim()}" to be a toggle t-butt`
      ).toBe(true);
    }
  });

  it('defaults all three visibility toggles to on (v1 shows every control by default)', async () => {
    await panel.updateComplete;

    const toggles = getVisibilityToggles(panel);
    expect(toggles.zoom?.active).toBe(true);
    expect(toggles.playFullSong?.active).toBe(true);
    expect(toggles.loopCount?.active).toBe(true);
  });
});

// ---------- (2) toggles persist to nDB with the v1 keys ----------

describe('Visibility toggles persist to nDB with the v1 keys', () => {
  let panel: SettingsPanel;

  beforeEach(async () => {
    window.localStorage.clear();
    panel = new SettingsPanel();
    document.body.appendChild(panel);
    await panel.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    vi.restoreAllMocks();
  });

  it('uses the exact v1 nDB key strings', () => {
    expect(TROFF_SETTING_UI_ZOOM_SHOW).toBe(V1_ZOOM_KEY);
    expect(TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW).toBe(V1_PLAY_FULL_SONG_KEY);
    expect(TROFF_SETTING_UI_LOOP_BUTTONS_SHOW).toBe(V1_LOOP_KEY);
  });

  it('zoom toggle persists to nDB under TROFF_SETTING_UI_ZOOM_SHOW', async () => {
    const setSpy = vi.spyOn(nDB, 'set');

    const toggles = getVisibilityToggles(panel);
    expect(toggles.zoom, 'expected a zoom-visibility toggle t-butt').toBeTruthy();
    toggles.zoom!.click();
    await toggles.zoom!.updateComplete;
    await panel.updateComplete;

    expect(setSpy).toHaveBeenCalledWith(TROFF_SETTING_UI_ZOOM_SHOW, false);
    expect(nDB.get(TROFF_SETTING_UI_ZOOM_SHOW)).toBe(false);
  });

  it('play-full-song toggle persists to nDB under TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW', async () => {
    const setSpy = vi.spyOn(nDB, 'set');

    const toggles = getVisibilityToggles(panel);
    expect(toggles.playFullSong, 'expected a play-full-song-visibility toggle t-butt').toBeTruthy();
    toggles.playFullSong!.click();
    await toggles.playFullSong!.updateComplete;
    await panel.updateComplete;

    expect(setSpy).toHaveBeenCalledWith(TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW, false);
    expect(nDB.get(TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW)).toBe(false);
  });

  it('loop-count toggle persists to nDB under TROFF_SETTING_UI_LOOP_BUTTONS_SHOW', async () => {
    const setSpy = vi.spyOn(nDB, 'set');

    const toggles = getVisibilityToggles(panel);
    expect(toggles.loopCount, 'expected a loop-count-visibility toggle t-butt').toBeTruthy();
    toggles.loopCount!.click();
    await toggles.loopCount!.updateComplete;
    await panel.updateComplete;

    expect(setSpy).toHaveBeenCalledWith(TROFF_SETTING_UI_LOOP_BUTTONS_SHOW, false);
    expect(nDB.get(TROFF_SETTING_UI_LOOP_BUTTONS_SHOW)).toBe(false);
  });

  it('toggling twice restores the visible state in nDB', async () => {
    const toggles = getVisibilityToggles(panel);
    expect(toggles.zoom, 'expected a zoom-visibility toggle t-butt').toBeTruthy();

    toggles.zoom!.click();
    await toggles.zoom!.updateComplete;
    await panel.updateComplete;
    expect(nDB.get(TROFF_SETTING_UI_ZOOM_SHOW)).toBe(false);

    toggles.zoom!.click();
    await toggles.zoom!.updateComplete;
    await panel.updateComplete;
    expect(nDB.get(TROFF_SETTING_UI_ZOOM_SHOW)).toBe(true);
  });
});

// ---------- (3) t-current-song-controls hides/shows controls from nDB ----------

describe('t-current-song-controls hides/shows controls from nDB visibility values', () => {
  let el: CurrentSongControls | undefined;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    if (el && document.body.contains(el)) {
      document.body.removeChild(el);
    }
    el = undefined;
    vi.restoreAllMocks();
  });

  async function mount(): Promise<CurrentSongControls> {
    el = new CurrentSongControls();
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  it('shows zoom buttons, play-full-song button and loop-count selector by default (no nDB values)', async () => {
    const ctl = await mount();

    expect(findZoomButtons(ctl).filter(isShown).length).toBeGreaterThan(0);
    expect(isShown(findPlayFullSongButton(ctl))).toBe(true);
    expect(isShown(findLoopButtonsContainer(ctl))).toBe(true);
  });

  it('hides the zoom buttons when TROFF_SETTING_UI_ZOOM_SHOW is false', async () => {
    nDB.set(TROFF_SETTING_UI_ZOOM_SHOW, false);
    const ctl = await mount();

    expect(findZoomButtons(ctl).filter(isShown).length).toBe(0);
    // The other groups stay visible.
    expect(isShown(findPlayFullSongButton(ctl))).toBe(true);
    expect(isShown(findLoopButtonsContainer(ctl))).toBe(true);
  });

  it('hides the play-full-song button when TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW is false', async () => {
    nDB.set(TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW, false);
    const ctl = await mount();

    expect(isShown(findPlayFullSongButton(ctl))).toBe(false);
    // The other groups stay visible.
    expect(findZoomButtons(ctl).filter(isShown).length).toBeGreaterThan(0);
    expect(isShown(findLoopButtonsContainer(ctl))).toBe(true);
  });

  it('hides the loop-count selector when TROFF_SETTING_UI_LOOP_BUTTONS_SHOW is false', async () => {
    nDB.set(TROFF_SETTING_UI_LOOP_BUTTONS_SHOW, false);
    const ctl = await mount();

    expect(isShown(findLoopButtonsContainer(ctl))).toBe(false);
    // The other groups stay visible.
    expect(findZoomButtons(ctl).filter(isShown).length).toBeGreaterThan(0);
    expect(isShown(findPlayFullSongButton(ctl))).toBe(true);
  });

  it('shows everything again when all three nDB values are true', async () => {
    nDB.set(TROFF_SETTING_UI_ZOOM_SHOW, true);
    nDB.set(TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW, true);
    nDB.set(TROFF_SETTING_UI_LOOP_BUTTONS_SHOW, true);
    const ctl = await mount();

    expect(findZoomButtons(ctl).filter(isShown).length).toBeGreaterThan(0);
    expect(isShown(findPlayFullSongButton(ctl))).toBe(true);
    expect(isShown(findLoopButtonsContainer(ctl))).toBe(true);
  });
});
