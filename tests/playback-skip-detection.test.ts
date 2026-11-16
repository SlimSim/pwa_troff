import { describe, expect, it } from 'vitest';
import * as playbackResilience from '../utils/playback-resilience.js';

/**
 * Regression tests for `detectPlaybackSkip()` in utils/playback-resilience.ts.
 *
 * Feature contract:
 *  - expectedAdvanceSeconds = (wallClockDeltaMs / 1000) * playbackRate.
 *  - forwardSkipSeconds = currentTime - previousTime - expectedAdvanceSeconds,
 *    rounded to 0.1 s.
 *  - skipped = forwardSkipSeconds > thresholdSeconds (strict; default 0.3;
 *    non-finite/<= 0 threshold falls back to 0.3).
 *  - Invalid input (non-finite previousTime/currentTime/wallClockDeltaMs/
 *    playbackRate, wallClockDeltaMs <= 0 or > 5000, playbackRate <= 0)
 *    returns the exact zeroed result.
 *  - The result object contains exactly skipped, forwardSkipSeconds,
 *    expectedAdvanceSeconds and wallClockDeltaMs (no threshold key).
 *
 * The real module is imported — nothing is reimplemented in this test file.
 */

interface PlaybackSkipInput {
  previousTime: number;
  currentTime: number;
  wallClockDeltaMs: number;
  playbackRate: number;
  thresholdSeconds?: number;
}

interface PlaybackSkipResult {
  skipped: boolean;
  forwardSkipSeconds: number;
  expectedAdvanceSeconds: number;
  wallClockDeltaMs: number;
}

type PlaybackResilienceWithSkip = typeof playbackResilience & {
  detectPlaybackSkip: (input: PlaybackSkipInput) => PlaybackSkipResult;
};

const { detectPlaybackSkip } = playbackResilience as unknown as PlaybackResilienceWithSkip;

const ZEROED: PlaybackSkipResult = {
  skipped: false,
  forwardSkipSeconds: 0,
  expectedAdvanceSeconds: 0,
  wallClockDeltaMs: 0,
};

describe('detectPlaybackSkip — normal advance', () => {
  it('does not report when currentTime advances exactly as wall clock predicts', () => {
    const result = detectPlaybackSkip({
      previousTime: 10,
      currentTime: 11,
      wallClockDeltaMs: 1000,
      playbackRate: 1,
    });

    expect(result.skipped).toBe(false);
    expect(result.forwardSkipSeconds).toBe(0);
    expect(result.expectedAdvanceSeconds).toBe(1);
    expect(result.wallClockDeltaMs).toBe(1000);
  });

  it('never reports when the media clock advances slower than the wall clock (late timeupdate)', () => {
    const result = detectPlaybackSkip({
      previousTime: 10,
      currentTime: 10.5,
      wallClockDeltaMs: 1000,
      playbackRate: 1,
    });

    expect(result.skipped).toBe(false);
    expect(result.forwardSkipSeconds).toBe(-0.5);
    expect(result.expectedAdvanceSeconds).toBe(1);
  });
});

describe('detectPlaybackSkip — real skips', () => {
  it('reports a 4 s forward jump over 1 s at rate 1', () => {
    const result = detectPlaybackSkip({
      previousTime: 10,
      currentTime: 15,
      wallClockDeltaMs: 1000,
      playbackRate: 1,
    });

    expect(result).toEqual({
      skipped: true,
      forwardSkipSeconds: 4,
      expectedAdvanceSeconds: 1,
      wallClockDeltaMs: 1000,
    });
  });

  it('is rate-aware at playbackRate 0.5 (normal 0.5 s advance is not a skip)', () => {
    const normal = detectPlaybackSkip({
      previousTime: 10,
      currentTime: 10.5,
      wallClockDeltaMs: 1000,
      playbackRate: 0.5,
    });
    expect(normal.skipped).toBe(false);

    const skipped = detectPlaybackSkip({
      previousTime: 10,
      currentTime: 12,
      wallClockDeltaMs: 1000,
      playbackRate: 0.5,
    });
    expect(skipped.skipped).toBe(true);
    expect(skipped.forwardSkipSeconds).toBe(1.5);
  });
});

describe('detectPlaybackSkip — threshold boundaries', () => {
  it('does not report exactly at the default 0.3 s threshold (strict >)', () => {
    const result = detectPlaybackSkip({
      previousTime: 10,
      currentTime: 11.3,
      wallClockDeltaMs: 1000,
      playbackRate: 1,
    });

    expect(result.skipped).toBe(false);
    expect(result.forwardSkipSeconds).toBe(0.3);
  });

  it('reports just above the default threshold', () => {
    const result = detectPlaybackSkip({
      previousTime: 10,
      currentTime: 11.31,
      wallClockDeltaMs: 1000,
      playbackRate: 1,
    });

    expect(result.skipped).toBe(true);
  });

  it('honours a custom threshold of 0.5 s', () => {
    const below = detectPlaybackSkip({
      previousTime: 10,
      currentTime: 11.4,
      wallClockDeltaMs: 1000,
      playbackRate: 1,
      thresholdSeconds: 0.5,
    });
    expect(below.skipped).toBe(false);

    const above = detectPlaybackSkip({
      previousTime: 10,
      currentTime: 11.6,
      wallClockDeltaMs: 1000,
      playbackRate: 1,
      thresholdSeconds: 0.5,
    });
    expect(above.skipped).toBe(true);
  });

  it('falls back to 0.3 for non-finite, zero and negative thresholds', () => {
    for (const thresholdSeconds of [NaN, Infinity, 0, -1]) {
      const result = detectPlaybackSkip({
        previousTime: 10,
        currentTime: 11.31,
        wallClockDeltaMs: 1000,
        playbackRate: 1,
        thresholdSeconds,
      });
      expect(result.skipped).toBe(true);
    }
  });
});

