import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CurrentSongControls } from './t-current-song-controls.js';
import type { DetailsElement } from '../atom/t-details.js';
import type { TButt } from '../atom/t-butt.js';

function findTempoTapButton(el: CurrentSongControls): HTMLElement | null {
  const buttons = el.shadowRoot?.querySelectorAll('t-butt');
  if (!buttons) {
    return null;
  }
  for (const button of Array.from(buttons)) {
    const text = (button.textContent ?? '').trim().toLowerCase();
    if (text.includes('tap tempo')) {
      return button as HTMLElement;
    }
  }
  return null;
}

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

describe('t-current-song-controls tempo tap feature', () => {
  let element: CurrentSongControls;

  beforeEach(() => {
    element = new CurrentSongControls();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('has a tempo property that defaults to 0', async () => {
    await element.updateComplete;

    expect(element.tempo).toBe(0);
  });

  it('tempo is settable through its reactive attribute', async () => {
    element.setAttribute('tempo', '120');
    await element.updateComplete;

    expect(element.tempo).toBe(120);
  });

  it('renders a tap tempo button', async () => {
    await element.updateComplete;

    expect(findTempoTapButton(element)).toBeTruthy();
  });

  it('dispatches setting-changed with tempo after 3 taps at 500ms intervals', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    await element.updateComplete;

    const settingSpy = vi.fn();
    element.addEventListener('setting-changed', settingSpy);

    const tapButton = findTempoTapButton(element);
    expect(tapButton).toBeTruthy();

    const tap = () => {
      tapButton?.click();
      vi.advanceTimersByTime(500);
    };

    tap(); // t=0    - first tap (resets, no tempo yet)
    tap(); // t=500  - 120 bpm
    tap(); // t=1000 - 120 bpm

    await element.updateComplete;

    const tempoEvents = settingSpy.mock.calls
      .map((call) => call[0] as CustomEvent)
      .filter((event) => event.detail && event.detail.setting === 'tempo');

    expect(tempoEvents.length).toBeGreaterThan(0);
    expect(tempoEvents[tempoEvents.length - 1].detail).toEqual({
      setting: 'tempo',
      value: 120,
    });
    expect(element.tempo).toBe(120);
  });
});

describe('t-current-song-controls song controls layout', () => {
  let element: CurrentSongControls;

  beforeEach(() => {
    element = new CurrentSongControls();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('places the tap tempo button in the same container as the Play full song button', async () => {
    await element.updateComplete;

    const tapButton = findTempoTapButton(element);
    const playFullSongButton = findPlayFullSongButton(element);

    expect(tapButton).toBeTruthy();
    expect(playFullSongButton).toBeTruthy();

    expect(tapButton!.parentElement).toBe(playFullSongButton!.parentElement);
  });
});

describe('t-current-song-controls share song feature', () => {
  let element: CurrentSongControls;

  beforeEach(() => {
    element = new CurrentSongControls();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function findShareButton(el: CurrentSongControls): HTMLElement | null {
    return el.shadowRoot?.querySelector(
      '.settings-group-header t-butt[special]'
    ) as HTMLElement | null;
  }

  it('renders a share button with a share icon above the Marker help-tip', async () => {
    await element.updateComplete;

    const shareButton = findShareButton(element);
    expect(shareButton).toBeTruthy();

    // The button contains a share icon and has the documented tooltip
    expect(shareButton!.querySelector('t-icon[name="share"]')).toBeTruthy();
    expect(shareButton!.title).toBe('Share this song to friends via link');

    // It is positioned BEFORE the first help-tip (the Marker help-tip)
    const markerTip = element.shadowRoot?.querySelector('t-help-tip[h3="Marker"]');
    expect(markerTip).toBeTruthy();

    const position = shareButton!.compareDocumentPosition(markerTip!);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('dispatches song-action-requested with action shareSong when clicked', async () => {
    await element.updateComplete;

    const actionSpy = vi.fn();
    element.addEventListener('song-action-requested', actionSpy);

    const shareButton = findShareButton(element);
    expect(shareButton).toBeTruthy();
    shareButton!.click();
    await element.updateComplete;

    const events = actionSpy.mock.calls.map((call) => call[0] as CustomEvent);
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].detail).toEqual({ action: 'shareSong' });
  });
});

describe('t-current-song-controls zoom keyboard shortcuts (Shift+Z zoom-out regression)', () => {
  let element: CurrentSongControls;

  beforeEach(() => {
    element = new CurrentSongControls();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  function pressKey(key: string, init: KeyboardEventInit = {}) {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    );
  }

  function collectSongActions() {
    const events: CustomEvent[] = [];
    element.addEventListener('song-action-requested', (e: Event) => {
      events.push(e as CustomEvent);
    });
    return events;
  }

  it('plain "z" triggers ONLY Zoom (exactly one song-action-requested with action zoom)', async () => {
    await element.updateComplete;
    const events = collectSongActions();

    pressKey('z');
    await element.updateComplete;

    expect(events.length).toBe(1);
    expect(events[0].detail).toEqual({ action: 'zoom' });
  });

  it('Shift+Z (uppercase Z) triggers ONLY ZoomOut (exactly one event with action zoomOut)', async () => {
    await element.updateComplete;
    const events = collectSongActions();

    pressKey('Z', { shiftKey: true });
    await element.updateComplete;

    expect(events.length).toBe(1);
    expect(events[0].detail).toEqual({ action: 'zoomOut' });
  });

  it('Shift+z (lowercase z with shiftKey) triggers ONLY ZoomOut (exactly one event)', async () => {
    await element.updateComplete;
    const events = collectSongActions();

    pressKey('z', { shiftKey: true });
    await element.updateComplete;

    expect(events.length).toBe(1);
    expect(events[0].detail).toEqual({ action: 'zoomOut' });
  });
});

describe('t-current-song-controls advanced panels use t-details', () => {
  let element: CurrentSongControls;

  beforeEach(() => {
    element = new CurrentSongControls();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  function getDetailsPanels(): DetailsElement[] {
    return Array.from(element.shadowRoot?.querySelectorAll('t-details') ?? []) as DetailsElement[];
  }

  function findDetailsByTitle(title: string): DetailsElement | undefined {
    return getDetailsPanels().find((panel) => panel.title === title);
  }

  it('renders an "Advanced" panel as t-details with the descriptive text in the summary', async () => {
    await element.updateComplete;

    const advanced = findDetailsByTitle('Advanced');
    expect(advanced).toBeTruthy();
    expect(advanced?.text).toBe('Marker actions and states!');

    const titleEl = advanced?.shadowRoot?.querySelector('p.advanced-summary-title');
    expect(titleEl?.textContent).toBe('Advanced');
  });

  it('no longer renders raw native <details> elements in its own shadow root', async () => {
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('details')).toBeNull();
  });

  it('still toggles the "Advanced" panel open when its summary is clicked', async () => {
    await element.updateComplete;

    const advanced = findDetailsByTitle('Advanced');
    expect(advanced).toBeTruthy();

    const summary = advanced?.shadowRoot?.querySelector('summary') as HTMLElement | null;
    expect(summary).toBeTruthy();

    summary?.click();
    await element.updateComplete;

    expect(advanced?.open).toBe(true);
    // Slotted content stays present after the re-render
    expect(advanced?.querySelector('.song-action-buttons')).toBeTruthy();
  });
});

describe('t-current-song-controls "Play full song" is a one-shot action, not a toggle', () => {
  let element: CurrentSongControls;

  beforeEach(() => {
    element = new CurrentSongControls();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  type SettingChangedDetail = { setting: string; value: unknown };

  async function getPlayFullSongButton(): Promise<TButt> {
    await element.updateComplete;
    const button = findPlayFullSongButton(element) as TButt | null;
    expect(button).toBeTruthy();
    await button!.updateComplete;
    return button!;
  }

  function collectPlayFullSongEvents(): CustomEvent<SettingChangedDetail>[] {
    const events: CustomEvent<SettingChangedDetail>[] = [];
    element.addEventListener('setting-changed', (e: Event) => {
      const detail = (e as CustomEvent<SettingChangedDetail>).detail;
      if (detail && detail.setting === 'playFullSong') {
        events.push(e as CustomEvent<SettingChangedDetail>);
      }
    });
    return events;
  }

  it('dispatches setting-changed with detail { setting: "playFullSong", value } when clicked', async () => {
    const events = collectPlayFullSongEvents();
    const button = await getPlayFullSongButton();

    button.click();
    await element.updateComplete;
    await button.updateComplete;

    expect(events.length).toBe(1);
    expect(events[0].detail).toEqual({
      setting: 'playFullSong',
      value: expect.anything(),
    });
  });

  it('keeps playFullSong false and the button without the active attribute after a click', async () => {
    const button = await getPlayFullSongButton();
    expect(button.hasAttribute('active')).toBe(false);

    button.click();
    await element.updateComplete;
    await button.updateComplete;

    expect(element.playFullSong).toBe(false);
    expect(button.hasAttribute('active')).toBe(false);
  });

  it('never renders the button with the active attribute, even when playFullSong is true', async () => {
    element.playFullSong = true;
    await element.updateComplete;

    const button = await getPlayFullSongButton();
    await button.updateComplete;

    expect(element.playFullSong).toBe(true);
    expect(button.hasAttribute('active')).toBe(false);
  });

  it('dispatches setting-changed on every click (two clicks produce two events)', async () => {
    const events = collectPlayFullSongEvents();
    const button = await getPlayFullSongButton();

    button.click();
    await element.updateComplete;
    await button.updateComplete;

    button.click();
    await element.updateComplete;
    await button.updateComplete;

    expect(events.length).toBe(2);
  });
});
