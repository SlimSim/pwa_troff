import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BottomNav } from '../components/molecule/t-footer.js';
import { SettingsPanel } from '../components/molecule/t-settings-panel.js';

/**
 * FEATURE 1 — Esc closes Settings (title="Settings").
 *
 * t-footer owns `settingsPanelVisible`, toggled by the info button
 * (t-butt title="Settings") which dispatches `settings-toggle {visible}`.
 * t-settings-panel owns `visible` and closes via `_handleClose()` which
 * dispatches `settings-panel-closed`; v2Script syncs the two
 * (v2Script.ts: settings-toggle -> panel.visible, settings-panel-closed
 * -> both false).
 *
 * Gap: footer `_onEscKeydown` only resets showSpeed/Time/MarkerDropdown and
 * never touches `settingsPanelVisible`, and t-settings-panel has no Esc
 * listener at all — so Esc leaves Settings open.
 *
 * FEATURE 2 — Esc pauses playback/countdown without reset (no seek).
 *
 * Contract under test (footer level, mockable without full v2Script):
 * when playback is active (`isPlaying`) or a start-countdown is running
 * (`isStartingPlayback`), Esc must make t-footer dispatch a dedicated
 * `pause-requested` event (bubbles + composed, like every other footer
 * event). v2Script maps that event to the minimal pause —
 * `getActiveMedia().pause()` with NO `seekToStartMarker()` and NO
 * `resetLoopTimesCounter()` (the startQuickPlayback playing-branch shape,
 * NOT the startPlayback branch which seeks) — plus cancelling a running
 * countdown (`clearPendingPlaybackStart` + `clearPlaybackCountdown`).
 * Routing Esc through `nav-click` action `play` would be wrong because
 * v2Script `startPlayback()` seeks to the start marker when pausing.
 *
 * These tests dispatch Escape on `document` WITHOUT focusing anything
 * inside the panel first — the close/pause must work via a document-level
 * listener, not via focus being inside the panel.
 */

function dispatchEscape(): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })
  );
}

describe('Esc closes Settings', () => {
  let footer: BottomNav;
  let panel: SettingsPanel;

  beforeEach(async () => {
    footer = new BottomNav();
    document.body.appendChild(footer);
    panel = new SettingsPanel();
    document.body.appendChild(panel);
    await footer.updateComplete;
    await panel.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
    if (document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    vi.restoreAllMocks();
  });

  it('t-footer with settingsPanelVisible=true sets it to false on Esc', async () => {
    footer.settingsPanelVisible = true;
    await footer.updateComplete;
    expect(footer.settingsPanelVisible).toBe(true);

    dispatchEscape();
    await footer.updateComplete;

    expect(footer.settingsPanelVisible).toBe(false);
  });

  it('t-footer dispatches settings-toggle {visible: false} on Esc when Settings open', async () => {
    const toggleSpy = vi.fn();
    footer.addEventListener('settings-toggle', toggleSpy);
    footer.settingsPanelVisible = true;
    await footer.updateComplete;

    dispatchEscape();
    await footer.updateComplete;

    expect(toggleSpy).toHaveBeenCalledTimes(1);
    const event = toggleSpy.mock.calls[0][0] as CustomEvent;
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.detail).toEqual({ visible: false });
  });

  it('t-settings-panel with visible=true sets it to false and dispatches settings-panel-closed on Esc', async () => {
    const closedSpy = vi.fn();
    panel.addEventListener('settings-panel-closed', closedSpy);
    panel.visible = true;
    await panel.updateComplete;
    expect(panel.visible).toBe(true);

    dispatchEscape();
    await panel.updateComplete;

    expect(panel.visible).toBe(false);
    expect(closedSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Esc pauses playback/countdown without reset', () => {
  let footer: BottomNav;

  beforeEach(async () => {
    footer = new BottomNav();
    document.body.appendChild(footer);
    await footer.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
    vi.restoreAllMocks();
  });

  it('dispatches pause-requested (bubbles + composed) on Esc when isPlaying, without routing through nav-click play (no seek)', async () => {
    footer.isPlaying = true;
    await footer.updateComplete;

    const pauseSpy = vi.fn();
    const navClickSpy = vi.fn();
    footer.addEventListener('pause-requested', pauseSpy);
    footer.addEventListener('nav-click', navClickSpy);

    dispatchEscape();
    await footer.updateComplete;

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    const event = pauseSpy.mock.calls[0][0] as CustomEvent;
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    // Esc-pause must NOT reuse the play toggle: v2Script startPlayback()
    // seeks to the start marker (seekToStartMarker + resetLoopTimesCounter)
    // when pausing, while Esc-pause must be pause-only with no seek.
    expect(navClickSpy).not.toHaveBeenCalled();
  });

  it('dispatches pause-requested on Esc when countdown is active (isStartingPlayback)', async () => {
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 3;
    await footer.updateComplete;

    const pauseSpy = vi.fn();
    footer.addEventListener('pause-requested', pauseSpy);

    dispatchEscape();
    await footer.updateComplete;

    // v2Script maps this event to cancelling the countdown
    // (clearPendingPlaybackStart + clearPlaybackCountdown) and pausing
    // the active media with no seek.
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    const event = pauseSpy.mock.calls[0][0] as CustomEvent;
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('does NOT dispatch pause-requested on Esc when idle (not playing, no countdown)', async () => {
    footer.isPlaying = false;
    footer.isStartingPlayback = false;
    await footer.updateComplete;

    const pauseSpy = vi.fn();
    footer.addEventListener('pause-requested', pauseSpy);

    dispatchEscape();
    await footer.updateComplete;

    expect(pauseSpy).not.toHaveBeenCalled();
  });
});
