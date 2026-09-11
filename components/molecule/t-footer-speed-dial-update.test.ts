import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BottomNav } from './t-footer.js';
import { Dial } from '../atom/t-dial.js';

/**
 * Regression test: the "increment until" feature changes playback speed on each
 * loop restart (v2Script.ts ~line 2783-2806) and pushes the new value into
 * `footer.speed`. The footer then renders `<t-dial .value=${this.speed}>`.
 *
 * The bug: audio.playbackRate changed correctly, but the speed dial didn't
 * visually update because the Lit binding wasn't propagating the property
 * change to the t-dial's `value` setter.
 *
 * These tests verify the actual `t-footer` → `t-dial` integration — no
 * reimplementation of production code.
 */

describe('t-footer speed dial update via footer.speed property', () => {
  let footer: BottomNav;

  beforeEach(() => {
    footer = new BottomNav();
    footer.speed = 50;
    document.body.appendChild(footer);
  });

  afterEach(() => {
    if (document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
  });

  /** Find the speed t-dial inside the footer's shadow DOM. */
  function getSpeedDial(): Dial {
    const dials = Array.from(footer.shadowRoot!.querySelectorAll('t-dial'));
    for (const dial of dials) {
      if ((dial as Dial).label === 'Speed') {
        return dial as Dial;
      }
    }
    throw new Error('Speed t-dial not found in footer shadow DOM');
  }

  it('should render speed dial showing "50%" when footer.speed is 50', async () => {
    await footer.updateComplete;
    const dial = getSpeedDial();
    await dial.updateComplete;

    const display = dial.shadowRoot?.querySelector('.value-content');
    expect(display?.textContent?.trim()).toBe('50%');
  });

  it('should update speed dial to "100%" when footer.speed changes from 50 to 100', async () => {
    await footer.updateComplete;
    const dial = getSpeedDial();
    await dial.updateComplete;

    // Verify starting state
    expect(dial.shadowRoot?.querySelector('.value-content')?.textContent?.trim()).toBe('50%');

    // Simulate v2Script.ts line 2800: footer.speed = newSpeed
    footer.speed = 100;
    await footer.updateComplete;
    await dial.updateComplete;

    const display = dial.shadowRoot?.querySelector('.value-content');
    expect(display?.textContent?.trim()).toBe('100%');
  });

  it('should update speed dial through a sequence: 50 → 75 → 100', async () => {
    await footer.updateComplete;
    const dial = getSpeedDial();
    await dial.updateComplete;

    // Loop 1 ends, speed goes to 75
    footer.speed = 75;
    await footer.updateComplete;
    await dial.updateComplete;
    expect(dial.shadowRoot?.querySelector('.value-content')?.textContent?.trim()).toBe('75%');

    // Loop 2 ends, speed goes to 100
    footer.speed = 100;
    await footer.updateComplete;
    await dial.updateComplete;
    expect(dial.shadowRoot?.querySelector('.value-content')?.textContent?.trim()).toBe('100%');
  });

  it('should update the t-dial internal _value when footer.speed changes', async () => {
    await footer.updateComplete;
    const dial = getSpeedDial();
    await dial.updateComplete;

    // Access internal _value via the same pattern as t-dial.test.ts
    const dialInternal = dial as unknown as { _value: number };
    expect(dialInternal._value).toBe(50);

    footer.speed = 100;
    await footer.updateComplete;
    await dial.updateComplete;

    expect(dialInternal._value).toBe(100);
  });
});

describe('t-footer increment-until integration: 50% → 100% over 2 loops', () => {
  let footer: BottomNav;

  beforeEach(async () => {
    footer = new BottomNav();
    // Start at 50% speed (minimum for t-footer speed dial)
    footer.speed = 50;
    document.body.appendChild(footer);
    await footer.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
  });

  function getSpeedDial(): Dial {
    const dials = Array.from(footer.shadowRoot!.querySelectorAll('t-dial'));
    for (const dial of dials) {
      if ((dial as Dial).label === 'Speed') {
        return dial as Dial;
      }
    }
    throw new Error('Speed t-dial not found');
  }

  it('should reflect the exact v2Script code path: calculateIncrementUntilSpeed → footer.speed = newSpeed → dial updates', async () => {
    // Import the actual utility used by v2Script
    const { calculateIncrementUntilSpeed } = await import('../../utils/increment-until.js');

    const dial = getSpeedDial();
    await dial.updateComplete;

    // Initial state
    expect(dial.shadowRoot?.querySelector('.value-content')?.textContent?.trim()).toBe('50%');

    // Simulate v2Script.ts lines 2783-2806 exactly:
    // 2 loops total, target 100%, current 50%
    // After first loop ends, loopTimesLeft decrements from 2 to 1
    let currentSpeed = footer.speed; // 50
    const targetSpeed = 100;
    let loopTimesLeft = 2;

    // First loop ends — loopTimesLeft decrements
    loopTimesLeft -= 1; // now 1
    const newSpeed = calculateIncrementUntilSpeed(currentSpeed, targetSpeed, loopTimesLeft);
    // This is what v2Script does at line 2800:
    footer.speed = newSpeed;

    await footer.updateComplete;
    await dial.updateComplete;

    // Verify the dial updated visually
    expect(dial.shadowRoot?.querySelector('.value-content')?.textContent?.trim()).toBe(
      `${Math.round(newSpeed)}%`
    );
    expect(newSpeed).toBe(100); // 50 + (100-50)/1 = 100
  });
});
