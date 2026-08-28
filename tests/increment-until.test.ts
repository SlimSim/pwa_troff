import { describe, it, expect } from 'vitest';
import { calculateIncrementUntilSpeed } from '../utils/increment-until.js';

describe('calculateIncrementUntilSpeed', () => {
  describe('already at target speed', () => {
    it('returns current speed when it equals the target', () => {
      expect(calculateIncrementUntilSpeed(100, 100, 5)).toBe(100);
    });

    it('returns current speed when both are 0', () => {
      expect(calculateIncrementUntilSpeed(0, 0, Infinity)).toBe(0);
    });

    it('returns current speed when both are 150', () => {
      expect(calculateIncrementUntilSpeed(150, 150, 3)).toBe(150);
    });
  });

  describe('infinite loops – speed up', () => {
    it('increments by +1 each loop toward a higher target', () => {
      expect(calculateIncrementUntilSpeed(100, 120, Infinity)).toBe(101);
    });

    it('increments by +1 when close to target', () => {
      expect(calculateIncrementUntilSpeed(119, 120, Infinity)).toBe(120);
    });

    it('increments by +1 at any distance', () => {
      expect(calculateIncrementUntilSpeed(50, 200, Infinity)).toBe(51);
    });
  });

  describe('infinite loops – slow down', () => {
    it('decrements by −1 each loop toward a lower target', () => {
      expect(calculateIncrementUntilSpeed(120, 100, Infinity)).toBe(119);
    });

    it('decrements by −1 when close to target', () => {
      expect(calculateIncrementUntilSpeed(101, 100, Infinity)).toBe(100);
    });

    it('decrements by −1 at any distance', () => {
      expect(calculateIncrementUntilSpeed(200, 50, Infinity)).toBe(199);
    });
  });

  describe('finite loops – speed up', () => {
    it('divides the 20-point difference evenly across 4 remaining loops', () => {
      // 100 → 120 with 4 loops left: increment = 20/4 = 5
      expect(calculateIncrementUntilSpeed(100, 120, 4)).toBe(105);
    });

    it('divides evenly across 5 remaining loops', () => {
      // 100 → 120 with 5 loops left: increment = 20/5 = 4
      expect(calculateIncrementUntilSpeed(100, 120, 5)).toBe(104);
    });

    it('sets directly to target when 1 loop remains', () => {
      // 116 → 120 with 1 loop left: increment = 4/1 = 4
      expect(calculateIncrementUntilSpeed(116, 120, 1)).toBe(120);
    });

    it('works with a large difference and many loops', () => {
      // 50 → 150 with 10 loops left: increment = 100/10 = 10
      expect(calculateIncrementUntilSpeed(50, 150, 10)).toBe(60);
    });

    it('works with a fractional increment', () => {
      // 100 → 110 with 3 loops left: increment = 10/3 ≈ 3.333…
      const result = calculateIncrementUntilSpeed(100, 110, 3);
      expect(result).toBeCloseTo(103.333, 2);
    });
  });

  describe('finite loops – slow down', () => {
    it('divides the negative difference evenly across remaining loops', () => {
      // 120 → 100 with 4 loops left: increment = -20/4 = -5
      expect(calculateIncrementUntilSpeed(120, 100, 4)).toBe(115);
    });

    it('sets directly to target when 1 loop remains', () => {
      // 104 → 100 with 1 loop left: increment = -4/1 = -4
      expect(calculateIncrementUntilSpeed(104, 100, 1)).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('returns current speed when loopTimesLeft is 0', () => {
      expect(calculateIncrementUntilSpeed(100, 120, 0)).toBe(100);
    });

    it('returns current speed when loopTimesLeft is negative', () => {
      expect(calculateIncrementUntilSpeed(100, 120, -1)).toBe(100);
    });

    it('handles target speed of 0 (stop)', () => {
      expect(calculateIncrementUntilSpeed(100, 0, 10)).toBe(90);
    });

    it('handles current speed of 0 (start from stop)', () => {
      expect(calculateIncrementUntilSpeed(0, 100, 10)).toBe(10);
    });

    it('handles very small increment with many loops', () => {
      // 100 → 101 with 100 loops: increment = 1/100 = 0.01
      const result = calculateIncrementUntilSpeed(100, 101, 100);
      expect(result).toBeCloseTo(100.01, 4);
    });

    it('handles same direction but already past target (should not happen in practice)', () => {
      // currentSpeed > targetSpeed but loops remain – should still divide the negative diff
      expect(calculateIncrementUntilSpeed(130, 120, 5)).toBe(128);
    });
  });

  describe('simulate full loop sequence (finite)', () => {
    // In v2Script.ts the flow is:
    //   1. loopTimesLeft is decremented
    //   2. calculateIncrementUntilSpeed is called with the new (decremented) value
    //   3. Playback restarts at the new speed
    // So with N total loops, the sequence of loopTimesLeft values passed to
    // the function is: N-1, N-2, …, 1  (the very last loop just stops).

    it('reaches exactly the target speed after 5 total loops', () => {
      let speed = 100;
      const target = 120;
      // After the first decrement: 4, 3, 2, 1
      const remainingSequence = [4, 3, 2, 1];

      for (const loopsLeft of remainingSequence) {
        speed = calculateIncrementUntilSpeed(speed, target, loopsLeft);
      }

      expect(speed).toBe(target);
    });

    it('reaches target with 3 total loops', () => {
      let speed = 80;
      const target = 100;
      // After the first decrement: 2, 1
      const remainingSequence = [2, 1];

      for (const loopsLeft of remainingSequence) {
        speed = calculateIncrementUntilSpeed(speed, target, loopsLeft);
      }

      expect(speed).toBe(target);
    });

    it('reaches target when slowing down over 5 total loops', () => {
      let speed = 150;
      const target = 100;
      // After the first decrement: 4, 3, 2, 1
      const remainingSequence = [4, 3, 2, 1];

      for (const loopsLeft of remainingSequence) {
        speed = calculateIncrementUntilSpeed(speed, target, loopsLeft);
      }

      expect(speed).toBe(target);
    });

    it('reaches target with 2 total loops (single restart)', () => {
      let speed = 100;
      const target = 120;
      // After the first decrement: 1
      speed = calculateIncrementUntilSpeed(speed, target, 1);

      expect(speed).toBe(target);
    });

    it('each loop applies the same increment (constant step)', () => {
      let speed = 100;
      const target = 120;
      const increments: number[] = [];
      const remainingSequence = [4, 3, 2, 1];

      for (const loopsLeft of remainingSequence) {
        const prev = speed;
        speed = calculateIncrementUntilSpeed(speed, target, loopsLeft);
        increments.push(speed - prev);
      }

      // All increments should be exactly 5
      for (const inc of increments) {
        expect(inc).toBe(5);
      }
    });
  });

  describe('simulate loop sequence (infinite)', () => {
    it('increments by +1 each loop and eventually reaches target', () => {
      let speed = 100;
      const target = 105;

      for (let i = 0; i < 5; i++) {
        speed = calculateIncrementUntilSpeed(speed, target, Infinity);
      }

      expect(speed).toBe(target);
    });

    it('decrements by −1 each loop and eventually reaches target', () => {
      let speed = 110;
      const target = 105;

      for (let i = 0; i < 5; i++) {
        speed = calculateIncrementUntilSpeed(speed, target, Infinity);
      }

      expect(speed).toBe(target);
    });
  });
});
