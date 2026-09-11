import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BottomNav } from './t-footer.js';
import { Dial } from '../atom/t-dial.js';
import { calculateIncrementUntilSpeed } from '../../utils/increment-until.js';

/**
 * Production-faithful repro for: footer's Speed t-dial does not visually
 * update when v2Script sets `footer.speed = newSpeed` during the
 * "increment until" loop restart (v2Script.ts onTimeUpdate, ~line 2812).
 *
 * Differences vs the existing t-footer-speed-dial-update.test.ts (GREEN):
 * - Footer is created via HTML parsing + `document.getElementById('footer')`
 *   (as v2Script.ts:546 does), NOT via `new BottomNav()`.
 * - `loopTimesLeftLabel` + `speed` are set in the SAME synchronous block
 *   with no await between (as onTimeUpdate does, lines 2791-2812), so Lit
 *   batches them into a single footer update.
 * - The speed dropdown stays CLOSED (default `showSpeedDropdown=false`).
 * - Only `footer.updateComplete` is awaited before reading the dial display
 *   synchronously — never `dial.updateComplete` (which could mask the bug by
 *   letting the dial catch up late).
 * - Both the visible `t-icon[name="speed"]` label AND the dial
 *   `.value-content` display are checked, plus the dial's internal `_value`.
 */
