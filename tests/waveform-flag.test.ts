import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for `getWaveformDebugState()` and the `?waveform=off` kill switch
 * in utils/waveform.ts.
 *
 * Feature contract:
 *  - WaveformDebugState = {
 *      waveformEnabled: boolean;
 *      waveformInProgress: boolean;
 *      waveformLastDurationMs: number;
 *    }
 *  - Defaults: { waveformEnabled: true, waveformInProgress: false,
 *    waveformLastDurationMs: 0 }.
 *  - With ?waveform=off, generateWaveformPeaks(url) resolves null immediately,
 *    never calls fetch, and never constructs an AudioContext.
 *  - A real generation sets waveformInProgress true while running and false
 *    after it settles, recording elapsed Date.now() ms rounded to an integer.
 *
 * The real module is imported after stubbing fetch/AudioContext and URL —
 * nothing is reimplemented here.
 */

interface WaveformDebugState {
  waveformEnabled: boolean;
  waveformInProgress: boolean;
  waveformLastDurationMs: number;
}

type WaveformModule = typeof import('../utils/waveform.js');

type WaveformModuleWithDebug = WaveformModule & {
  getWaveformDebugState: () => WaveformDebugState;
};

interface AudioBufferMockOptions {
  channels: Float32Array[];
  sampleRate?: number;
}

/** Minimal AudioBuffer stand-in backed by in-memory channel arrays. */
function makeAudioBuffer({ channels, sampleRate = 44100 }: AudioBufferMockOptions): AudioBuffer {
  const length = channels[0]?.length ?? 0;
  return {
    length,
    numberOfChannels: channels.length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (index: number) => channels[index],
  } as unknown as AudioBuffer;
}

interface FetchResponseLike {
  ok: boolean;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

let fetchMock: ReturnType<typeof vi.fn>;
let audioContextConstructions = 0;

function stubFetchArrayBuffer(
  arrayBuffer: ArrayBuffer,
  options: { ok?: boolean } = {}
): void {
  const ok = options.ok ?? true;
  fetchMock = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    arrayBuffer: async () => arrayBuffer,
  }));
  vi.stubGlobal('fetch', fetchMock);
}

/**
 * Stubs global AudioContext with a decodeAudioData that resolves (or rejects)
 * with the given buffer. Supports both promise and legacy callback styles.
 */
function stubAudioContextDecode(result: AudioBuffer | Error | null): void {
  const decodeAudioDataMock = vi.fn(
    (
      _data: ArrayBuffer,
      onSuccess?: (buffer: AudioBuffer | null) => void,
      onError?: (error: DOMException) => void
    ) => {
      const promise = result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
      promise.catch(() => {});
      if (typeof onSuccess === 'function' || typeof onError === 'function') {
        void promise.then(onSuccess, onError);
      }
      return promise;
    }
  );

  class MockAudioContext {
    constructor() {
      audioContextConstructions += 1;
    }
    decodeAudioData = decodeAudioDataMock;
    close = vi.fn(async () => {});
  }

  vi.stubGlobal('AudioContext', MockAudioContext);
}

async function importFresh(search: string): Promise<WaveformModuleWithDebug> {
  window.history.replaceState({}, '', search);
  vi.resetModules();
  return (await import('../utils/waveform.js')) as unknown as WaveformModuleWithDebug;
}

afterEach(() => {
  window.history.replaceState({}, '', '/');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  audioContextConstructions = 0;
});

describe('getWaveformDebugState — defaults', () => {
  it('reports the documented initial state', async () => {
    const mod = await importFresh('/');

    expect(mod.getWaveformDebugState()).toEqual({
      waveformEnabled: true,
      waveformInProgress: false,
      waveformLastDurationMs: 0,
    });
  });
});

describe('generateWaveformPeaks — duration tracking', () => {
  it('reports a finite integer duration (Date.now 1000 → 1250 = 250 ms)', async () => {
    stubFetchArrayBuffer(new ArrayBuffer(8));
    stubAudioContextDecode(makeAudioBuffer({ channels: [new Float32Array(8)] }));
    const mod = await importFresh('/');

    let dateNowCalls = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => {
      dateNowCalls += 1;
      return dateNowCalls === 1 ? 1000 : 1250;
    });

    const peaks = await mod.generateWaveformPeaks('song.mp3', 4);

    expect(peaks).toBeInstanceOf(Float32Array);
    const state = mod.getWaveformDebugState();
    expect(state.waveformInProgress).toBe(false);
    expect(state.waveformLastDurationMs).toBe(250);
    expect(Number.isInteger(state.waveformLastDurationMs)).toBe(true);
  });

  it('keeps waveformInProgress true while generation is pending, false after it settles', async () => {
    let resolveFetch!: (value: FetchResponseLike) => void;
    fetchMock = vi.fn(
      () =>
        new Promise<FetchResponseLike>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    stubAudioContextDecode(makeAudioBuffer({ channels: [new Float32Array(8)] }));
    const mod = await importFresh('/');

    const pending = mod.generateWaveformPeaks('x');

    expect(mod.getWaveformDebugState().waveformInProgress).toBe(true);

    resolveFetch({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await pending;

    expect(mod.getWaveformDebugState().waveformInProgress).toBe(false);
  });

  it('stays in progress until every concurrent generation settles', async () => {
    const resolvers: Array<(value: FetchResponseLike) => void> = [];
    fetchMock = vi.fn(
      () =>
        new Promise<FetchResponseLike>((resolve) => {
          resolvers.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    stubAudioContextDecode(makeAudioBuffer({ channels: [new Float32Array(8)] }));
    const mod = await importFresh('/');

    const first = mod.generateWaveformPeaks('a');
    const second = mod.generateWaveformPeaks('b');
    expect(mod.getWaveformDebugState().waveformInProgress).toBe(true);

    resolvers[0]!({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await first;
    expect(mod.getWaveformDebugState().waveformInProgress).toBe(true);

    resolvers[1]!({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await second;
    expect(mod.getWaveformDebugState().waveformInProgress).toBe(false);
  });

  it('clears waveformInProgress and resolves null when decoding fails', async () => {
    stubFetchArrayBuffer(new ArrayBuffer(8));
    stubAudioContextDecode(new Error('decode failed'));
    const mod = await importFresh('/');

    await expect(mod.generateWaveformPeaks('song.mp3')).resolves.toBeNull();

    const state = mod.getWaveformDebugState();
    expect(state.waveformInProgress).toBe(false);
    expect(Number.isFinite(state.waveformLastDurationMs)).toBe(true);
    expect(state.waveformLastDurationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('?waveform=off kill switch', () => {
  it('resolves null without fetch or AudioContext and reports the disabled state', async () => {
    stubFetchArrayBuffer(new ArrayBuffer(8));
    stubAudioContextDecode(makeAudioBuffer({ channels: [new Float32Array(8)] }));
    audioContextConstructions = 0;
    const mod = await importFresh('/?waveform=off');

    await expect(mod.generateWaveformPeaks('song.mp3')).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(audioContextConstructions).toBe(0);
    expect(mod.getWaveformDebugState()).toEqual({
      waveformEnabled: false,
      waveformInProgress: false,
      waveformLastDurationMs: 0,
    });
  });
});
