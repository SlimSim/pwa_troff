// RED tests for iOS corrupt-MP3 resilient playback helpers.
//
// Production bug context: one 2MB MP3 (2:11 desktop, 2:12 iOS) with markers
// 0..131.69s. On iOS only, WebKit skips corrupt frames (currentTime jumps,
// e.g. ~10s skipped around 90s, ended fires ~11s early) and seeks to certain
// offsets fail. v2 clamps stop to a possibly stale markerSlider.max while v1
// clamps to live media.duration.
//
// Assumptions (stated per AGENTS.md — adjust with the fix if needed):
//   - clampSeekTime(requested, duration, seekableEnd): number
//   - isDiscontinuity(prevTime, currTime, threshold = 2): boolean
//   - shouldTreatEndedAsGap(currentTime, duration, threshold = 2): boolean
//   - buildPlaybackErrorContext(input: object with the 10 numeric/code fields
//     below): object with ONLY those fields; time fields rounded to 0.1s.
//   - isBenignPlayError(error: unknown): boolean
//
// These tests import the REAL module (../utils/playback-resilience.js) —
// nothing is reimplemented. They are RED while the module does not exist
// (import resolution failure) and GREEN once the helpers match this contract.

import { describe, it, expect } from 'vitest';
import {
  clampSeekTime,
  isDiscontinuity,
  shouldTreatEndedAsGap,
  buildPlaybackErrorContext,
  isBenignPlayError,
} from '../utils/playback-resilience.js';

// ---- clampSeekTime --------------------------------------------------------

