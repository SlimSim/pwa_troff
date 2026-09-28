import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsPanel } from '../components/molecule/t-settings-panel.js';
import { BottomNav } from '../components/molecule/t-footer.js';
import { nDB } from '../assets/internal/db.js';
import type { DetailsElement } from '../components/atom/t-details.js';
import type { TButt } from '../components/atom/t-butt.js';

/**
 * Regression test: "full screen countdown" toggle inside the "Visibility"
 * t-details (t-settings-panel), using nDB key TROFF_SETTING_UI_FULL_SCREEN_COUNTDOWN
 * (default: true, same pattern as TROFF_SETTING_UI_*_SHOW).
 *
 * When the persisted value is false, the fullscreen .countdown-overlay (in t-footer)
 * must NOT render — even while isStartingPlayback=true (the small .play-countdown
 * inside the play button, and header statusCountdown, should continue to function).
 *
 * The setting is added using the exact same pattern as the other Visibility toggles:
 * - <t-butt toggle ellipsis .active=... >
 * - read in connected: nDB.get(KEY) !== false
 * - write via _setVisibilitySetting (which does nDB.set + dispatches troff-visibility-changed)
 * - control/hiding logic belongs in t-footer render (or via a prop set from v2Script).
 *
 * Uses ONLY real imports (with .js), no re-implementation of any source logic.
 * Mocks nDB (and would mock Firebase) so no real services are called.
 *
 * This test must stay RED until @coder implements the toggle + the hiding logic.
 */

const FULL_SCREEN_COUNTDOWN_KEY = 'TROFF_SETTING_UI_FULL_SCREEN_COUNTDOWN';

const nDBStore: Record<string, unknown> = {};

vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: vi.fn((key: string) => nDBStore[key] ?? null),
    set: vi.fn((key: string, value: unknown) => {
      nDBStore[key] = value;
    }),
  },
}));

// ---------- helpers (modeled exactly on visibility-toggles.test.ts + countdown-overlay.test.ts) ----------

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
  fullScreenCountdown?: TButt;
}

function getVisibilityToggles(panel: SettingsPanel): VisibilityToggles {
  const visibility = findDetailsByTitle(panel, 'Visibility');
  if (!visibility) return {};
  const buttons = Array.from(visibility.querySelectorAll('t-butt')) as TButt[];
  const textOf = (b: TButt): string => (b.textContent ?? '').toLowerCase().trim();
  return {
    zoom: buttons.find((b) => textOf(b).includes('zoom')),
    playFullSong: buttons.find((b) => textOf(b).includes('play full song')),
    loopCount: buttons.find((b) => textOf(b).includes('loop')),
    fullScreenCountdown: buttons.find((b) => textOf(b).includes('countdown')),
  };
}

function findFullscreenCountdownOverlay(footer: BottomNav): Element | null {
  const inShadow = footer.shadowRoot?.querySelector('.countdown-overlay, [data-testid="countdown-overlay"]') ?? null;
  if (inShadow) return inShadow;
  return document.querySelector('.countdown-overlay, [data-testid="countdown-overlay"]');
}

function findSmallPlayCountdown(footer: BottomNav): Element | null {
  return footer.shadowRoot?.querySelector('.play-countdown') ?? null;
}

// ---------- tests ----------

