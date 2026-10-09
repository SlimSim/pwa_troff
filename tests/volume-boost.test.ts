import { describe, it, expect } from 'vitest';
import {
  MAX_VOLUME_PERCENT,
  volumePercentToElementVolume,
  volumePercentToGain,
} from '../services/audio.js';
import * as audioModule from '../services/audio.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * FEATURE SPEC: Volume boost beyond 100%
 *
 * - Volume 0-420%. Centralized helpers live in services/audio.ts:
 *   MAX_VOLUME_PERCENT = 420,
 *   volumePercentToElementVolume(percent) -> clamp 0-100% to 0-1,
 *   volumePercentToGain(percent) -> <=100 => 1, >100 => percent/100 clamped 0-4.2,
 *   plus setVolumePercent / applyVolumeBoost that sets element volumes + gain
 *   and gracefully no-ops if AudioContext is unavailable.
 * - UI dials in t-footer.ts and t-current-song-controls.ts must allow up to 420.
 *
 * These tests import the ACTUAL helpers (never re-implemented) so they FAIL
 * (RED) while the helpers are capped at 200 and dials are capped at max="200".
 */

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function readSource(relPath: string): string {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

/** The impure apply helper may be named setVolumePercent or applyVolumeBoost. */
function getApplyFn(): unknown {
  const m = audioModule as unknown as Record<string, unknown>;
  return m['setVolumePercent'] ?? m['applyVolumeBoost'];
}

describe('volume boost helpers (services/audio.ts)', () => {
  it('exports MAX_VOLUME_PERCENT = 420', () => {
    expect(MAX_VOLUME_PERCENT).toBe(420);
  });

  it('volumePercentToElementVolume clamps 0-100% onto 0-1 (element cap)', () => {
    expect(volumePercentToElementVolume(0)).toBe(0);
    expect(volumePercentToElementVolume(50)).toBeCloseTo(0.5, 5);
    expect(volumePercentToElementVolume(100)).toBe(1);
    // HTMLMediaElement.volume is capped at 1.0 so >100% stays at 1 here
    // (the extra boost comes from the GainNode).
    expect(volumePercentToElementVolume(150)).toBe(1);
    expect(volumePercentToElementVolume(200)).toBe(1);
    expect(volumePercentToElementVolume(420)).toBe(1);
    expect(volumePercentToElementVolume(-20)).toBe(0);
  });

  it('volumePercentToElementVolume handles non-finite input deterministically within [0,1]', () => {
    const a = volumePercentToElementVolume(NaN);
    const b = volumePercentToElementVolume(NaN);
    expect(typeof a).toBe('number');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
    for (const v of [Infinity, -Infinity]) {
      const r = volumePercentToElementVolume(v);
      expect(typeof r).toBe('number');
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it('volumePercentToGain is 1 at/below 100% and percent/100 above, clamped 0-4.2', () => {
    expect(volumePercentToGain(0)).toBe(1);
    expect(volumePercentToGain(50)).toBe(1);
    expect(volumePercentToGain(100)).toBe(1);
    expect(volumePercentToGain(150)).toBeCloseTo(1.5, 5);
    expect(volumePercentToGain(200)).toBeCloseTo(2, 5);
    expect(volumePercentToGain(420)).toBeCloseTo(4.2, 5);
    // Clamped at 4.2x even for absurd values.
    expect(volumePercentToGain(500)).toBeCloseTo(4.2, 5);
  });

  it('volumePercentToGain handles non-finite input deterministically within [0,4.2]', () => {
    const a = volumePercentToGain(NaN);
    const b = volumePercentToGain(NaN);
    expect(typeof a).toBe('number');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(4.2);
    for (const v of [Infinity, -Infinity]) {
      const r = volumePercentToGain(v);
      expect(typeof r).toBe('number');
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(4.2);
    }
  });

  it('exposes an impure apply helper (setVolumePercent or applyVolumeBoost)', () => {
    expect(
      getApplyFn(),
      'expected services/audio.ts to export setVolumePercent or applyVolumeBoost'
    ).toBeDefined();
  });

  it('apply helper gracefully no-ops without AudioContext / media (happy-dom has none)', () => {
    const fn = getApplyFn() as (...args: unknown[]) => unknown;
    expect(() => (fn as (...a: number[]) => unknown)(150)).not.toThrow();
  });

  it('apply helper caps element volume at 1.0 while boosting gain for >100%', () => {
    const fn = getApplyFn() as (...args: never[]) => unknown;
    const fakeElement = { volume: 0 };
    const fakeGain = { gain: { value: 1 } };
    // Injectable-gain calling convention: (percent, { element, gainNode }).
    // Tries the object form; the implementation must accept at least one
    // injectable form that is testable without a real AudioContext.
    (fn as (p: number, t: unknown) => void)(150, {
      element: fakeElement,
      gainNode: fakeGain,
    });
    expect(fakeElement.volume).toBe(1);
    expect(fakeGain.gain.value).toBeCloseTo(1.5, 5);
  });

  it('apply helper boosts gain to 4.2 at 420% (injectable form)', () => {
    const fn = getApplyFn() as (...args: never[]) => unknown;
    const fakeElement = { volume: 0 };
    const fakeGain = { gain: { value: 1 } };
    (fn as (p: number, t: unknown) => void)(420, {
      element: fakeElement,
      gainNode: fakeGain,
    });
    expect(fakeElement.volume).toBe(1);
    expect(fakeGain.gain.value).toBeCloseTo(4.2, 5);
  });
});

describe('volume dials allow up to 420%', () => {
  it('t-footer volume dial max is 420', () => {
    const src = readSource('components/molecule/t-footer.ts');
    // Find the Volume t-dial block and assert its max is 420 (not 200).
    const volumeDial = src.match(/<t-dial[^>]*label="Volume"[^>]*>/s);
    expect(volumeDial, 'Volume t-dial not found in t-footer.ts').toBeTruthy();
    expect(volumeDial![0]).toContain('max="420"');
  });

  it('t-current-song-controls volume dial max is 420', () => {
    const src = readSource('components/molecule/t-current-song-controls.ts');
    const volumeDial = src.match(/<t-dial[^>]*label="Volume"[^>]*>/s);
    expect(
      volumeDial,
      'Volume t-dial not found in t-current-song-controls.ts'
    ).toBeTruthy();
    expect(volumeDial![0]).toContain('max="420"');
  });
});
