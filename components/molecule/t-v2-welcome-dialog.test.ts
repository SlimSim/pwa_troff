import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { V2WelcomeDialog } from './t-v2-welcome-dialog.js';

/**
 * Tests for <t-v2-welcome-dialog> (new for v2 default rollout).
 *
 * Modeled EXACTLY after t-zoom-info-dialog:
 * - Lit + @customElement + open @property (reflect)
 * - .overlay + .open class for visibility
 * - theme vars (--on-theme-color etc), border-radius from vars
 * - uses <t-butt> only (no native button)
 * - dispatches events (bubbles, composed): no nDB inside component
 * - on continue/close: parent will set pref=2
 * - on switch-back: parent sets pref=1 and redirects
 *
 * NOTE: the component module does NOT exist yet. The import above will fail,
 * making the entire test RED until `components/molecule/t-v2-welcome-dialog.ts`
 * is created (modeled on t-zoom-info-dialog.ts) and registered.
 * This is intentional for RED-first.
 */
describe('t-v2-welcome-dialog', () => {
  let element: V2WelcomeDialog;

  beforeEach(() => {
    element = new V2WelcomeDialog();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  function getButtons(): HTMLElement[] {
    return Array.from(
      element.shadowRoot?.querySelectorAll('t-butt') ?? []
    ) as HTMLElement[];
  }

  function dialogText(): string {
    return element.shadowRoot?.textContent ?? '';
  }

  it('has open property defaulting to false (no overlay visible)', async () => {
    expect(element.open).toBe(false);
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('.overlay.open')).toBeNull();
  });

  it('shows overlay when open=true', async () => {
    element.open = true;
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('.overlay.open')).toBeTruthy();
    const text = dialogText().toLowerCase();
    expect(text).toMatch(/version 2|2\.0/);
    expect(text).toMatch(/always|back|switch/);
  });

  it('uses exactly two <t-butt> buttons, with expected labels (no "just try it out")', async () => {
    element.open = true;
    await element.updateComplete;

    const buttons = getButtons();
    expect(buttons.length).toBe(2);
    const labels = buttons.map((b) => (b.textContent ?? '').trim().toLowerCase());
    expect(labels.some((l) => l.includes('continue') || l.includes('stay'))).toBe(true);
    expect(labels.some((l) => l.includes('use old') || l.includes('old version'))).toBe(true);
    // Must not have a third "just try" button
    expect(labels.join(' ')).not.toMatch(/try it|just try/);
  });

  it('dispatches v2-welcome-continue (or close) and dialog-cancelled on continue action', async () => {
    const continueSpy = vi.fn();
    const cancelledSpy = vi.fn();
    element.addEventListener('v2-welcome-continue', continueSpy);
    element.addEventListener('dialog-cancelled', cancelledSpy);

    element.open = true;
    await element.updateComplete;

    const contBtn = getButtons().find((b) =>
      (b.textContent ?? '').toLowerCase().includes('continue')
    );
    expect(contBtn, 'continue button must exist').toBeTruthy();
    contBtn!.click();
    await element.updateComplete;

    expect(element.open).toBe(false);
    expect(continueSpy).toHaveBeenCalled();
    // close path may also fire cancelled
    expect(cancelledSpy).toHaveBeenCalled();
  });

  it('dispatches v2-welcome-switch-back on the switch button', async () => {
    const switchSpy = vi.fn();
    element.addEventListener('v2-welcome-switch-back', switchSpy);

    element.open = true;
    await element.updateComplete;

    const switchBtn = getButtons().find((b) =>
      (b.textContent ?? '').toLowerCase().includes('old')
    );
    expect(switchBtn, 'switch-back button must exist').toBeTruthy();
    switchBtn!.click();
    await element.updateComplete;

    expect(element.open).toBe(false);
    expect(switchSpy).toHaveBeenCalled();
  });
});
