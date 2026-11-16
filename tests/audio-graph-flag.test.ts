import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for `getAudioDebugState()` and the `?audiograph=off` kill switch
 * in services/audio.ts.
 *
 * Feature contract:
 *  - AudioDebugState = {
 *      elementVolumeWorks, audioGraphEnabled, audioGraphCreated,
 *      audioContextState: 'none' | 'running' | 'suspended' | 'closed' | 'interrupted',
 *      audioContextSampleRate, volumePercent, gainValue,
 *    }
 *  - Defaults before any setVolumePercent call: elementVolumeWorks (real
 *    export), audioGraphEnabled true, audioGraphCreated false,
 *    audioContextState 'none', audioContextSampleRate 0, volumePercent 100,
 *    gainValue 1.
 *  - volumePercent tracks the last finite percent passed to setVolumePercent.
 *  - gainValue is the gain actually applied (1 when the graph is disabled).
 *  - With ?audiograph=off, setVolumePercent(50) must NOT construct an
 *    AudioContext and must fall back to element volume (0.5) / gain 1.
 *  - getAudioDebugState() never throws, even without an AudioContext global.
 *
 * The real module is imported dynamically after stubbing globals/URL — nothing
 * is reimplemented here.
 */

interface AudioDebugState {
  elementVolumeWorks: boolean;
  audioGraphEnabled: boolean;
  audioGraphCreated: boolean;
  audioContextState: 'none' | 'running' | 'suspended' | 'closed' | 'interrupted';
  audioContextSampleRate: number;
  volumePercent: number;
  gainValue: number;
}

type AudioModule = typeof import('../services/audio.js');

type AudioModuleWithDebug = AudioModule & {
  getAudioDebugState: () => AudioDebugState;
};

/** Minimal AudioContext stand-in with construction counting. */
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
  sampleRate = 48000;
  destination = { name: 'fake-destination' };
  resume = vi.fn((): Promise<void> => Promise.resolve());
  source = { connect: vi.fn() };
  gainNode = { gain: { value: 1 }, connect: vi.fn() };
  createMediaElementSource = vi.fn((_element: unknown) => this.source);
  createGain = vi.fn(() => this.gainNode);
  close = vi.fn(async () => {});
}

/** Point the URL at the requested search string, then load a fresh module. */
async function importFresh(search: string): Promise<AudioModuleWithDebug> {
  window.history.replaceState({}, '', search);
  vi.resetModules();
  return (await import('../services/audio.js')) as unknown as AudioModuleWithDebug;
}

afterEach(() => {
  window.history.replaceState({}, '', '/');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeAudioContext.reset();
});

describe('getAudioDebugState — documented defaults', () => {
  it('reports the initial state before any volume call', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importFresh('/');

    expect(mod.getAudioDebugState()).toEqual({
      elementVolumeWorks: true,
      audioGraphEnabled: true,
      audioGraphCreated: false,
      audioContextState: 'none',
      audioContextSampleRate: 0,
      volumePercent: 100,
      gainValue: 1,
    });
  });

  it('setVolumePercent(50) does not construct an AudioContext (works mode)', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importFresh('/');

    mod.setVolumePercent(50);

    expect(FakeAudioContext.instances).toHaveLength(0);
    const state = mod.getAudioDebugState();
    expect(state.volumePercent).toBe(50);
    expect(state.gainValue).toBe(1);
    expect(state.audioGraphCreated).toBe(false);
  });

  it('setVolumePercent(150) constructs the graph and reports gain 1.5 / running / 48000 Hz', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importFresh('/');

    mod.setVolumePercent(150);

    expect(FakeAudioContext.instances).toHaveLength(1);
    const state = mod.getAudioDebugState();
    expect(state.audioGraphCreated).toBe(true);
    expect(state.audioContextState).toBe('running');
    expect(state.audioContextSampleRate).toBe(48000);
    expect(state.gainValue).toBeCloseTo(1.5, 5);
    expect(state.volumePercent).toBe(150);
  });
});

describe('?audiograph=off kill switch', () => {
  it('disables the graph and writes element volume without constructing an AudioContext', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importFresh('/?audiograph=off');

    expect(mod.getAudioDebugState().audioGraphEnabled).toBe(false);

    mod.setVolumePercent(50);

    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(mod.audio.volume).toBeCloseTo(0.5, 5);
    const state = mod.getAudioDebugState();
    expect(state.volumePercent).toBe(50);
    expect(state.gainValue).toBe(1);
    expect(state.audioGraphCreated).toBe(false);
  });

  it('applies the v1 fallback to injectable targets: element 0.5, gain 1, zero contexts', async () => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const mod = await importFresh('/?audiograph=off');
    const element = { volume: 0 };
    const gainNode = { gain: { value: 0 } };

    mod.setVolumePercent(50, { element, gainNode });

    expect(element.volume).toBeCloseTo(0.5, 5);
    expect(gainNode.gain.value).toBe(1);
    expect(FakeAudioContext.instances).toHaveLength(0);
    const state = mod.getAudioDebugState();
    expect(state.audioGraphEnabled).toBe(false);
    expect(state.gainValue).toBe(1);
  });
});

describe('getAudioDebugState — no AudioContext available', () => {
  it('never throws and reports audioContextState "none"', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    const mod = await importFresh('/');

    expect(() => mod.getAudioDebugState()).not.toThrow();
    expect(() => mod.setVolumePercent(150)).not.toThrow();

    const state = mod.getAudioDebugState();
    expect(state.audioContextState).toBe('none');
    expect(state.audioContextSampleRate).toBe(0);
    expect(state.audioGraphCreated).toBe(false);
  });
});
