import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ZoomInfoDialog } from './t-zoom-info-dialog.js';

/**
 * Tests for <t-zoom-info-dialog> (v2 port of the v1 #zoomInstructionDialog).
 *
 * Pure UI component following the t-text-input-dialog overlay pattern:
 * `open` boolean property, explanatory text, OK + Don't-show-again <t-butt>
 * buttons, results reported via events (no nDB / no Firebase imports —
 * persistence is the parent's job).
 *
 * NOTE: This module does NOT exist yet. Importing it fails, which makes every
 * test in this file RED until the component is created. That is intentional.
 */
describe('t-zoom-info-dialog', () => {
  let element: ZoomInfoDialog;

  beforeEach(() => {
    element = new ZoomInfoDialog();
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

  it('overlay is not visible (no .open class) when open is false', async () => {
    element.open = false;
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.overlay.open')).toBeNull();
  });

  it('renders the zoom explanation when open', async () => {
    element.open = true;
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.overlay.open')).toBeTruthy();
    const text = dialogText().replace(/\s+/g, ' ');
    // v1 sentence must be preserved verbatim (whitespace-normalized).
    expect(text).toContain(
      "When you press zoom, or 'Z', Troff will zoom to the active playing region, or the purple part of the timeline."
    );
    // Must additionally explain scroll / ctrl+scroll / pinch gestures.
    expect(text.toLowerCase()).toContain('scroll');
    expect(text.toLowerCase()).toMatch(/ctrl|cmd/);
    expect(text.toLowerCase()).toContain('pinch');
  });

  it('uses <t-butt> buttons (OK + Don\'t show again), not native <button>', async () => {
    element.open = true;
    await element.updateComplete;

    const buttons = getButtons();
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    const labels = buttons.map((b) => (b.textContent ?? '').toLowerCase());
    expect(labels.some((l) => l.includes('ok'))).toBe(true);
    expect(labels.some((l) => l.includes("don't show again"))).toBe(true);
  });

  it('OK dismisses and reports dontShowAgain:false', async () => {
    const closed = vi.fn();
    const cancelled = vi.fn();
    element.addEventListener('zoom-info-closed', closed);
    element.addEventListener('dialog-cancelled', cancelled);

    element.open = true;
    await element.updateComplete;

    const okBtn =
      getButtons().find((b) =>
        (b.textContent ?? '').toLowerCase().includes('ok')
      ) ??
      getButtons().find(
        (b) => !(b.textContent ?? '').toLowerCase().includes("don't show")
      );
    expect(okBtn, 'OK button should be present').toBeTruthy();
    okBtn!.click();
    await element.updateComplete;

    expect(element.open).toBe(false);
    expect(closed.mock.calls.length + cancelled.mock.calls.length).toBeGreaterThanOrEqual(
      1
    );
    if (closed.mock.calls.length > 0) {
      expect((closed.mock.calls[0][0] as CustomEvent).detail).toEqual({
        dontShowAgain: false,
      });
    }
  });

  it("Don't show again dismisses and reports dontShowAgain:true", async () => {
    const closed = vi.fn();
    element.addEventListener('zoom-info-closed', closed);

    element.open = true;
    await element.updateComplete;

    const dontShowBtn = getButtons().find((b) =>
      (b.textContent ?? '').toLowerCase().includes("don't show again")
    );
    expect(dontShowBtn, "Don't show again button should be present").toBeTruthy();
    dontShowBtn!.click();
    await element.updateComplete;

    expect(element.open).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);
    expect((closed.mock.calls[0][0] as CustomEvent).detail).toEqual({
      dontShowAgain: true,
    });
  });
});
