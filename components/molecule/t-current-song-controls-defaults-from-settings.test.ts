import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CurrentSongControls } from './t-current-song-controls.js';
import { Dial } from '../atom/t-dial.js';

/**
 * FEATURE SPEC: t-current-song-controls dial reset targets must come from
 * Settings → "Default Song Values" (persisted in nDB), not hardcoded attributes.
 *
 * Today t-current-song-controls.ts renders its t-dials with hardcoded
 * `defaultValue="4"` (start before), `"2"` (stop after), `"3"` (pause before),
 * `"1"` (wait between), `"75"` (volume), `"100"` (speed / increment until).
 * The feature adds reactive `default*Value` number properties
 * (defaultVolumeValue = 75, defaultSpeedValue = 100, defaultPauseBeforeValue = 3,
 * defaultStartBeforeValue = 4, ...) that v2Script's syncCurrentSongControlsValues()
 * fills from nDB, and the dials bind `.defaultValue=${this.default...}`.
 *
 * These tests import the REAL component class (never re-implement) and are RED
 * while the properties/bindings do not exist: setting an undeclared property
 * does not re-render, so the dials keep their hardcoded reset targets.
 */

type ControlsWithDefaultValues = CurrentSongControls & {
  defaultStartBeforeValue: number;
  defaultStopAfterValue: number;
  defaultPauseBeforeValue: number;
  defaultWaitBetweenValue: number;
  defaultIncrementUntilValue: number;
  defaultVolumeValue: number;
  defaultSpeedValue: number;
};

function withDefaults(controls: CurrentSongControls): ControlsWithDefaultValues {
  return controls as ControlsWithDefaultValues;
}

/** Find a t-dial inside the controls' shadow root by its label property. */
function findDial(shadowRoot: ShadowRoot | null, label: string): Dial {
  const dials = Array.from(shadowRoot?.querySelectorAll('t-dial') ?? []) as Dial[];
  const dial = dials.find((candidate) => candidate.label === label);
  if (!dial) {
    throw new Error(`t-dial with label "${label}" not found`);
  }
  return dial;
}

function getResetText(dial: Dial): string {
  const resetText = dial.shadowRoot?.querySelector('.reset-text');
  if (!resetText) {
    throw new Error(`no .reset-text found for dial "${dial.label}" (defaultValue not set?)`);
  }
  return (resetText.textContent ?? '').trim();
}

describe('t-current-song-controls default values from Settings → Default Song Values', () => {
  let controls: CurrentSongControls;

  beforeEach(async () => {
    controls = new CurrentSongControls();
    document.body.appendChild(controls);
    await controls.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(controls)) {
      document.body.removeChild(controls);
    }
  });

  it('dials have the hardcoded-equivalent defaultValue baselines (75 / 100 / 3 / 4)', async () => {
    const volumeDial = findDial(controls.shadowRoot, 'Volume');
    const speedDial = findDial(controls.shadowRoot, 'Speed');
    const pauseDial = findDial(controls.shadowRoot, 'Pause before');
    const startDial = findDial(controls.shadowRoot, 'Start before');
    await Promise.all([
      volumeDial.updateComplete,
      speedDial.updateComplete,
      pauseDial.updateComplete,
      startDial.updateComplete,
    ]);

    expect(volumeDial.defaultValue).toBe(75);
    expect(speedDial.defaultValue).toBe(100);
    expect(pauseDial.defaultValue).toBe(3);
    expect(startDial.defaultValue).toBe(4);
  });

  it('exposes default*Value properties with settings defaults (75 / 100 / 3 / 4)', () => {
    // These are the new @property values the reset buttons must read from.
    expect(withDefaults(controls).defaultVolumeValue).toBe(75);
    expect(withDefaults(controls).defaultSpeedValue).toBe(100);
    expect(withDefaults(controls).defaultPauseBeforeValue).toBe(3);
    expect(withDefaults(controls).defaultStartBeforeValue).toBe(4);
  });

  it('setting defaultVolumeValue = 50 moves the volume dial reset target to 50', async () => {
    const volumeDial = findDial(controls.shadowRoot, 'Volume');
    await volumeDial.updateComplete;
    expect(volumeDial.defaultValue).toBe(75);

    withDefaults(controls).defaultVolumeValue = 50;
    await controls.updateComplete;
    await volumeDial.updateComplete;

    expect(volumeDial.defaultValue).toBe(50);
    expect(getResetText(volumeDial)).toBe('50');
  });

  it('setting defaultSpeedValue = 125 moves the speed dial reset target to 125', async () => {
    const speedDial = findDial(controls.shadowRoot, 'Speed');
    await speedDial.updateComplete;
    expect(speedDial.defaultValue).toBe(100);

    withDefaults(controls).defaultSpeedValue = 125;
    await controls.updateComplete;
    await speedDial.updateComplete;

    expect(speedDial.defaultValue).toBe(125);
    expect(getResetText(speedDial)).toBe('125%');
  });

  it('setting defaultPauseBeforeValue = 6 moves the pause-before dial reset target to 6', async () => {
    const pauseDial = findDial(controls.shadowRoot, 'Pause before');
    await pauseDial.updateComplete;
    expect(pauseDial.defaultValue).toBe(3);

    withDefaults(controls).defaultPauseBeforeValue = 6;
    await controls.updateComplete;
    await pauseDial.updateComplete;

    expect(pauseDial.defaultValue).toBe(6);
    expect(getResetText(pauseDial)).toBe('6s');
  });

  it('setting defaultStartBeforeValue = 9 moves the start-before dial reset target to 9', async () => {
    const startDial = findDial(controls.shadowRoot, 'Start before');
    await startDial.updateComplete;
    expect(startDial.defaultValue).toBe(4);

    withDefaults(controls).defaultStartBeforeValue = 9;
    await controls.updateComplete;
    await startDial.updateComplete;

    expect(startDial.defaultValue).toBe(9);
    expect(getResetText(startDial)).toBe('9s');
  });
});
