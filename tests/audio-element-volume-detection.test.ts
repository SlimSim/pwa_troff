import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * FEATURE SPEC: the Web Audio volume graph must NEVER be built on iOS.
 *
 * Building an AudioContext + MediaElementAudioSource + GainNode on iOS causes
 * audible playback skipping, so iOS always falls back to the plain element
 * volume path (a no-op there — loudness is hardware-buttons-only).
 *
 * services/audio.ts still probes HTMLMediaElement.volume at module load and
 * exports the result as `elementVolumeWorks`, defined as (probe sticks) AND NOT
 * (iOS-family UA). iOS-family = navigator.userAgent matches
 * /iPhone|iPad|iPod/, or (/Macintosh/ in UA AND navigator.maxTouchPoints > 1,
 * covering iPadOS desktop-mode Safari). Missing/undefined navigator or missing
 * userAgent falls back to the probe alone (never throws).
 *
 * `isVolumeGraphAllowed()` is the call-time gate:
 *   isAudioGraphEnabled() && !isIOSFamily()
 *
 * - Graph NOT allowed (iOS-family, or ?audiograph=off): NO AudioContext is ever
 *   constructed and no resume hooks are attached. volumePercentToGain() is
 *   exactly 1 for every percent, setVolumePercent writes percent/100 to the
 *   element (clamped to 1) and leaves any GainNode at unity, and
 *   getAudioDebugState() reports audioGraphCreated false / state 'none' /
 *   gainValue 1 while volumePercent tracks the last percent.
 * - Graph allowed + elementVolumeWorks === true (default / happy-dom, desktop
 *   Safari, Windows Chrome): behavior is UNCHANGED — gain is 1 at/below 100%,
 *   the boost graph is only created for gain > 1, and no resume hooks are
 *   attached. setVolumePercent writes percent/100 to the element.
 * - Graph allowed + elementVolumeWorks === false on a NON-iOS device: behavior
 *   is UNCHANGED — volumePercentToGain maps the FULL 0–420% range onto the
 *   GainNode (attenuation below 100%), the boost graph is ensured for every
 *   percent, and best-effort resume hooks are attached once at graph creation
 *   ('play' on audio + 'statechange' on the context). The element is pinned at
 *   unity (1) so the gain node is the single source of truth (avoids
 *   double-attenuation where WebKit plumbs element.volume into the
 *   MediaElementAudioSource input).
 *
 * Detection runs at import time, so modes are simulated by stubbing globals
 * before a fresh dynamic import (vi.resetModules + vi.stubGlobal('navigator',
 * ...) / vi.stubGlobal('Audio', ...)).
 * All helpers are imported from the real module — nothing is re-implemented.
 */

type AudioModule = typeof import('../services/audio.js');

/** `isVolumeGraphAllowed` is the new call-time gate (absent before the fix). */
type AudioModuleWithDetection = AudioModule & {
  isVolumeGraphAllowed?: () => boolean;
};

/**
 * Read the call-time graph gate from the real module. Fails with an explicit
 * message while the export is still missing (RED state).
 */
function graphAllowed(mod: AudioModuleWithDetection): boolean {
  const fn = mod.isVolumeGraphAllowed;
  if (typeof fn !== 'function') {
    throw new Error('services/audio.ts must export isVolumeGraphAllowed(): boolean');
  }
  return fn();
}

/**
 * iOS-like Audio: extends the real Audio so addEventListener/dispatchEvent
 * keep working (the module exports its own `new Audio()` instance), but
 * volume writes are silently ignored — the getter never reflects them.
 */
class BrokenVolumeAudio extends Audio {
  constructor() {
    super();
    // Instance-level accessor shadows happy-dom's prototype accessor.
    Object.defineProperty(this, 'volume', {
      configurable: true,
      get: (): number => 1,
      set: (_value: number) => {
        /* silently ignored, like iOS Safari */
      },
    });
  }
}

/** Audio whose volume setter throws — detection must report false. */
class ThrowingVolumeAudio extends Audio {
  constructor() {
    super();
    Object.defineProperty(this, 'volume', {
      configurable: true,
      get: (): number => 1,
      set: (_value: number) => {
        throw new Error('volume set is not allowed');
      },
    });
  }
}

interface FakeGainNode {
  gain: { value: number };
  connect: ReturnType<typeof vi.fn>;
}

/** Spy-able AudioContext stand-in with construction counting. */
class FakeAudioContext extends EventTarget {
  static instances: FakeAudioContext[] = [];

  static reset(): void {
    FakeAudioContext.instances = [];
  }

