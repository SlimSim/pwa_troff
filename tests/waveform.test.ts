import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateWaveformPeaks } from '../utils/waveform.js';

/**
 * Feature: vertical waveform display — `utils/waveform.ts`.
 *
 * `generateWaveformPeaks(audioUrl, numPeaks = 300)` must:
 *  - fetch the URL to get an ArrayBuffer,
 *  - decode it via AudioContext.decodeAudioData(),
 *  - extract the peak absolute amplitude of channel 0 in numPeaks equal
 *    time buckets,
 *  - normalize the peaks so the maximum is 1.0,
 *  - resolve to a Float32Array of length numPeaks,
 *  - resolve to null (never reject) when fetching or decoding fails.
 *
 * AudioContext and fetch are fully mocked — no real audio decoding or
 * network I/O happens here.
 */

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

let fetchMock: ReturnType<typeof vi.fn>;
let decodeAudioDataMock: ReturnType<typeof vi.fn>;

/** Stubs global fetch so it resolves with the given ArrayBuffer. */
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
 * Stubs global AudioContext with a decodeAudioData that resolves (or
 * rejects) with the given buffer. Supports both the promise style
 * (decodeAudioData(data)) and the legacy callback style
 * (decodeAudioData(data, onSuccess, onError)) so the tests do not
 * over-constrain the implementation.
 */
function stubAudioContextDecode(
  result: AudioBuffer | Error | null,
  options: { throwOnConstruct?: boolean } = {}
): void {
  if (options.throwOnConstruct) {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('AudioContext construction denied');
        }
      }
    );
    return;
  }

  decodeAudioDataMock = vi.fn(
    (
      _data: ArrayBuffer,
      onSuccess?: (buffer: AudioBuffer | null) => void,
      onError?: (error: DOMException) => void
    ) => {
      const promise =
        result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
      // Guard against unhandled-rejection noise when only callbacks are used.
      promise.catch(() => {});
      if (typeof onSuccess === 'function' || typeof onError === 'function') {
        void promise.then(onSuccess, onError);
      }
      return promise;
    }
  );

  class MockAudioContext {
    decodeAudioData = decodeAudioDataMock;
    close = vi.fn(async () => {});
  }

  vi.stubGlobal('AudioContext', MockAudioContext);
}

describe('generateWaveformPeaks', () => {
  beforeEach(() => {
    // Default happy-path scaffolding; individual tests override as needed.
    stubFetchArrayBuffer(new ArrayBuffer(8));
    stubAudioContextDecode(makeAudioBuffer({ channels: [new Float32Array(8)] }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves to a Float32Array of length 300 (the default numPeaks)', async () => {
    const samples = new Float32Array(300);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = i / samples.length;
    }
    stubFetchArrayBuffer(new ArrayBuffer(16));
    stubAudioContextDecode(makeAudioBuffer({ channels: [samples] }));

    const peaks = await generateWaveformPeaks('song.mp3');

    expect(peaks).toBeInstanceOf(Float32Array);
    expect(peaks?.length).toBe(300);
  });

  it('resolves to a Float32Array of length numPeaks when numPeaks is provided', async () => {
    const samples = new Float32Array(16);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = i / samples.length;
    }
    stubFetchArrayBuffer(new ArrayBuffer(16));
    stubAudioContextDecode(makeAudioBuffer({ channels: [samples] }));

    const peaks = await generateWaveformPeaks('song.mp3', 8);

    expect(peaks).toBeInstanceOf(Float32Array);
    expect(peaks?.length).toBe(8);
  });

  it('takes the max absolute amplitude per equal time bucket of channel 0 and normalizes the max to 1.0', async () => {
    // 8 samples in 4 equal buckets of 2 samples each.
    // All values are dyadic rationals so the float32 results are exact:
    //   bucket 0: |0.125|, |-0.25| -> 0.25
    //   bucket 1: |0.25|,  |-0.5|  -> 0.5
    //   bucket 2: |0.5|,   |-1.0|  -> 1.0
    //   bucket 3: |-0.5|,  |0.25|  -> 0.5
    // Normalized by the overall max (1.0): [0.25, 0.5, 1, 0.5]
    const samples = new Float32Array([0.125, -0.25, 0.25, -0.5, 0.5, -1.0, -0.5, 0.25]);
    stubFetchArrayBuffer(new ArrayBuffer(32));
    stubAudioContextDecode(makeAudioBuffer({ channels: [samples] }));

    const peaks = await generateWaveformPeaks('song.mp3', 4);

    expect(peaks).toBeInstanceOf(Float32Array);
    expect(Array.from(peaks as Float32Array)).toEqual([0.25, 0.5, 1, 0.5]);
  });

  it('extracts peaks from channel 0 only (ignores other channels)', async () => {
    // channel 0 buckets -> [0.5, 0.25] -> normalized [1, 0.5].
    // channel 1 is constant 1.0, which would produce [1, 1] if it were used.
    const channel0 = new Float32Array([0.5, 0, 0, 0.25]);
    const channel1 = new Float32Array([1, 1, 1, 1]);
    stubFetchArrayBuffer(new ArrayBuffer(16));
    stubAudioContextDecode(makeAudioBuffer({ channels: [channel0, channel1] }));

    const peaks = await generateWaveformPeaks('song.mp3', 2);

    expect(Array.from(peaks as Float32Array)).toEqual([1, 0.5]);
  });

  it('fetches the given audioUrl', async () => {
    stubFetchArrayBuffer(new ArrayBuffer(8));

    await generateWaveformPeaks('https://cdn.example.com/song.mp3');

    expect(fetchMock).toHaveBeenCalledWith('https://cdn.example.com/song.mp3');
  });

  it('decodes the fetched ArrayBuffer via AudioContext.decodeAudioData', async () => {
    const arrayBuffer = new ArrayBuffer(24);
    stubFetchArrayBuffer(arrayBuffer);
    stubAudioContextDecode(makeAudioBuffer({ channels: [new Float32Array(4)] }));

    await generateWaveformPeaks('song.mp3', 2);

    expect(decodeAudioDataMock).toHaveBeenCalled();
    // Read the first positional argument so the assertion works for both the
    // promise style and the legacy callback style of decodeAudioData.
    expect(decodeAudioDataMock.mock.calls[0][0]).toBe(arrayBuffer);
  });

  it('resolves to null when fetch rejects (never throws)', async () => {
    fetchMock = vi.fn().mockRejectedValue(new TypeError('network down'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateWaveformPeaks('song.mp3')).resolves.toBeNull();
  });

  it('resolves to null when the fetch response is not ok (never throws)', async () => {
    stubFetchArrayBuffer(new ArrayBuffer(8), { ok: false });

    await expect(generateWaveformPeaks('song.mp3')).resolves.toBeNull();
  });

  it('resolves to null when decodeAudioData rejects (never throws)', async () => {
    stubAudioContextDecode(new Error('decode failed'));

    await expect(generateWaveformPeaks('song.mp3')).resolves.toBeNull();
  });

  it('resolves to null when the AudioContext cannot be constructed (never throws)', async () => {
    stubAudioContextDecode(null, { throwOnConstruct: true });

    await expect(generateWaveformPeaks('song.mp3')).resolves.toBeNull();
  });
});
