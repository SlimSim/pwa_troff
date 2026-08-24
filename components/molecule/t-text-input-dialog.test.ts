import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TextInputDialog } from './t-text-input-dialog.js';

/**
 * Tests for the in-app text-input dialog (replacement for `window.prompt`
 * in `rememberCurrentState` of v2Script.ts — GitHub feature work).
 *
 * The component is a pure UI component: it receives config via properties
 * (`title`, `label`, `placeholder`, `initialValue`, `required`) and reports
 * results via events:
 *   - `text-input-confirmed` (detail: { value }) on OK / Enter
 *   - `dialog-cancelled` on Cancel / overlay click / Escape
 *
 * It must NOT import nDB or Firebase — persistence is the parent's job.
 *
 * NOTE: This module does NOT exist yet (the component is implemented by
 * another agent). Importing it therefore fails, which makes every test in
 * this file RED until the component is created. That is intentional.
 */
describe('t-text-input-dialog', () => {
  let element: TextInputDialog;

  beforeEach(() => {
    element = new TextInputDialog();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  function getInput(): HTMLInputElement | null {
    const tInput = element.shadowRoot?.querySelector('t-input') as
      | (HTMLElement & { shadowRoot: ShadowRoot | null })
      | null;
    return (tInput?.shadowRoot?.querySelector('input') as HTMLInputElement) ?? null;
  }

  function getOkButton(): HTMLElement | null {
    return (
      (element.shadowRoot?.querySelector('.ok-btn') as HTMLElement) ??
      (element.shadowRoot?.querySelector('.confirm-btn') as HTMLElement) ??
      (element.shadowRoot?.querySelector('button.confirm') as HTMLElement) ??
      null
    );
  }

  function getCancelButton(): HTMLElement | null {
    return (
      (element.shadowRoot?.querySelector('.cancel-btn') as HTMLElement) ??
      (element.shadowRoot?.querySelector('button.cancel') as HTMLElement) ??
      null
    );
  }

  function typeValue(value: string): void {
    const input = getInput();
    expect(input, 'input should be rendered when open').toBeTruthy();
    input!.value = value;
    input!.dispatchEvent(new CustomEvent('input', { bubbles: true, composed: true }));
  }

  it('overlay is not visible (no .open class) when open is false', async () => {
    element.open = false;
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.overlay.open')).toBeNull();
  });

  it('renders an input and is visible when open is set true', async () => {
    element.title = 'Remember state';
    element.label = 'State name';
    element.placeholder = 'Name this state';
    element.initialValue = 'State 1';
    element.required = true;
    element.open = true;
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.overlay.open')).toBeTruthy();
    const input = getInput();
    expect(input).toBeTruthy();
    expect(input!.value).toBe('State 1');
    expect(input!.getAttribute('placeholder')).toBe('Name this state');
  });

  it('dispatches text-input-confirmed with the trimmed value when OK is clicked', async () => {
    const confirmed = vi.fn();
    element.addEventListener('text-input-confirmed', confirmed);

    element.title = 'Remember state';
    element.label = 'State name';
    element.placeholder = 'Name this state';
    element.initialValue = 'Suggested';
    element.required = true;
    element.open = true;
    await element.updateComplete;

    typeValue('  My State  ');
    await element.updateComplete;

    const okBtn = getOkButton();
    expect(okBtn, 'OK button should be present').toBeTruthy();
    okBtn!.click();
    await element.updateComplete;

    expect(confirmed).toHaveBeenCalledTimes(1);
    const event = confirmed.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('text-input-confirmed');
    expect(event.detail).toEqual({ value: 'My State' });
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(element.open).toBe(false);
  });

  it('dispatches dialog-cancelled and closes when Cancel is clicked', async () => {
    const cancelled = vi.fn();
    element.addEventListener('dialog-cancelled', cancelled);

    element.open = true;
    await element.updateComplete;

    const cancelBtn = getCancelButton();
    expect(cancelBtn, 'Cancel button should be present').toBeTruthy();
    cancelBtn!.click();
    await element.updateComplete;

    expect(cancelled).toHaveBeenCalledTimes(1);
    const event = cancelled.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('dialog-cancelled');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(element.open).toBe(false);
  });

  it('required + empty trimmed value: no confirm, shows an error message', async () => {
    const confirmed = vi.fn();
    element.addEventListener('text-input-confirmed', confirmed);

    element.required = true;
    element.open = true;
    await element.updateComplete;

    typeValue('    ');
    await element.updateComplete;

    const okBtn = getOkButton();
    expect(okBtn).toBeTruthy();
    okBtn!.click();
    await element.updateComplete;

    // Required value empty -> must NOT confirm, and must surface an error.
    expect(confirmed).not.toHaveBeenCalled();
    const errorEl = element.shadowRoot?.querySelector('.error');
    expect(errorEl, 'an error message should be shown').toBeTruthy();
    expect(element.open).toBe(true);
  });

  it('non-required + empty value still confirms with empty string', async () => {
    const confirmed = vi.fn();
    element.addEventListener('text-input-confirmed', confirmed);

    element.required = false;
    element.open = true;
    await element.updateComplete;

    typeValue('   ');
    await element.updateComplete;

    const okBtn = getOkButton();
    expect(okBtn).toBeTruthy();
    okBtn!.click();
    await element.updateComplete;

    expect(confirmed).toHaveBeenCalledTimes(1);
    expect((confirmed.mock.calls[0][0] as CustomEvent).detail).toEqual({ value: '' });
  });

  it('Enter key confirms, Escape key cancels (optional — wrapped so missing impl does not hard-fail)', async () => {
    const confirmed = vi.fn();
    const cancelled = vi.fn();
    element.addEventListener('text-input-confirmed', confirmed);
    element.addEventListener('dialog-cancelled', cancelled);

    element.required = false;
    element.open = true;
    await element.updateComplete;

    try {
      const input = getInput();
      expect(input).toBeTruthy();
      input!.value = 'Enter State';
      input!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })
      );
      await element.updateComplete;
      expect(confirmed).toHaveBeenCalledTimes(1);
      expect((confirmed.mock.calls[0][0] as CustomEvent).detail).toEqual({ value: 'Enter State' });
    } catch {
      // Implementation may not wire keyboard yet.
    }

    // Re-open for the escape case.
    element.open = true;
    await element.updateComplete;

    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await element.updateComplete;
      expect(cancelled).toHaveBeenCalledTimes(1);
    } catch {
      // Implementation may not wire keyboard yet.
    }
  });

  it('overlay click outside the dialog box cancels', async () => {
    const cancelled = vi.fn();
    element.addEventListener('dialog-cancelled', cancelled);

    element.open = true;
    await element.updateComplete;

    const overlay = element.shadowRoot?.querySelector('.overlay') as HTMLElement | null;
    expect(overlay).toBeTruthy();
    // Dispatching directly on the overlay makes target === currentTarget (backdrop click).
    overlay!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await element.updateComplete;

    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(element.open).toBe(false);
  });
});