  constructor() {
    super();
    FakeAudioContext.instances.push(this);
  }

  state = 'running';
  destination = { name: 'fake-destination' };
  resume = vi.fn((): Promise<void> => Promise.resolve());
  source = { connect: vi.fn() };
  gainNode: FakeGainNode = { gain: { value: 1 }, connect: vi.fn() };
  createMediaElementSource = vi.fn((_element: unknown) => this.source);
  createGain = vi.fn((): FakeGainNode => this.gainNode);
}

async function importFresh(): Promise<AudioModuleWithDetection> {
  vi.resetModules();
  return (await import('../services/audio.js')) as AudioModuleWithDetection;
}

async function importBroken(): Promise<AudioModuleWithDetection> {
  vi.stubGlobal('Audio', BrokenVolumeAudio);
  vi.resetModules();
  return (await import('../services/audio.js')) as AudioModuleWithDetection;
}

async function importThrowing(): Promise<AudioModuleWithDetection> {
  vi.stubGlobal('Audio', ThrowingVolumeAudio);
  vi.resetModules();
  return (await import('../services/audio.js')) as AudioModuleWithDetection;
}

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15';
const WINDOWS_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * Stub navigator BEFORE the fresh dynamic import so module-load detection
 * reads the stubbed UA. Default happy-dom Audio sticks, isolating the UA
 * half of the contract.
 */
async function importWithNavigator(
  userAgent: string,
  maxTouchPoints = 0,
): Promise<AudioModuleWithDetection> {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
  vi.resetModules();
  return (await import('../services/audio.js')) as AudioModuleWithDetection;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.restoreAllMocks();
  FakeAudioContext.reset();
});

describe('elementVolumeWorks detection (services/audio.ts)', () => {
  it('is exported and true under happy-dom (volume setter stores the value)', async () => {
    const mod = await importFresh();
    expect(mod.elementVolumeWorks).toBe(true);
  });

  it('is false when the Audio volume setter silently ignores writes (iOS-like)', async () => {
    const mod = await importBroken();
    expect(mod.elementVolumeWorks).toBe(false);
  });

  it('is false when the Audio volume setter throws', async () => {
    const mod = await importThrowing();
    expect(mod.elementVolumeWorks).toBe(false);
  });
});

describe('works mode (elementVolumeWorks === true) — unchanged behavior', () => {
  it('volumePercentToGain is 1 at/below 100%, percent/100 above, clamped 0-4.2', async () => {
    const mod = await importFresh();
    expect(mod.volumePercentToGain(0)).toBe(1);
    expect(mod.volumePercentToGain(50)).toBe(1);
    expect(mod.volumePercentToGain(100)).toBe(1);
    expect(mod.volumePercentToGain(150)).toBeCloseTo(1.5, 5);
    expect(mod.volumePercentToGain(420)).toBeCloseTo(4.2, 5);
    expect(mod.volumePercentToGain(500)).toBeCloseTo(4.2, 5);
  });

  it('setVolumePercent(50) does NOT construct an AudioContext', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importFresh();
    mod.setVolumePercent(50);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('setVolumePercent(150) creates the boost graph with gain 1.5', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importFresh();
    mod.setVolumePercent(150);
    expect(FakeAudioContext.instances).toHaveLength(1);
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.createMediaElementSource).toHaveBeenCalledWith(mod.audio);
    expect(ctx.createGain).toHaveBeenCalledTimes(1);
    expect(ctx.source.connect).toHaveBeenCalledWith(ctx.gainNode);
    expect(ctx.gainNode.connect).toHaveBeenCalledWith(ctx.destination);
    expect(ctx.gainNode.gain.value).toBeCloseTo(1.5, 5);
  });

  it('has NO resume hooks: play and statechange events do not resume the context', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importFresh();
    mod.setVolumePercent(150);
    const ctx = FakeAudioContext.instances[0];
    const callsAtCreation = ctx.resume.mock.calls.length;
    expect(callsAtCreation).toBeGreaterThanOrEqual(1); // resume once at creation

    mod.audio.dispatchEvent(new Event('play'));
    expect(ctx.resume.mock.calls.length).toBe(callsAtCreation);

    ctx.state = 'suspended';
    ctx.dispatchEvent(new Event('statechange'));
    expect(ctx.resume.mock.calls.length).toBe(callsAtCreation);
  });
});

