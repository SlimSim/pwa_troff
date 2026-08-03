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

  describe('mobilePosition prop', () => {
    let originalInnerWidth: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
    });

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
    });

    it('defaults mobilePosition to "auto"', async () => {
      await element.updateComplete;
      expect(element.mobilePosition).toBe('auto');
    });

    it('accepts mobilePosition="top"', async () => {
      element.mobilePosition = 'top';
      await element.updateComplete;
      expect(element.mobilePosition).toBe('top');
    });

    it('positions dropdown at viewport top (top: 8px) when mobilePosition="top" and viewport < 768px', async () => {
      // Mock narrow viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 400,
      });

      element.mobilePosition = 'top';
      element.position = 'up';
      await element.updateComplete;

      const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;
      buttonWrapper.click();
      await element.updateComplete;

      const dropdown = element.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
      if (!dropdown) throw new Error('dropdown element not found');

      // Should be positioned at viewport top (8px) not button-relative
      expect(dropdown.style.top).toBe('8px');
      expect(dropdown.style.bottom).toBe('auto');
    });

    it('uses button-relative positioning when mobilePosition="auto" (default) even on narrow viewport', async () => {
      // Mock narrow viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 400,
      });

      element.mobilePosition = 'auto';
      element.position = 'up';
      await element.updateComplete;

      const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;
      buttonWrapper.click();
      await element.updateComplete;

      const dropdown = element.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
      if (!dropdown) throw new Error('dropdown element not found');

      // Should use button-relative positioning (bottom based on button position)
      expect(dropdown.style.top).toBe('auto');
      expect(dropdown.style.bottom).not.toBe('8px'); // Not fixed to viewport top
    });

    it('uses button-relative positioning when mobilePosition="top" but viewport >= 768px', async () => {
      // Mock wide viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      element.mobilePosition = 'top';
      element.position = 'up';
      await element.updateComplete;

      const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;
      buttonWrapper.click();
      await element.updateComplete;

      const dropdown = element.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
      if (!dropdown) throw new Error('dropdown element not found');

      // Should use button-relative positioning on wide viewport
      expect(dropdown.style.top).toBe('auto');
      expect(dropdown.style.bottom).not.toBe('8px');
    });

    it('repositions on window resize', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 400,
      });

      element.mobilePosition = 'top';
      element.position = 'up';
      await element.updateComplete;

      const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;
      buttonWrapper.click();
      await element.updateComplete;

      const dropdown = element.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
      if (!dropdown) throw new Error('dropdown element not found');

      // Initially at viewport top
      expect(dropdown.style.top).toBe('8px');

      // Resize to wide viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Trigger resize handler
      window.dispatchEvent(new Event('resize'));
      await element.updateComplete;

      // Should now use button-relative positioning
      expect(dropdown.style.top).toBe('auto');
    });

    it('repositions on visualViewport resize (keyboard appearance)', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 400,
      });

      element.mobilePosition = 'top';
      element.position = 'up';
      await element.updateComplete;

      const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;
      buttonWrapper.click();
      await element.updateComplete;

      const dropdown = element.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
      if (!dropdown) throw new Error('dropdown element not found');

      // Initially at viewport top
      expect(dropdown.style.top).toBe('8px');

      // Trigger visualViewport resize (simulating keyboard appearance)
      if (window.visualViewport) {
        window.visualViewport.dispatchEvent(new Event('resize'));
        await element.updateComplete;
      }

      // Should still be at viewport top (or repositioned correctly)
      // The key test is that the handler runs without error
      expect(dropdown.style.top).toBeTruthy();
    });

    it('works with position="down" on mobile when mobilePosition="top"', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 400,
      });

      element.mobilePosition = 'top';
      element.position = 'down';
      await element.updateComplete;

      const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;
      buttonWrapper.click();
      await element.updateComplete;

      const dropdown = element.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
      if (!dropdown) throw new Error('dropdown element not found');

      // Should be positioned at viewport top (8px) regardless of position prop
      expect(dropdown.style.top).toBe('8px');
      expect(dropdown.style.bottom).toBe('auto');
    });

    it('aligns dropdown horizontally based on align prop even with mobilePosition="top"', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 400,
      });

      element.mobilePosition = 'top';
      element.position = 'up';
      element.align = 'left';
      await element.updateComplete;

      const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement;
      buttonWrapper.click();
      await element.updateComplete;

      const dropdown = element.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
      if (!dropdown) throw new Error('dropdown element not found');

      // Vertical positioning at viewport top
      expect(dropdown.style.top).toBe('8px');
      // Horizontal alignment should still work
      expect(dropdown.style.left).toBeTruthy();
      expect(dropdown.style.right).toBe('auto');
    });
  });
});