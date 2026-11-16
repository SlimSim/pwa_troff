import { afterEach, describe, expect, it } from 'vitest';
import * as debugFlagsModule from '../utils/debug-flags.js';

/**
 * Regression tests for the iOS audio-skipping diagnostic feature flags.
 *
 * Feature contract (utils/debug-flags.ts):
 *  - DebugFlags = { audioGraphEnabled: boolean; waveformEnabled: boolean }
 *  - Defaults: both true.
 *  - `?audiograph=off` (case-insensitive value, trimmed) disables the graph.
 *  - `?waveform=off` disables waveform generation.
 *  - Only the literal value `off` disables; `on`, `0`, `false`, empty stay true.
 *  - parseDebugFlags never throws for missing/undefined/non-string input.
 *  - getDebugFlags() reads window.location.search live (not cached) and the
 *    isAudioGraphEnabled()/isWaveformEnabled() helpers delegate to it.
 *
 * The real module is imported — nothing is reimplemented in this test file.
 * This suite exercises the implemented contract.
 */

interface DebugFlags {
  audioGraphEnabled: boolean;
  waveformEnabled: boolean;
}

interface DebugFlagsModule {
  parseDebugFlags: (search: string) => DebugFlags;
  getDebugFlags: () => DebugFlags;
  isAudioGraphEnabled: () => boolean;
  isWaveformEnabled: () => boolean;
}

const debugFlags = debugFlagsModule as unknown as DebugFlagsModule;

const DEFAULTS: DebugFlags = {
  audioGraphEnabled: true,
  waveformEnabled: true,
};

function setUrl(search: string): void {
  window.history.replaceState({}, '', search);
}

afterEach(() => {
  setUrl('/');
});

describe('parseDebugFlags (pure)', () => {
  it('returns both-enabled defaults for an empty search string', () => {
    expect(debugFlags.parseDebugFlags('')).toEqual(DEFAULTS);
  });

  it('returns defaults for a bare "?"', () => {
    expect(debugFlags.parseDebugFlags('?')).toEqual(DEFAULTS);
  });

  it('disables the audio graph for ?audiograph=off', () => {
    expect(debugFlags.parseDebugFlags('?audiograph=off')).toEqual({
      audioGraphEnabled: false,
      waveformEnabled: true,
    });
  });

  it('accepts a search string without the leading "?"', () => {
    expect(debugFlags.parseDebugFlags('audiograph=off')).toEqual({
      audioGraphEnabled: false,
      waveformEnabled: true,
    });
  });

  it('is case-insensitive for the value (?AUDIOGRAPH=OFF)', () => {
    expect(debugFlags.parseDebugFlags('?AUDIOGRAPH=OFF')).toEqual({
      audioGraphEnabled: false,
      waveformEnabled: true,
    });
  });

  it('trims whitespace around the value (?audiograph= off )', () => {
    expect(debugFlags.parseDebugFlags('?audiograph= off ')).toEqual({
      audioGraphEnabled: false,
      waveformEnabled: true,
    });
  });

  it('disables the waveform for ?waveform=off', () => {
    expect(debugFlags.parseDebugFlags('?waveform=off')).toEqual({
      audioGraphEnabled: true,
      waveformEnabled: false,
    });
  });

  it('disables both when both flags are off', () => {
    expect(debugFlags.parseDebugFlags('?audiograph=off&waveform=off')).toEqual({
      audioGraphEnabled: false,
      waveformEnabled: false,
    });
  });

  it('keeps both enabled for non-off values (?audiograph=on&waveform=1)', () => {
    expect(debugFlags.parseDebugFlags('?audiograph=on&waveform=1')).toEqual(DEFAULTS);
  });

  it('ignores unknown keys and only reacts to the literal off value', () => {
    expect(debugFlags.parseDebugFlags('?foo=bar&audiograph=off&unknown')).toEqual({
      audioGraphEnabled: false,
      waveformEnabled: true,
    });
  });

  it('keeps both enabled for empty, 0 and false values', () => {
    expect(debugFlags.parseDebugFlags('?audiograph=&waveform=false')).toEqual(DEFAULTS);
    expect(debugFlags.parseDebugFlags('?audiograph=0&waveform=0')).toEqual(DEFAULTS);
  });

  it('never throws for undefined input and returns defaults', () => {
    expect(debugFlags.parseDebugFlags(undefined as unknown as string)).toEqual(DEFAULTS);
  });

  it('never throws for null input and returns defaults', () => {
    expect(debugFlags.parseDebugFlags(null as unknown as string)).toEqual(DEFAULTS);
  });
});

describe('getDebugFlags / isAudioGraphEnabled / isWaveformEnabled (live URL)', () => {
  it('reads window.location.search at call time, not at import time', () => {
    setUrl('/');
    expect(debugFlags.getDebugFlags()).toEqual(DEFAULTS);

    setUrl('/?audiograph=off&waveform=off');
    expect(debugFlags.getDebugFlags()).toEqual({
      audioGraphEnabled: false,
      waveformEnabled: false,
    });

    setUrl('/');
    expect(debugFlags.getDebugFlags()).toEqual(DEFAULTS);
  });

  it('reflects the URL through isAudioGraphEnabled() and isWaveformEnabled()', () => {
    setUrl('/?audiograph=off');
    expect(debugFlags.isAudioGraphEnabled()).toBe(false);
    expect(debugFlags.isWaveformEnabled()).toBe(true);

    setUrl('/?waveform=off');
    expect(debugFlags.isAudioGraphEnabled()).toBe(true);
    expect(debugFlags.isWaveformEnabled()).toBe(false);

    setUrl('/');
    expect(debugFlags.isAudioGraphEnabled()).toBe(true);
    expect(debugFlags.isWaveformEnabled()).toBe(true);
  });
});
