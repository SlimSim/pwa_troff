import { describe, expect, it } from 'vitest';
import * as playbackResilience from '../utils/playback-resilience.js';

/**
 * Regression tests for `buildPlaybackSkipContext()` in utils/playback-resilience.ts.
 *
 * Feature contract:
 *  - Builds a numeric-only, PII-free snapshot of a detected playback skip.
 *  - Exactly the documented 27 keys (no extra fields).
 *  - Time fields rounded to 0.1 s; wallClockDeltaMs/waveformLastDurationMs/
 *    volumePercent rounded to integers; forwardSkipSeconds to 0.1 s;
 *    gainValue and playbackRate to 2 decimals.
 *  - audioContextState is allowlisted to
 *    'none' | 'running' | 'suspended' | 'closed' | 'interrupted'; anything
 *    else becomes 'none'. mediaKind only keeps 'video'; anything else is
 *    'audio'.
 *  - Booleans are preserved exactly; non-finite numerics become 0.
 *  - No PII: no song keys, marker ids, blob/http URLs or email addresses.
 *
 * The real module is imported — nothing is reimplemented in this test file.
 */

interface PlaybackSkipContextInput {
  duration: number;
  currentTime: number;
  previousTime: number;
  seekableEnd: number;
  playbackStart: number;
  playbackStop: number;
  markerSliderMax: number;
  loopTimesLeft: number;
  fileSize: number;
  readyState: number;
  networkState: number;
  errorCode: number;
  wallClockDeltaMs: number;
  forwardSkipSeconds: number;
  volumePercent: number;
  gainValue: number;
  elementVolumeWorks: boolean;
  audioGraphEnabled: boolean;
  audioGraphCreated: boolean;
  audioContextState: 'none' | 'running' | 'suspended' | 'closed' | 'interrupted';
  audioContextSampleRate: number;
  waveformEnabled: boolean;
  waveformInProgress: boolean;
  waveformLastDurationMs: number;
  mediaKind: 'audio' | 'video';
  playbackRate: number;
  preservesPitch: boolean;
}

type PlaybackSkipContext = PlaybackSkipContextInput;

type PlaybackResilienceWithSkipContext = typeof playbackResilience & {
  buildPlaybackSkipContext: (input: PlaybackSkipContextInput) => PlaybackSkipContext;
};

const { buildPlaybackSkipContext } =
  playbackResilience as unknown as PlaybackResilienceWithSkipContext;

const ALL_KEYS = [
  'duration',
  'currentTime',
  'previousTime',
  'seekableEnd',
  'playbackStart',
  'playbackStop',
  'markerSliderMax',
  'loopTimesLeft',
  'fileSize',
  'readyState',
  'networkState',
  'errorCode',
  'wallClockDeltaMs',
  'forwardSkipSeconds',
  'volumePercent',
  'gainValue',
  'elementVolumeWorks',
  'audioGraphEnabled',
  'audioGraphCreated',
  'audioContextState',
  'audioContextSampleRate',
  'waveformEnabled',
  'waveformInProgress',
  'waveformLastDurationMs',
  'mediaKind',
  'playbackRate',
  'preservesPitch',
] as const;

const NUMERIC_KEYS = [
  'duration',
  'currentTime',
  'previousTime',
  'seekableEnd',
  'playbackStart',
  'playbackStop',
  'markerSliderMax',
  'loopTimesLeft',
  'fileSize',
  'readyState',
  'networkState',
  'errorCode',
  'wallClockDeltaMs',
  'forwardSkipSeconds',
  'volumePercent',
  'gainValue',
  'audioContextSampleRate',
  'waveformLastDurationMs',
  'playbackRate',
] as const;

function makeInput(overrides: Partial<PlaybackSkipContextInput> = {}): PlaybackSkipContextInput {
  return {
    duration: 131.694,
    currentTime: 12.36,
    previousTime: 12.06,
    seekableEnd: 200.04,
    playbackStart: 10.06,
    playbackStop: 60.04,
    markerSliderMax: 120,
    loopTimesLeft: 3,
    fileSize: 1234567,
    readyState: 4,
    networkState: 2,
    errorCode: 0,
    wallClockDeltaMs: 1000.6,
    forwardSkipSeconds: 4.26,
    volumePercent: 75.6,
    gainValue: 0.756,
    elementVolumeWorks: true,
    audioGraphEnabled: true,
    audioGraphCreated: true,
    audioContextState: 'running',
    audioContextSampleRate: 48000,
    waveformEnabled: true,
    waveformInProgress: false,
    waveformLastDurationMs: 249.6,
    mediaKind: 'audio',
    playbackRate: 0.876,
    preservesPitch: true,
    ...overrides,
  };
}