describe('t-footer speed dial prod repro (getElementById + batched set, dropdown closed)', () => {
  let footer: BottomNav;

  beforeEach(async () => {
    // Mirror production: footer element comes from parsed HTML and is looked
    // up by id (v2Script.ts:546).
    document.body.innerHTML = '<t-footer id="footer"></t-footer>';
    const el = document.getElementById('footer');
    if (!(el instanceof BottomNav)) {
      throw new Error('t-footer element was not upgraded to BottomNav');
    }
    footer = el;
    // Start at 50% speed so the "increment until" step has somewhere to go.
    footer.speed = 50;
    await footer.updateComplete;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  /** Find the Speed t-dial inside the footer's shadow DOM (fresh lookup). */
  function getSpeedDial(host: BottomNav): Dial {
    const dials = Array.from(host.shadowRoot!.querySelectorAll('t-dial'));
    for (const dial of dials) {
      if ((dial as Dial).label === 'Speed') {
        return dial as Dial;
      }
    }
    throw new Error('Speed t-dial not found in footer shadow DOM');
  }

  function getSpeedIconLabel(host: BottomNav): string | null {
    const icons = Array.from(host.shadowRoot!.querySelectorAll('t-icon'));
    for (const icon of icons) {
      if (icon.getAttribute('name') === 'speed') {
        return icon.getAttribute('label');
      }
    }
    return null;
  }

  it('batched loopTimesLeftLabel + speed update refreshes the dial display after only footer.updateComplete', async () => {
    // Dropdown must stay closed, as in production during loop restart.
    expect(footer.showSpeedDropdown).toBe(false);
    const dropdown = footer.shadowRoot!.querySelector('t-dropdown-button');
    expect(dropdown?.getAttribute('open')).toBeNull();

    // Sanity: initial dial display reflects the 50% setup.
    const dialBefore = getSpeedDial(footer);
    expect(
      dialBefore.shadowRoot?.querySelector('.value-content')?.textContent?.trim()
    ).toBe('50%');

    // Mirror v2Script.ts onTimeUpdate lines 2791-2812 in ONE sync block:
    // decrement loops left -> updateLoopTimesDisplay() -> footer.speed = newSpeed.
    const currentSpeed = 50;
    const targetSpeed = 100;
    const loopTimesLeft = 1; // value AFTER decrement
    const newSpeed = calculateIncrementUntilSpeed(currentSpeed, targetSpeed, loopTimesLeft);
    expect(newSpeed).toBe(100);
    footer.loopTimesLeftLabel = String(loopTimesLeft);
    footer.speed = newSpeed;
    // NOTE: no await between the two sets above, and no dial.updateComplete below.

    await footer.updateComplete;

    // The footer itself re-rendered (t-icon label is the always-visible speed
    // readout when the dropdown is closed).
    expect(getSpeedIconLabel(footer)).toBe('100');

    // The dial display must have followed in the same footer update cycle.
    // Read synchronously: if the binding only lands after an extra dial-level
    // flush, this is exactly the stale display users see.
    const dialAfter = getSpeedDial(footer);
    const displayed = dialAfter.shadowRoot
      ?.querySelector('.value-content')
      ?.textContent?.trim();
    const internal = (dialAfter as unknown as { _value: number })._value;
    expect(internal).toBe(100);
    expect(displayed).toBe('100%');
  });

  it('dropdown-closed dial agrees with t-icon label after a second batched increment', async () => {
    expect(footer.showSpeedDropdown).toBe(false);

    // Simulate two consecutive loop restarts batched without awaits between
    // the label + speed sets of each restart.
    let currentSpeed = 50;
    const targetSpeed = 100;

    currentSpeed = calculateIncrementUntilSpeed(currentSpeed, targetSpeed, 2);
    footer.loopTimesLeftLabel = '2';
    footer.speed = currentSpeed;

    currentSpeed = calculateIncrementUntilSpeed(currentSpeed, targetSpeed, 1);
    footer.loopTimesLeftLabel = '1';
    footer.speed = currentSpeed;

    await footer.updateComplete;

    // Footer re-rendered...
    expect(getSpeedIconLabel(footer)).toBe(`${Math.round(currentSpeed)}`);

    // ...so the closed-dropdown dial must show the same value.
    const dial = getSpeedDial(footer);
    const displayed = dial.shadowRoot
      ?.querySelector('.value-content')
      ?.textContent?.trim();
    const internal = (dial as unknown as { _value: number })._value;
    expect(internal).toBe(currentSpeed);
    expect(displayed).toBe(`${Math.round(currentSpeed)}%`);
  });

  it('back-to-back restarts with fractional speeds land on the final value after one flush', async () => {
    expect(footer.showSpeedDropdown).toBe(false);

    // 50% -> 100% over 3 loops: intermediate speeds are fractional
    // (66.666...), and both restarts fire with no await between them at all —
    // only a single footer.updateComplete at the end. This mirrors rapid
    // successive onTimeUpdate loop restarts collapsing into one Lit update.
    let currentSpeed = 50;
    const targetSpeed = 100;

    currentSpeed = calculateIncrementUntilSpeed(currentSpeed, targetSpeed, 3);
    footer.loopTimesLeftLabel = '3';
    footer.speed = currentSpeed;

    currentSpeed = calculateIncrementUntilSpeed(currentSpeed, targetSpeed, 2);
    footer.loopTimesLeftLabel = '2';
    footer.speed = currentSpeed;

    currentSpeed = calculateIncrementUntilSpeed(currentSpeed, targetSpeed, 1);
    footer.loopTimesLeftLabel = '1';
    footer.speed = currentSpeed;

    await footer.updateComplete;

    // Final speed must be exactly the target.
    expect(currentSpeed).toBe(100);
    expect(getSpeedIconLabel(footer)).toBe('100');

    const dial = getSpeedDial(footer);
    const displayed = dial.shadowRoot
      ?.querySelector('.value-content')
      ?.textContent?.trim();
    const internal = (dial as unknown as { _value: number })._value;
    expect(internal).toBe(100);
    expect(displayed).toBe('100%');
  });

  it('fractional intermediate speed shows in the dial after only footer.updateComplete', async () => {
    expect(footer.showSpeedDropdown).toBe(false);

    // Single restart of a 3-loop ramp: 50 -> 66.666... The dial rounds to one
    // decimal (step=5) while the t-icon rounds to an integer.
    const newSpeed = calculateIncrementUntilSpeed(50, 100, 3);
    expect(newSpeed).toBeCloseTo(66.6667, 3);
    footer.loopTimesLeftLabel = '3';
    footer.speed = newSpeed;

    await footer.updateComplete;

    expect(getSpeedIconLabel(footer)).toBe(`${Math.round(newSpeed)}`);

    const dial = getSpeedDial(footer);
    const displayed = dial.shadowRoot
      ?.querySelector('.value-content')
      ?.textContent?.trim();
    const internal = (dial as unknown as { _value: number })._value;
    expect(internal).toBeCloseTo(66.6667, 3);
    expect(displayed).toBe('66.7%');
  });
});
