/**
 * Calculate the next playback speed for the "increment until" feature.
 *
 * When a loop restarts, this function determines what the new speed should be
 * so that playback gradually ramps toward `targetSpeed`:
 *
 * - **Infinite loops**: increments by +1 (or −1 when slowing down) each loop
 *   until the target is reached, then stays constant.
 * - **Finite loops**: divides the remaining speed difference evenly across the
 *   remaining loops, reaching the target exactly on the last loop.
 * - **Already at target**: returns the current speed unchanged.
 *
 * @param currentSpeed  Current playback speed as a percentage (e.g. 100 for 1×).
 * @param targetSpeed   Desired final speed as a percentage (e.g. 120 for 1.2×).
 * @param loopTimesLeft Number of loops remaining **after** the current one
 *                      finishes (i.e. the value in `v2Script.ts` after the
 *                      decrement). Pass `Infinity` for infinite loops.
 * @returns The new speed percentage to apply before the next loop starts.
 */
export function calculateIncrementUntilSpeed(
  currentSpeed: number,
  targetSpeed: number,
  loopTimesLeft: number | Infinity
): number {
  if (currentSpeed === targetSpeed) {
    return currentSpeed;
  }

  if (!Number.isFinite(loopTimesLeft)) {
    // Infinite loops: nudge by ±1 each time
    return currentSpeed + (targetSpeed > currentSpeed ? 1 : -1);
  }

  // Finite loops: divide remaining difference evenly across remaining loops
  if (loopTimesLeft <= 0) {
    return currentSpeed;
  }

  return currentSpeed + (targetSpeed - currentSpeed) / loopTimesLeft;
}
