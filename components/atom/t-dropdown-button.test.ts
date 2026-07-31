import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DropdownButton } from './t-dropdown-button.js';

describe('t-dropdown-button', () => {
  let element: DropdownButton;

  beforeEach(() => {
    element = new DropdownButton();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('initially has open property set to false', async () => {
    await element.updateComplete;
    expect(element.open).toBe(false);
  });

  it('toggles open to true when button is clicked', async () => {
    await element.updateComplete;

    const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;
    expect(buttonWrapper).toBeTruthy();

    buttonWrapper.click();
    await element.updateComplete;

    expect(element.open).toBe(true);
  });

  it('toggles open back to false when button is clicked again', async () => {
    await element.updateComplete;

    const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;

    // Open the dropdown
    buttonWrapper.click();
    await element.updateComplete;
    expect(element.open).toBe(true);

    // Close the dropdown
    buttonWrapper.click();
    await element.updateComplete;
    expect(element.open).toBe(false);
  });

  it('dispatches dropdown-toggled event with correct detail on open', async () => {
    const toggleSpy = vi.fn();
    element.addEventListener('dropdown-toggled', toggleSpy);

    await element.updateComplete;

    const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;
    buttonWrapper.click();
    await element.updateComplete;

    expect(toggleSpy).toHaveBeenCalledTimes(1);
    const event = toggleSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.open).toBe(true);
  });

  it('dispatches dropdown-toggled event with correct detail on close', async () => {
    await element.updateComplete;
    const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;

    // Open
    buttonWrapper.click();
    await element.updateComplete;

    // Close
    const toggleSpy = vi.fn();
    element.addEventListener('dropdown-toggled', toggleSpy);
    buttonWrapper.click();
    await element.updateComplete;

    expect(toggleSpy).toHaveBeenCalledTimes(1);
    const event = toggleSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.open).toBe(false);
  });

  // Closed dropdown panel is position:fixed with no inline offsets, so it sits at its
  // static position inside the host (a flex header in t-media-parent) and extends
  // ~160-180px rightward — invisible but still rendered, creating horizontal scroll
  // overflow on small screens. display: none removes it entirely.
  it('closed dropdown has display: none (no layout contribution when invisible)', async () => {
    await element.updateComplete;

    const dropdown = element.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
    if (!dropdown) throw new Error('dropdown element not found');

    expect(getComputedStyle(dropdown).display).toBe('none');
  });

  it('open dropdown is displayed (display is not none)', async () => {
    await element.updateComplete;

    const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;
    buttonWrapper.click();
    await element.updateComplete;

    expect(element.open).toBe(true);

    const dropdown = element.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
    if (!dropdown) throw new Error('dropdown element not found');

    expect(getComputedStyle(dropdown).display).not.toBe('none');
  });

  it('closing the dropdown restores display: none', async () => {
    await element.updateComplete;

    const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;

    // Open the dropdown
    buttonWrapper.click();
    await element.updateComplete;
    expect(element.open).toBe(true);

    // Close the dropdown
    buttonWrapper.click();
    await element.updateComplete;
    expect(element.open).toBe(false);

    const dropdown = element.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
    if (!dropdown) throw new Error('dropdown element not found');

    expect(getComputedStyle(dropdown).display).toBe('none');
  });
});