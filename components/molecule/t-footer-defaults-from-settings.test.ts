import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BottomNav } from './t-footer.js';
import { Dial } from '../atom/t-dial.js';

/**
 * FEATURE SPEC: t-footer dial reset targets must come from
 * Settings → "Default Song Values" (persisted in nDB), not hardcoded attributes.
 *
 * Today t-footer.ts renders its t-dials with hardcoded `defaultValue="75"` /
 * `defaultValue="100"` / `defaultValue="3"` etc. The feature adds reactive
 * `default*Value` number properties (defaultVolumeValue = 75,
 * defaultSpeedValue = 100, defaultPauseBeforeValue = 3, ...) that
 * updateFooterWithCurrentSong() fills from nDB, and the dials bind
 * `.defaultValue=${this.default...}` instead.
 *
 * These tests import the REAL component classes (never re-implement) and are
 * RED while the properties/bindings do not exist: setting an undeclared
 * property on the footer does not re-render, so the dial keeps its hardcoded
 * reset target.
 */

type FooterWithDefaultValues = BottomNav & {
  defaultVolumeValue: number;
  defaultSpeedValue: number;
  defaultPauseBeforeValue: number;
  defaultWaitBetweenValue: number;
  defaultIncrementUntilValue: number;
};

function withDefaults(footer: BottomNav): FooterWithDefaultValues {
  return footer as FooterWithDefaultValues;
}

/** Find a t-dial inside a shadow root by its label property. */
function findDial(shadowRoot: ShadowRoot | null, label: string): Dial {
  const dials = Array.from(shadowRoot?.querySelectorAll('t-dial') ?? []) as Dial[];
  const dial = dials.find((candidate) => candidate.label === label);
  if (!dial) {
    throw new Error(`t-dial with label "${label}" not found`);
  }
  return dial;
}

/** The reset-to-default t-butt (contains .reset-text with `${defaultValue}${unit}`). */
function getResetButton(dial: Dial): HTMLElement {
  const resetText = dial.shadowRoot?.querySelector('.reset-text');
  if (!resetText) {
    throw new Error(`no .reset-text found for dial "${dial.label}" (defaultValue not set?)`);
  }
  const button = resetText.closest('t-butt');
  if (!button) {
    throw new Error('.reset-text is not inside a t-butt');
  }
  return button as HTMLElement;
}

function getResetText(dial: Dial): string {
  return (dial.shadowRoot?.querySelector('.reset-text')?.textContent ?? '').trim();
}

function clickReset(dial: Dial): void {
  const resetButton = getResetButton(dial);
  const innerButton = resetButton.shadowRoot?.querySelector('button');
  (innerButton ?? resetButton).click();
}

describe('t-footer default values from Settings → Default Song Values', () => {
  let footer: BottomNav;

  beforeEach(async () => {
    footer = new BottomNav();
    document.body.appendChild(footer);
    await footer.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
  });

  it('volume dial has defaultValue 75 by default (baseline behaviour)', async () => {
    const volumeDial = findDial(footer.shadowRoot, 'Volume');
    await volumeDial.updateComplete;

    expect(volumeDial.defaultValue).toBe(75);
  });

  it('exposes defaultVolumeValue / defaultSpeedValue / defaultPauseBeforeValue with settings defaults (75 / 100 / 3)', () => {
    // These are the new @property values the reset buttons must read from.
    expect(withDefaults(footer).defaultVolumeValue).toBe(75);
    expect(withDefaults(footer).defaultSpeedValue).toBe(100);
    expect(withDefaults(footer).defaultPauseBeforeValue).toBe(3);
  });

  it('setting defaultVolumeValue = 50 moves the volume dial reset target to 50', async () => {
    const volumeDial = findDial(footer.shadowRoot, 'Volume');
    await volumeDial.updateComplete;
    expect(volumeDial.defaultValue).toBe(75);

    withDefaults(footer).defaultVolumeValue = 50;
    await footer.updateComplete;
    await volumeDial.updateComplete;

    expect(volumeDial.defaultValue).toBe(50);
    expect(getResetText(volumeDial)).toBe('50');
  });

  it('clicking the volume reset button reverts the dial to defaultVolumeValue', async () => {
    const volumeDial = findDial(footer.shadowRoot, 'Volume');
    await volumeDial.updateComplete;

    // Move the dial away from the reset target first.
    footer.volume = 30;
    withDefaults(footer).defaultVolumeValue = 50;
    await footer.updateComplete;
    await volumeDial.updateComplete;
    expect(volumeDial.value).toBe(30);

    const volumeEvents: CustomEvent<{ volume: number }>[] = [];
    footer.addEventListener('volume-changed', (event) => {
      volumeEvents.push(event as CustomEvent<{ volume: number }>);
    });

    clickReset(volumeDial);

    expect(volumeEvents.length).toBeGreaterThan(0);
    expect(volumeEvents[0].detail.volume).toBe(50);
    expect(volumeDial.value).toBe(50);
    expect(footer.volume).toBe(50);
  });

  it('setting defaultSpeedValue = 125 moves the speed dial reset target to 125', async () => {
    const speedDial = findDial(footer.shadowRoot, 'Speed');
    await speedDial.updateComplete;
    expect(speedDial.defaultValue).toBe(100);

    withDefaults(footer).defaultSpeedValue = 125;
    await footer.updateComplete;
    await speedDial.updateComplete;

    expect(speedDial.defaultValue).toBe(125);
    expect(getResetText(speedDial)).toBe('125%');
  });

  it('setting defaultPauseBeforeValue = 6 moves the pause-before dial reset target to 6', async () => {
    const pauseDial = findDial(footer.shadowRoot, 'Pause before');
    await pauseDial.updateComplete;
    expect(pauseDial.defaultValue).toBe(3);

    withDefaults(footer).defaultPauseBeforeValue = 6;
    await footer.updateComplete;
    await pauseDial.updateComplete;

    expect(pauseDial.defaultValue).toBe(6);
    expect(getResetText(pauseDial)).toBe('6s');
  });
});