describe('broken mode (elementVolumeWorks === false) — gain-based attenuation', () => {
  it('volumePercentToGain maps 0-420% linearly through the gain, clamped 0-4.2', async () => {
    const mod = await importBroken();
    expect(mod.volumePercentToGain(0)).toBe(0);
    expect(mod.volumePercentToGain(50)).toBeCloseTo(0.5, 5);
    expect(mod.volumePercentToGain(100)).toBe(1);
    expect(mod.volumePercentToGain(150)).toBeCloseTo(1.5, 5);
    expect(mod.volumePercentToGain(420)).toBeCloseTo(4.2, 5);
    expect(mod.volumePercentToGain(500)).toBeCloseTo(4.2, 5);
  });

  it('volumePercentToGain stays deterministic within [0, 4.2] for non-finite input', async () => {
    const mod = await importBroken();
    const nanA = mod.volumePercentToGain(NaN);
    const nanB = mod.volumePercentToGain(NaN);
    expect(nanA).toBe(nanB);
    expect(nanA).toBeGreaterThanOrEqual(0);
    expect(nanA).toBeLessThanOrEqual(4.2);
    for (const v of [Infinity, -Infinity]) {
      const r = mod.volumePercentToGain(v);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(4.2);
    }
  });

  it('setVolumePercent(50) creates the boost graph and attenuates gain to 0.5', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importBroken();
    mod.setVolumePercent(50);
    expect(FakeAudioContext.instances).toHaveLength(1);
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(ctx.createMediaElementSource).toHaveBeenCalledWith(mod.audio);
    expect(ctx.createGain).toHaveBeenCalledTimes(1);
    expect(ctx.source.connect).toHaveBeenCalledWith(ctx.gainNode);
    expect(ctx.gainNode.connect).toHaveBeenCalledWith(ctx.destination);
    expect(ctx.gainNode.gain.value).toBeCloseTo(0.5, 5);
  });

  it('injectable targets pin element to unity (1) AND attenuated gain in broken mode', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importBroken();
    const element = { volume: 0 };
    const gainNode = { gain: { value: 1 } };
    mod.setVolumePercent(50, { element, gainNode });
    // Broken mode: element stays at unity so the gain node is the single
    // source of truth (no double-attenuation where WebKit plumbs
    // element.volume into the MediaElementAudioSource input).
    expect(element.volume).toBe(1);
    expect(gainNode.gain.value).toBeCloseTo(0.5, 5);
  });

  it('attaches a play hook that best-effort resumes the context', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importBroken();
    mod.setVolumePercent(50);
    const ctx = FakeAudioContext.instances[0];
    const callsAtCreation = ctx.resume.mock.calls.length;
    expect(callsAtCreation).toBeGreaterThanOrEqual(1);

    mod.audio.dispatchEvent(new Event('play'));
    expect(ctx.resume.mock.calls.length).toBeGreaterThan(callsAtCreation);
  });

  it('attaches a statechange hook that resumes a non-running context', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importBroken();
    mod.setVolumePercent(50);
    const ctx = FakeAudioContext.instances[0];
    ctx.state = 'suspended';
    const callsBefore = ctx.resume.mock.calls.length;

    ctx.dispatchEvent(new Event('statechange'));
    expect(ctx.resume.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('play hook survives a rejecting resume() and is attached only once', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importBroken();
    mod.setVolumePercent(50);
    mod.setVolumePercent(80);
    mod.setVolumePercent(120);
    const ctx = FakeAudioContext.instances[0];
    ctx.resume.mockImplementation(() => Promise.reject(new Error('no gesture')));
    const callsBefore = ctx.resume.mock.calls.length;

    expect(() => mod.audio.dispatchEvent(new Event('play'))).not.toThrow();
    expect(ctx.resume.mock.calls.length).toBe(callsBefore + 1);
  });
});

