import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsPanel } from '../components/molecule/t-settings-panel.js';
import { CurrentSongControls } from '../components/molecule/t-current-song-controls.js';

/**
 * One press of "Play full song" must reach a listener attached to the
 * <t-settings-panel> host EXACTLY ONCE.
 *
 * Why it currently fires twice (mechanism, not re-derived here):
 *  - t-current-song-controls dispatches `setting-changed` with
 *    `{ bubbles: true, composed: true }`.
 *  - t-settings-panel embeds a second copy of the controls
 *    (#settingsCurrentSongControls) with
 *    `@setting-changed=${this._handleCurrentSongSettingChange}`, which
 *    re-dispatches a NEW `setting-changed` on the panel host.
 *  - The ORIGINAL event then keeps bubbling (composed: true crosses the shadow
 *    boundary) and reaches the very same host listener.
 *  - v2Script.ts attaches a single `settingsPanel.addEventListener(
 *    'setting-changed', ...)`, so `selectFirstAndLastMarkers(true)` runs twice.
 *
 * The suite only clicks REAL elements and observes REAL events — no production
 * logic is re-implemented, and v2Script is deliberately NOT imported (Test A
 * needs nothing from it).
 */

type SettingChangedDetail = { setting: string; value: unknown };
type SettingChangedEvent = CustomEvent<SettingChangedDetail>;

/** Local copy of findPlayFullSongButton (components/molecule/t-current-song-controls.test.ts line 20). */
function findPlayFullSongButton(el: CurrentSongControls): HTMLElement | null {
  const buttons = el.shadowRoot?.querySelectorAll('t-butt');
  if (!buttons) {
    return null;
  }
  for (const button of Array.from(buttons)) {
    const text = (button.textContent ?? '').trim().toLowerCase();
    if (text.includes('play full song')) {
      return button as HTMLElement;
    }
  }
  return null;
}

function settingChangedEventsOf(spy: { mock: { calls: unknown[][] } }): SettingChangedEvent[] {
  return spy.mock.calls.map((call) => call[0] as SettingChangedEvent);
}

async function mountSettingsPanel(): Promise<{
  settingsPanel: SettingsPanel;
  embeddedControls: CurrentSongControls;
}> {
  const settingsPanel = new SettingsPanel();
  settingsPanel.id = 'settingsPanel';
  document.body.appendChild(settingsPanel);
  await settingsPanel.updateComplete;

  const embeddedControls =
    settingsPanel.shadowRoot?.querySelector<CurrentSongControls>(
      '#settingsCurrentSongControls'
    ) ?? null;

  if (!embeddedControls) {
    throw new Error('settings panel did not render #settingsCurrentSongControls');
  }
  await embeddedControls.updateComplete;

  return { settingsPanel, embeddedControls };
}

async function clickPlayFullSong(controls: CurrentSongControls): Promise<void> {
  const button = findPlayFullSongButton(controls);
  expect(button).toBeTruthy();
  button?.click();

  await controls.updateComplete;
}

describe('t-settings-panel setting-changed dedupe', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('TEST A: one "Play full song" press fires setting-changed on the panel host exactly once', async () => {
    const { settingsPanel, embeddedControls } = await mountSettingsPanel();

    const spy = vi.fn();
    settingsPanel.addEventListener('setting-changed', spy);

    await clickPlayFullSong(embeddedControls);
    await settingsPanel.updateComplete;

    expect(spy).toHaveBeenCalledTimes(1);

    const events = settingChangedEventsOf(spy);
    expect(events[0].detail).toEqual({ setting: 'playFullSong', value: true });
  });

  it('TEST B: the light-DOM sidebar copy emits exactly one setting-changed per press and it bubbles out', async () => {
    const sidebar = new CurrentSongControls();
    sidebar.id = 'currentSongControls';
    document.body.appendChild(sidebar);
    await sidebar.updateComplete;

    const elementSpy = vi.fn();
    const bodySpy = vi.fn();
    sidebar.addEventListener('setting-changed', elementSpy);
    document.body.addEventListener('setting-changed', bodySpy);

    await clickPlayFullSong(sidebar);
    await sidebar.updateComplete;

    // Exactly one CustomEvent object is dispatched per press...
    expect(elementSpy).toHaveBeenCalledTimes(1);
    // ...and it bubbles out of the element (that is how v2Script forwards it
    // onto settingsPanel — see v2Script.ts lines ~2284-2289).
    expect(bodySpy).toHaveBeenCalledTimes(1);
    expect(bodySpy.mock.calls[0][0]).toBe(elementSpy.mock.calls[0][0]);

    const detail = (elementSpy.mock.calls[0][0] as SettingChangedEvent).detail;
    expect(detail).toEqual({ setting: 'playFullSong', value: true });
  });

  it('TEST C: the embedded controls still emit setting-changed exactly once on the element itself', async () => {
    const { embeddedControls } = await mountSettingsPanel();

    const spy = vi.fn();
    embeddedControls.addEventListener('setting-changed', spy);

    await clickPlayFullSong(embeddedControls);
    await embeddedControls.updateComplete;

    // The dedupe must not swallow the event: the inner element still dispatches it.
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as SettingChangedEvent).detail).toEqual({
      setting: 'playFullSong',
      value: true,
    });
  });
});
