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
 * Visibility toggles — LIVE reactivity (RED tests).
 *
 * Background: t-settings-panel has a "Visibility" t-details with three
 * t-butt toggles persisting booleans to nDB; t-current-song-controls reads
 * those keys at render time. Toggling persists and applies on reload but
 * does NOT update an already-rendered t-current-song-controls live.
 *
 * Required: clicking a Visibility toggle must immediately show/hide the
 * corresponding controls in an already-rendered t-current-song-controls
 * without a reload (same session, same element instance).
 */

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

function isShown(node: Element | null | undefined): boolean {
  if (!node) return false;
  const html = node as HTMLElement;
  if (html.hasAttribute('hidden')) return false;
  if (html.style.display === 'none') return false;
  if (html.closest('[hidden]')) return false;
  return true;
}

async function nextTick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('Visibility toggles update t-current-song-controls live (no reload)', () => {
  let panel: SettingsPanel;
  let controls: CurrentSongControls;

  beforeEach(async () => {
    window.localStorage.clear();
    panel = new SettingsPanel();
    document.body.appendChild(panel);
    await panel.updateComplete;

    controls = new CurrentSongControls();
    document.body.appendChild(controls);
    await controls.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(panel)) document.body.removeChild(panel);
    if (document.body.contains(controls)) document.body.removeChild(controls);
    vi.restoreAllMocks();
  });

  it('zoom toggle hides then re-shows zoom buttons live on the same controls instance', async () => {
    const toggles = getVisibilityToggles(panel);
    expect(toggles.zoom, 'expected a zoom-visibility toggle t-butt').toBeTruthy();

    // Sanity: both start visible.
    expect(findZoomButtons(controls).filter(isShown).length).toBeGreaterThan(0);

    const sameInstance = controls;

    // Hide.
    toggles.zoom!.click();
    await panel.updateComplete;
    await nextTick();
    await controls.updateComplete;

    expect(nDB.get(TROFF_SETTING_UI_ZOOM_SHOW)).toBe(false);
    expect(controls, 'controls must not be recreated').toBe(sameInstance);
    expect(
      findZoomButtons(controls).filter(isShown).length,
      'zoom buttons should hide live after toggle (no reload)'
    ).toBe(0);

    // Re-show.
    toggles.zoom!.click();
    await panel.updateComplete;
    await nextTick();
    await controls.updateComplete;

    expect(nDB.get(TROFF_SETTING_UI_ZOOM_SHOW)).toBe(true);
    expect(controls, 'controls must not be recreated').toBe(sameInstance);
    expect(
      findZoomButtons(controls).filter(isShown).length,
      'zoom buttons should re-appear live after second toggle (no reload)'
    ).toBeGreaterThan(0);
  });

  it('play-full-song toggle hides then re-shows the Play full song button live', async () => {
    const toggles = getVisibilityToggles(panel);
    expect(toggles.playFullSong, 'expected a play-full-song-visibility toggle').toBeTruthy();

    expect(isShown(findPlayFullSongButton(controls))).toBe(true);

    const sameInstance = controls;

    toggles.playFullSong!.click();
    await panel.updateComplete;
    await nextTick();
    await controls.updateComplete;

    expect(nDB.get(TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW)).toBe(false);
    expect(controls, 'controls must not be recreated').toBe(sameInstance);
    expect(
      isShown(findPlayFullSongButton(controls)),
      'Play full song button should hide live after toggle (no reload)'
    ).toBe(false);

    toggles.playFullSong!.click();
    await panel.updateComplete;
    await nextTick();
    await controls.updateComplete;

    expect(nDB.get(TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW)).toBe(true);
    expect(
      isShown(findPlayFullSongButton(controls)),
      'Play full song button should re-appear live after second toggle (no reload)'
    ).toBe(true);
  });

  it('loop-count toggle hides then re-shows the loop selector live', async () => {
    const toggles = getVisibilityToggles(panel);
    expect(toggles.loopCount, 'expected a loop-count-visibility toggle').toBeTruthy();

    expect(isShown(findLoopButtonsContainer(controls))).toBe(true);

    const sameInstance = controls;

    toggles.loopCount!.click();
    await panel.updateComplete;
    await nextTick();
    await controls.updateComplete;

    expect(nDB.get(TROFF_SETTING_UI_LOOP_BUTTONS_SHOW)).toBe(false);
    expect(controls, 'controls must not be recreated').toBe(sameInstance);
    expect(
      isShown(findLoopButtonsContainer(controls)),
      'loop-count selector should hide live after toggle (no reload)'
    ).toBe(false);

    toggles.loopCount!.click();
    await panel.updateComplete;
    await nextTick();
    await controls.updateComplete;

    expect(nDB.get(TROFF_SETTING_UI_LOOP_BUTTONS_SHOW)).toBe(true);
    expect(
      isShown(findLoopButtonsContainer(controls)),
      'loop-count selector should re-appear live after second toggle (no reload)'
    ).toBe(true);
  });
});