describe('detectPlaybackSkip — invalid input returns the exact zeroed result', () => {
  it('rejects non-finite previousTime', () => {
    for (const previousTime of [NaN, Infinity, -Infinity]) {
      expect(
        detectPlaybackSkip({ previousTime, currentTime: 11, wallClockDeltaMs: 1000, playbackRate: 1 })
      ).toEqual(ZEROED);
    }
  });

  it('rejects non-finite currentTime', () => {
    for (const currentTime of [NaN, Infinity, -Infinity]) {
      expect(
        detectPlaybackSkip({ previousTime: 10, currentTime, wallClockDeltaMs: 1000, playbackRate: 1 })
      ).toEqual(ZEROED);
    }
  });

  it('rejects non-finite wallClockDeltaMs', () => {
    for (const wallClockDeltaMs of [NaN, Infinity, -Infinity]) {
      expect(
        detectPlaybackSkip({ previousTime: 10, currentTime: 11, wallClockDeltaMs, playbackRate: 1 })
      ).toEqual(ZEROED);
    }
  });

  it('rejects non-finite playbackRate', () => {
    for (const playbackRate of [NaN, Infinity, -Infinity]) {
      expect(
        detectPlaybackSkip({ previousTime: 10, currentTime: 11, wallClockDeltaMs: 1000, playbackRate })
      ).toEqual(ZEROED);
    }
  });

  it('rejects wallClockDeltaMs 0 and -100', () => {
    expect(
      detectPlaybackSkip({ previousTime: 10, currentTime: 15, wallClockDeltaMs: 0, playbackRate: 1 })
    ).toEqual(ZEROED);
    expect(
      detectPlaybackSkip({ previousTime: 10, currentTime: 15, wallClockDeltaMs: -100, playbackRate: 1 })
    ).toEqual(ZEROED);
  });

  it('rejects wallClockDeltaMs 5001 but accepts 5000', () => {
    expect(
      detectPlaybackSkip({ previousTime: 0, currentTime: 10, wallClockDeltaMs: 5001, playbackRate: 1 })
    ).toEqual(ZEROED);

    const accepted = detectPlaybackSkip({
      previousTime: 0,
      currentTime: 10,
      wallClockDeltaMs: 5000,
      playbackRate: 1,
    });
    expect(accepted.wallClockDeltaMs).toBe(5000);
    expect(accepted.expectedAdvanceSeconds).toBe(5);
    expect(accepted.forwardSkipSeconds).toBe(5);
    expect(accepted.skipped).toBe(true);
  });

  it('rejects playbackRate 0 and -1', () => {
    expect(
      detectPlaybackSkip({ previousTime: 10, currentTime: 15, wallClockDeltaMs: 1000, playbackRate: 0 })
    ).toEqual(ZEROED);
    expect(
      detectPlaybackSkip({ previousTime: 10, currentTime: 15, wallClockDeltaMs: 1000, playbackRate: -1 })
    ).toEqual(ZEROED);
  });
});

describe('detectPlaybackSkip — backward jumps and result shape', () => {
  it('allows a backward jump as a negative number but never reports it', () => {
    const result = detectPlaybackSkip({
      previousTime: 10,
      currentTime: 8,
      wallClockDeltaMs: 1000,
      playbackRate: 1,
    });

    expect(result.skipped).toBe(false);
    expect(result.forwardSkipSeconds).toBe(-3);
    expect(result.expectedAdvanceSeconds).toBe(1);
  });

  it('returns exactly the four documented keys (no threshold key)', () => {
    const result = detectPlaybackSkip({
      previousTime: 10,
      currentTime: 15,
      wallClockDeltaMs: 1000,
      playbackRate: 1,
      thresholdSeconds: 0.5,
    });

    expect(Object.keys(result).sort()).toEqual(
      ['skipped', 'forwardSkipSeconds', 'expectedAdvanceSeconds', 'wallClockDeltaMs'].sort()
    );
  });

  it('rounds expectedAdvanceSeconds to 0.1 and wallClockDeltaMs to an integer', () => {
    const result = detectPlaybackSkip({
      previousTime: 0,
      currentTime: 2,
      wallClockDeltaMs: 1234,
      playbackRate: 1,
    });

    // expected = 1.234 → 1.2; forward = 2 - 1.234 = 0.766 → 0.8
    expect(result.expectedAdvanceSeconds).toBe(1.2);
    expect(result.wallClockDeltaMs).toBe(1234);
    expect(Number.isInteger(result.wallClockDeltaMs)).toBe(true);
    expect(result.forwardSkipSeconds).toBe(0.8);
  });
});