describe('clampSeekTime — corrupt-MP3 safe seeking', () => {
  it('returns the requested time when inside [0, min(duration, seekableEnd)]', () => {
    expect(clampSeekTime(30, 131.69, 132)).toBe(30);
    expect(clampSeekTime(0, 131.69, 132)).toBe(0);
  });

  it('clamps negative requests to 0', () => {
    expect(clampSeekTime(-5, 131.69, 132)).toBe(0);
  });

  it('clamps to duration when seekableEnd covers the whole file', () => {
    expect(clampSeekTime(200, 131.69, 132)).toBe(131.69);
  });

  it('clamps to seekableEnd when it is shorter than duration (iOS corrupt tail)', () => {
    // Production shape: live duration ~131.69s but the seekable range ends
    // early, so a request past it must clamp to seekableEnd, not duration.
    expect(clampSeekTime(125, 131.69, 121)).toBe(121);
    expect(clampSeekTime(90, 131.69, 121)).toBe(90);
  });

  it('returns 0 for non-finite inputs', () => {
    expect(clampSeekTime(Number.NaN, 131.69, 132)).toBe(0);
    expect(clampSeekTime(30, Number.NaN, 132)).toBe(0);
    expect(clampSeekTime(30, 131.69, Number.NaN)).toBe(0);
    expect(clampSeekTime(Number.POSITIVE_INFINITY, 131.69, 132)).toBe(0);
    expect(clampSeekTime(30, Number.POSITIVE_INFINITY, 132)).toBe(0);
    expect(clampSeekTime(30, 131.69, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

// ---- isDiscontinuity ------------------------------------------------------

describe('isDiscontinuity — WebKit decoder-skip detection', () => {
  it('is true for a forward jump larger than the default 2s threshold (the ~10s skip around 90s)', () => {
    expect(isDiscontinuity(85, 95)).toBe(true);
  });

  it('is false for normal small forward progress', () => {
    expect(isDiscontinuity(85, 85.5)).toBe(false);
  });

  it('is false for backward seeks (user dragged back)', () => {
    expect(isDiscontinuity(60, 10)).toBe(false);
  });

  it('honours a custom threshold', () => {
    expect(isDiscontinuity(0, 9, 10)).toBe(false);
    expect(isDiscontinuity(0, 11, 10)).toBe(true);
  });
});

// ---- shouldTreatEndedAsGap -------------------------------------------------

describe('shouldTreatEndedAsGap — ended fired while content remains', () => {
  it('is true when ended fires ~11s early (2:01 of 2:12, corrupt tail skipped)', () => {
    expect(shouldTreatEndedAsGap(121, 132)).toBe(true);
  });

  it('is false when ended fires at the real end of the file', () => {
    expect(shouldTreatEndedAsGap(131.9, 132)).toBe(false);
    expect(shouldTreatEndedAsGap(132, 132)).toBe(false);
  });

  it('honours a custom threshold', () => {
    expect(shouldTreatEndedAsGap(125, 132, 10)).toBe(false);
    expect(shouldTreatEndedAsGap(121, 132, 10)).toBe(true);
  });
});

// ---- buildPlaybackErrorContext ---------------------------------------------

const ALLOWED_CONTEXT_KEYS = [
  'duration',
  'currentTime',
  'seekableEnd',
  'playbackStart',
  'playbackStop',
  'loopTimesLeft',
  'fileSize',
  'readyState',
  'networkState',
  'errorCode',
].sort();

describe('buildPlaybackErrorContext — numeric-only, PII-free', () => {
  it('returns ONLY the allowlisted numeric/code fields', () => {
    const context = buildPlaybackErrorContext({
      duration: 132,
      currentTime: 90,
      seekableEnd: 121,
      playbackStart: 0,
      playbackStop: 131.69,
      loopTimesLeft: 3,
      fileSize: 2_000_000,
      readyState: 4,
      networkState: 1,
      errorCode: 3,
    });

    expect(Object.keys(context).sort()).toEqual(ALLOWED_CONTEXT_KEYS);
  });

  it('rounds time fields to 0.1s', () => {
    const context = buildPlaybackErrorContext({
      duration: 131.694,
      currentTime: 90.05,
      seekableEnd: 121.26,
      playbackStart: 0,
      playbackStop: 131.69,
      loopTimesLeft: 1,
      fileSize: 2_000_000,
      readyState: 4,
      networkState: 1,
      errorCode: 0,
    });

    expect(context.duration).toBe(131.7);
    expect(context.currentTime).toBe(90.1);
    expect(context.seekableEnd).toBe(121.3);
  });

  it('NEVER leaks songKey, marker names/info, serverId, email or blob URLs even if the caller passes extras', () => {
    const inputWithPiiDecoys = {
      duration: 132,
      currentTime: 90,
      seekableEnd: 121,
      playbackStart: 0,
      playbackStop: 131.69,
      loopTimesLeft: 3,
      fileSize: 2_000_000,
      readyState: 4,
      networkState: 1,
      errorCode: 3,
      songKey: 'secret-song-key.mp3',
      markerName: 'Secret Marker',
      markerInfo: 'secret info',
      serverId: 12345,
      email: 'user@example.com',
      blobUrl: 'blob:https://troff.app/secret-id',
    } as unknown as Parameters<typeof buildPlaybackErrorContext>[0];
    const context = buildPlaybackErrorContext(inputWithPiiDecoys);

    expect(context).not.toHaveProperty('songKey');
    expect(context).not.toHaveProperty('markerName');
    expect(context).not.toHaveProperty('markerInfo');
    expect(context).not.toHaveProperty('serverId');
    expect(context).not.toHaveProperty('email');
    expect(context).not.toHaveProperty('blobUrl');

    const serialised = JSON.stringify(context);
    expect(serialised).not.toContain('secret-song-key');
    expect(serialised).not.toContain('Secret Marker');
    expect(serialised).not.toContain('user@example.com');
    expect(serialised).not.toContain('blob:');
  });
});

// ---- isBenignPlayError -------------------------------------------------------

describe('isBenignPlayError — play() rejection triage', () => {
  it('is true for AbortError interruptions (pause/load racing play)', () => {
    expect(isBenignPlayError(new DOMException('The operation was aborted.', 'AbortError'))).toBe(true);
    expect(
      isBenignPlayError(
        new DOMException('The play() request was interrupted by a call to pause().', 'AbortError')
      )
    ).toBe(true);
    expect(isBenignPlayError(new Error('The operation was aborted'))).toBe(true);
    expect(isBenignPlayError(new Error('The play() request was interrupted by a call to pause()'))).toBe(true);
  });

  it('is true for NotAllowedError autoplay noise', () => {
    expect(isBenignPlayError(new DOMException('play() failed because the user didn\'t interact.', 'NotAllowedError'))).toBe(
      true
    );
  });

  it('is false for real decode/network errors', () => {
    expect(isBenignPlayError(new Error('Failed to load because no supported source was found.'))).toBe(false);
    expect(isBenignPlayError(new TypeError('Cannot read properties of null'))).toBe(false);
    expect(isBenignPlayError(new DOMException('The element has no supported sources.', 'NotSupportedError'))).toBe(
      false
    );
  });

  it('is false for non-errors', () => {
    expect(isBenignPlayError(null)).toBe(false);
    expect(isBenignPlayError(undefined)).toBe(false);
    expect(isBenignPlayError('boom')).toBe(false);
  });
});
