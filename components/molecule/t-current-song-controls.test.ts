import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CurrentSongControls } from './t-current-song-controls.js';

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

  it('renders a t-help-tip with h3="Song"', async () => {
    await element.updateComplete;

    const songTip = element.shadowRoot?.querySelector('t-help-tip[h3="Song"]');
    expect(songTip).toBeTruthy();
  });

  it('renders the Song help-tip before the Play full song button', async () => {
    await element.updateComplete;

    const songTip = element.shadowRoot?.querySelector('t-help-tip[h3="Song"]');
    const playFullSongButton = findPlayFullSongButton(element);

    expect(songTip).toBeTruthy();
    expect(playFullSongButton).toBeTruthy();

    const position = songTip!.compareDocumentPosition(playFullSongButton!);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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