describe('Visibility section gains "full screen countdown" toggle (nDB + default)', () => {
  let panel: SettingsPanel;

  beforeEach(async () => {
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    window.localStorage?.clear?.();
    panel = new SettingsPanel();
    document.body.appendChild(panel);
    await panel.updateComplete;
  });

  afterEach(() => {
    if (panel && document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    vi.restoreAllMocks();
  });

  it('contains a t-details titled "Visibility"', async () => {
    const visibility = findDetailsByTitle(panel, 'Visibility');
    expect(visibility, 'expected Visibility t-details inside global-settings').toBeTruthy();
  });

  it('renders a toggle for "full screen countdown" inside the Visibility section', async () => {
    const toggles = getVisibilityToggles(panel);
    expect(
      toggles.fullScreenCountdown,
      'expected a full-screen-countdown toggle <t-butt toggle> inside Visibility t-details (follows pattern of Zoom buttons / Play full song button / Loop count selector)'
    ).toBeTruthy();
    const label = (toggles.fullScreenCountdown!.textContent ?? '').toLowerCase();
    expect(label).toMatch(/countdown/);
  });

  it('defaults to true (active state, because nDB.get returns null which !== false)', async () => {
    const toggles = getVisibilityToggles(panel);
    expect(toggles.fullScreenCountdown, 'toggle must exist').toBeTruthy();
    expect(toggles.fullScreenCountdown!.active).toBe(true);
  });

  it('toggle click writes exactly to nDB under TROFF_SETTING_UI_FULL_SCREEN_COUNTDOWN (and flips active)', async () => {
    const setSpy = vi.spyOn(nDB, 'set');

    const toggles = getVisibilityToggles(panel);
    expect(toggles.fullScreenCountdown, 'expected the countdown toggle').toBeTruthy();

    // starts true → click makes false
    toggles.fullScreenCountdown!.click();
    await toggles.fullScreenCountdown!.updateComplete;
    await panel.updateComplete;

    expect(setSpy).toHaveBeenCalledWith(FULL_SCREEN_COUNTDOWN_KEY, false);
    expect(nDB.get(FULL_SCREEN_COUNTDOWN_KEY)).toBe(false);
    expect(toggles.fullScreenCountdown!.active).toBe(false);

    // click again → true
    toggles.fullScreenCountdown!.click();
    await toggles.fullScreenCountdown!.updateComplete;
    await panel.updateComplete;

    expect(setSpy).toHaveBeenCalledWith(FULL_SCREEN_COUNTDOWN_KEY, true);
    expect(nDB.get(FULL_SCREEN_COUNTDOWN_KEY)).toBe(true);
    expect(toggles.fullScreenCountdown!.active).toBe(true);
  });

  it('initial active state follows pre-existing nDB value (false case)', async () => {
    // clean up the panel created in beforeEach
    if (document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    nDB.set(FULL_SCREEN_COUNTDOWN_KEY, false);

    panel = new SettingsPanel();
    document.body.appendChild(panel);
    await panel.updateComplete;

    const toggles = getVisibilityToggles(panel);
    expect(toggles.fullScreenCountdown, 'toggle must exist').toBeTruthy();
    expect(toggles.fullScreenCountdown!.active).toBe(false);
  });
});

describe('TROFF_SETTING_UI_FULL_SCREEN_COUNTDOWN hides fullscreen overlay (while isStartingPlayback remains usable for small countdown)', () => {
  let footer: BottomNav;

  beforeEach(() => {
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    window.localStorage?.clear?.();
  });

  afterEach(() => {
    if (footer && document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
    // also clean any stray overlay divs that might have been added outside shadow in future impls
    document.querySelectorAll('.countdown-overlay, [data-testid="countdown-overlay"]').forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  it('shows the .countdown-overlay by default when isStartingPlayback=true (unset key → treated as true)', async () => {
    footer = new BottomNav();
    document.body.appendChild(footer);
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 5;
    await footer.updateComplete;

    const overlay = findFullscreenCountdownOverlay(footer);
    expect(
      overlay,
      'expected .countdown-overlay (or data-testid) to be rendered when isStartingPlayback and default setting'
    ).not.toBeNull();
    expect(overlay?.textContent ?? '').toContain('5');
  });

  it('does NOT render the fullscreen countdown-overlay when TROFF_SETTING_UI_FULL_SCREEN_COUNTDOWN=false, even if isStartingPlayback=true', async () => {
    nDB.set(FULL_SCREEN_COUNTDOWN_KEY, false);

    footer = new BottomNav();
    document.body.appendChild(footer);
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 3;
    await footer.updateComplete;

    const overlay = findFullscreenCountdownOverlay(footer);
    expect(
      overlay,
      'fullscreen overlay must be suppressed by the setting (even though isStartingPlayback is true)'
    ).toBeNull();
  });

  it('keeps the small .play-countdown (inside play button) visible when fullscreen setting is false + isStartingPlayback', async () => {
    nDB.set(FULL_SCREEN_COUNTDOWN_KEY, false);

    footer = new BottomNav();
    document.body.appendChild(footer);
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 4;
    await footer.updateComplete;

    const overlay = findFullscreenCountdownOverlay(footer);
    expect(overlay).toBeNull(); // fullscreen hidden

    const small = findSmallPlayCountdown(footer);
    expect(
      small,
      'the small countdown inside the play button should still render (setting only affects the fullscreen overlay)'
    ).not.toBeNull();
    expect(small?.textContent ?? '').toContain('4');
  });

  it('hides overlay when setting becomes false (nDB write observed at render time)', async () => {
    // start with default (visible)
    footer = new BottomNav();
    document.body.appendChild(footer);
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 2;
    await footer.updateComplete;
    expect(findFullscreenCountdownOverlay(footer)).not.toBeNull();

    // now flip via nDB (as the setting toggle would do)
    nDB.set(FULL_SCREEN_COUNTDOWN_KEY, false);
    // re-trigger render by touching a property the component already observes
    footer.playbackCountdown = 2;
    await footer.updateComplete;

    const overlay = findFullscreenCountdownOverlay(footer);
    expect(overlay).toBeNull();
  });
});
