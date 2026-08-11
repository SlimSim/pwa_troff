import { describe, it, expect } from 'vitest';
import { createTapTempoState, calculateTapTempo } from '../utils/tap-tempo.js';
import type { TapTempoState } from '../utils/tap-tempo.js';

describe('tap-tempo', () => {
  describe('createTapTempoState', () => {
    it('returns an empty/reset state', () => {
      expect(createTapTempoState()).toEqual({ previousTime: null, startTime: null, nrTaps: 0 });
    });
  });

  describe('calculateTapTempo', () => {
    it('returns null on the first tap and seeds the state', () => {
      const state: TapTempoState = createTapTempoState();

      expect(calculateTapTempo(state, 1000)).toBeNull();

      expect(state.previousTime).toBe(1000);
      expect(state.startTime).toBe(1000);
      expect(state.nrTaps).toBe(0);
    });

    it('taps at 0/500/1000ms yield null, 120, 120', () => {
      const state: TapTempoState = createTapTempoState();

      expect(calculateTapTempo(state, 0)).toBeNull();
      expect(calculateTapTempo(state, 500)).toBe(120);
      expect(calculateTapTempo(state, 1000)).toBe(120);
    });

    it('resets when the gap between taps exceeds 3000ms', () => {
      const state: TapTempoState = createTapTempoState();

      calculateTapTempo(state, 0); // first tap: reset, null

      // A gap of exactly 3000ms does NOT reset: 1 tap in 3s = 20 bpm
      expect(calculateTapTempo(state, 3000)).toBe(20);

      // A gap of 3001ms (> 3000) resets the state and returns null
      expect(calculateTapTempo(state, 6001)).toBeNull();
      expect(state).toEqual({ previousTime: 6001, startTime: 6001, nrTaps: 0 });
    });

    it('mutates the state across taps', () => {
      const state: TapTempoState = createTapTempoState();

      expect(calculateTapTempo(state, 100)).toBeNull(); // first tap
      expect(calculateTapTempo(state, 400)).toBe(200); // 1 tap in 0.3s = 200 bpm

      expect(state.nrTaps).toBe(1);
      expect(state.previousTime).toBe(400);
      expect(state.startTime).toBe(100);
    });

    it('returns null when the computed tempo is not finite (same-timestamp taps)', () => {
      const state: TapTempoState = createTapTempoState();

      expect(calculateTapTempo(state, 0)).toBeNull(); // first tap
      // Same timestamp → elapsed = 0s → bpm = Infinity → not finite → null
      expect(calculateTapTempo(state, 0)).toBeNull();
      expect(state.nrTaps).toBe(1);
    });
  });
});