describe('iOS-family UA detection — the volume graph is never built on iOS', () => {
  it('iPhone UA with sticking Audio → elementVolumeWorks false, graph disallowed, gain pinned to 1', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importWithNavigator(IPHONE_UA, 0);
    expect(mod.elementVolumeWorks).toBe(false);
    expect(
      typeof mod.isVolumeGraphAllowed,
      'services/audio.ts must export isVolumeGraphAllowed()'
    ).toBe('function');
    expect(graphAllowed(mod)).toBe(false);
    expect(mod.volumePercentToGain(0)).toBe(1);
    expect(mod.volumePercentToGain(50)).toBe(1);
    expect(mod.volumePercentToGain(100)).toBe(1);
    expect(mod.volumePercentToGain(150)).toBe(1);
    expect(mod.volumePercentToGain(420)).toBe(1);
  });

  it('iPhone: setVolumePercent constructs ZERO AudioContexts and attaches no play resume hook', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importWithNavigator(IPHONE_UA, 0);
    const addListener = vi.spyOn(mod.audio, 'addEventListener');

    mod.setVolumePercent(50);
    mod.setVolumePercent(150);

    expect(FakeAudioContext.instances, 'iOS must never construct an AudioContext').toHaveLength(0);
    const playHooks = addListener.mock.calls.filter(([type]) => type === 'play');
    expect(playHooks, 'iOS must not attach a play resume hook').toHaveLength(0);
    expect(() => mod.audio.dispatchEvent(new Event('play'))).not.toThrow();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('iPad UA with sticking Audio → graph disallowed, volumePercentToGain(50) === 1, zero contexts', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importWithNavigator(IPAD_UA, 0);
    expect(mod.elementVolumeWorks).toBe(false);
    expect(graphAllowed(mod)).toBe(false);
    expect(mod.volumePercentToGain(50)).toBe(1);

    mod.setVolumePercent(50);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('iPad desktop-mode UA (Macintosh + maxTouchPoints 5) → graph disallowed, gain 1, zero contexts', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importWithNavigator(IPAD_DESKTOP_UA, 5);
    expect(mod.elementVolumeWorks).toBe(false);
    expect(graphAllowed(mod)).toBe(false);
    expect(mod.volumePercentToGain(420)).toBe(1);

    mod.setVolumePercent(420);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('iOS injectable targets: 50% writes element 0.5 / gain 1 with no graph', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importWithNavigator(IPHONE_UA, 0);
    const element = { volume: 0 };
    const gainNode = { gain: { value: 1 } };

    mod.setVolumePercent(50, { element, gainNode });

    expect(element.volume).toBeCloseTo(0.5, 5);
    expect(gainNode.gain.value).toBe(1);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('iOS injectable targets: 150% clamps element to 1 / gain 1 with no graph', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importWithNavigator(IPHONE_UA, 0);
    const element = { volume: 0 };
    const gainNode = { gain: { value: 1 } };

    mod.setVolumePercent(150, { element, gainNode });

    expect(element.volume).toBe(1);
    expect(gainNode.gain.value).toBe(1);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('iOS getAudioDebugState: no graph, state none, gainValue 1, volumePercent tracks the last percent', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importWithNavigator(IPHONE_UA, 0);

    mod.setVolumePercent(150);

    const state = mod.getAudioDebugState();
    expect(state.elementVolumeWorks).toBe(false);
    expect(state.audioGraphCreated).toBe(false);
    expect(state.audioContextState).toBe('none');
    expect(state.gainValue).toBe(1);
    expect(state.volumePercent).toBe(150);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('same Macintosh UA with maxTouchPoints 0 → graph allowed, element volume works (desktop Safari pin)', async () => {
    const mod = await importWithNavigator(IPAD_DESKTOP_UA, 0);
    expect(mod.elementVolumeWorks).toBe(true);
    expect(graphAllowed(mod)).toBe(true);
    expect(mod.volumePercentToGain(50)).toBe(1);
  });

  it('Windows Chrome UA with sticking Audio → graph allowed (pin)', async () => {
    const mod = await importWithNavigator(WINDOWS_CHROME_UA, 0);
    expect(mod.elementVolumeWorks).toBe(true);
    expect(graphAllowed(mod)).toBe(true);
    expect(mod.volumePercentToGain(50)).toBe(1);
    expect(mod.volumePercentToGain(150)).toBeCloseTo(1.5, 5);
  });

  it('navigator without userAgent falls back to the probe alone (TRUE when it sticks)', async () => {
    vi.stubGlobal('navigator', {});
    vi.resetModules();
    const mod = (await import('../services/audio.js')) as AudioModuleWithDetection;
    expect(mod.elementVolumeWorks).toBe(true);
    expect(graphAllowed(mod)).toBe(true);
  });
});

describe('setVolumePercent injectable targets — element pinning contract', () => {
  it('broken mode pins element to unity (1) while gain attenuates', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importBroken();
    const element = { volume: 0 };
    const gainNode = { gain: { value: 1 } };
    mod.setVolumePercent(50, { element, gainNode });
    expect(element.volume).toBe(1);
    expect(gainNode.gain.value).toBeCloseTo(0.5, 5);
  });

  it('works mode writes percent/100 to the element and keeps gain at unity', async () => {
    const mod = await importFresh();
    const element = { volume: 0 };
    const gainNode = { gain: { value: 1 } };
    mod.setVolumePercent(50, { element, gainNode });
    expect(element.volume).toBeCloseTo(0.5, 5);
    expect(gainNode.gain.value).toBe(1);
  });
});