describe('buildPlaybackSkipContext — shape', () => {
  it('returns exactly the documented allowlist of keys', () => {
    const context = buildPlaybackSkipContext(makeInput());

    expect(Object.keys(context).sort()).toEqual([...ALL_KEYS].sort());
  });
});

describe('buildPlaybackSkipContext — rounding', () => {
  it('rounds time fields to 0.1 s, integers and 2-decimal values', () => {
    const context = buildPlaybackSkipContext(makeInput());

    expect(context.duration).toBe(131.7);
    expect(context.currentTime).toBe(12.4);
    expect(context.previousTime).toBe(12.1);
    expect(context.seekableEnd).toBe(200);
    expect(context.playbackStart).toBe(10.1);
    expect(context.playbackStop).toBe(60);
    expect(context.markerSliderMax).toBe(120);

    expect(context.wallClockDeltaMs).toBe(1001);
    expect(context.forwardSkipSeconds).toBe(4.3);
    expect(context.waveformLastDurationMs).toBe(250);
    expect(context.volumePercent).toBe(76);

    expect(context.gainValue).toBe(0.76);
    expect(context.playbackRate).toBe(0.88);

    expect(context.loopTimesLeft).toBe(3);
    expect(context.fileSize).toBe(1234567);
    expect(context.readyState).toBe(4);
    expect(context.networkState).toBe(2);
    expect(context.errorCode).toBe(0);
    expect(context.audioContextSampleRate).toBe(48000);
  });
});

describe('buildPlaybackSkipContext — allowlisted enums', () => {
  it('keeps each allowed audioContextState value', () => {
    for (const state of ['none', 'running', 'suspended', 'closed', 'interrupted'] as const) {
      const context = buildPlaybackSkipContext(makeInput({ audioContextState: state }));
      expect(context.audioContextState).toBe(state);
    }
  });

  it('maps unknown audioContextState values to "none"', () => {
    const weird = buildPlaybackSkipContext(
      makeInput({ audioContextState: 'weird' as unknown as 'none' })
    );
    expect(weird.audioContextState).toBe('none');

    const empty = buildPlaybackSkipContext(
      makeInput({ audioContextState: '' as unknown as 'none' })
    );
    expect(empty.audioContextState).toBe('none');

    const missing = buildPlaybackSkipContext(
      makeInput({ audioContextState: undefined as unknown as 'none' })
    );
    expect(missing.audioContextState).toBe('none');
  });

  it('keeps mediaKind "video" and coerces anything else to "audio"', () => {
    const video = buildPlaybackSkipContext(makeInput({ mediaKind: 'video' }));
    expect(video.mediaKind).toBe('video');

    const weird = buildPlaybackSkipContext(
      makeInput({ mediaKind: 'weird' as unknown as 'audio' })
    );
    expect(weird.mediaKind).toBe('audio');
  });
});

describe('buildPlaybackSkipContext — booleans and non-finite values', () => {
  it('preserves every boolean exactly', () => {
    const context = buildPlaybackSkipContext(
      makeInput({
        elementVolumeWorks: false,
        audioGraphEnabled: false,
        audioGraphCreated: true,
        waveformEnabled: false,
        waveformInProgress: true,
        preservesPitch: false,
      })
    );

    expect(context.elementVolumeWorks).toBe(false);
    expect(context.audioGraphEnabled).toBe(false);
    expect(context.audioGraphCreated).toBe(true);
    expect(context.waveformEnabled).toBe(false);
    expect(context.waveformInProgress).toBe(true);
    expect(context.preservesPitch).toBe(false);
  });

  it('turns every non-finite numeric into 0', () => {
    const nonFinite = makeInput();
    for (const key of NUMERIC_KEYS) {
      nonFinite[key] = Number.NaN;
    }

    const context = buildPlaybackSkipContext(nonFinite);

    for (const key of NUMERIC_KEYS) {
      expect(context[key]).toBe(0);
    }
  });

  it('turns Infinity into 0 as well', () => {
    const infinite = makeInput();
    for (const key of NUMERIC_KEYS) {
      infinite[key] = Number.POSITIVE_INFINITY;
    }

    const context = buildPlaybackSkipContext(infinite);

    for (const key of NUMERIC_KEYS) {
      expect(context[key]).toBe(0);
    }
  });
});

describe('buildPlaybackSkipContext — no PII', () => {
  it('serialises without song keys, marker ids, blob/http URLs or emails', () => {
    const serialised = JSON.stringify(buildPlaybackSkipContext(makeInput()));

    expect(serialised).not.toMatch(/songKey|markerId|blob:|https?:|@/i);
  });
});
