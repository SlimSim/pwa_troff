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

      // Should use button-relative positioning (top computed from button position)
      expect(dropdown.style.top).toMatch(/-?\d+px$/);
      expect(dropdown.style.bottom).toBe('auto'); // Not fixed to viewport top
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
      expect(dropdown.style.top).toMatch(/-?\d+px$/);
      expect(dropdown.style.bottom).toBe('auto');
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

      // Should now use button-relative positioning (top computed from button position)
      expect(dropdown.style.top).toMatch(/-?\d+px$/);
      expect(dropdown.style.bottom).toBe('auto');
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

    it('centers the dropdown horizontally on mobile even with mobilePosition="top"', async () => {
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
      const dropdown = element.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      // Mock the wrapper rect and dropdown width so the centered position is
      // well-defined (this block otherwise relies on happy-dom's zero rects).
      vi.spyOn(buttonWrapper, 'getBoundingClientRect').mockReturnValue({
        x: 50,
        y: 100,
        top: 100,
        right: 90,
        bottom: 135,
        left: 50,
        width: 40,
        height: 35,
        toJSON: () => ({}),
      });
      Object.defineProperty(dropdown, 'offsetWidth', {
        configurable: true,
        value: 200,
      });

      buttonWrapper.click();
      await element.updateComplete;

      // Vertical positioning at viewport top
      expect(dropdown.style.top).toBe('8px');
      // Centered on the 400px-wide screen: (400 - 200) / 2 = 100. The align
      // prop no longer affects horizontal position in mobile-top mode (CURRENT
      // code gives the trigger left edge 50px).
      expect(dropdown.style.left).toBe('100px');
      expect(dropdown.style.right).toBe('auto');
      vi.restoreAllMocks();
    });
  });

  describe('mobilePosition="top" centers the dropdown on the mobile screen', () => {
    let originalInnerWidth: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 400,
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
      vi.restoreAllMocks();
    });

    /**
     * Mocks the metrics computePopupPosition consumes: the button-wrapper
     * getBoundingClientRect() and the dropdown's offsetWidth/offsetHeight
     * (0 by default in happy-dom). Same shape as the popover-style helper.
     */
    function mockMetrics(
      wrapper: HTMLElement,
      dropdown: HTMLElement,
      rect: {
        top: number;
        bottom: number;
        left: number;
        right: number;
        width: number;
        height: number;
      },
      popupWidth: number,
      popupHeight: number
    ) {
      vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
        x: rect.left,
        y: rect.top,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        toJSON: () => ({}),
      });
      Object.defineProperty(dropdown, 'offsetWidth', {
        configurable: true,
        value: popupWidth,
      });
      Object.defineProperty(dropdown, 'offsetHeight', {
        configurable: true,
        value: popupHeight,
      });
    }

    it('centers the dropdown horizontally on the mobile screen (default align "right")', async () => {
      element.mobilePosition = 'top';
      await element.updateComplete;

      const buttonWrapper = element.shadowRoot?.querySelector(
        '.button-wrapper'
      ) as HTMLElement;
      const dropdown = element.shadowRoot?.querySelector(
        '.dropdown'
      ) as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      mockMetrics(
        buttonWrapper,
        dropdown,
        { top: 100, bottom: 135, left: 50, right: 90, width: 40, height: 35 },
        200,
        100
      );

      buttonWrapper.click();
      await element.updateComplete;

      // Centered on the 400px-wide screen: (400 - 200) / 2 = 100. CURRENT code
      // uses align 'right': trigger right edge 90 - 200 = -110 → clamped to the
      // 8px margin.
      expect(dropdown.style.left).toBe('100px');
      expect(dropdown.style.top).toBe('8px');
      expect(dropdown.style.bottom).toBe('auto');
      expect(dropdown.style.right).toBe('auto');
    });

    it('centers the dropdown horizontally regardless of the align prop ("left")', async () => {
      element.mobilePosition = 'top';
      element.align = 'left';
      await element.updateComplete;

      const buttonWrapper = element.shadowRoot?.querySelector(
        '.button-wrapper'
      ) as HTMLElement;
      const dropdown = element.shadowRoot?.querySelector(
        '.dropdown'
      ) as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      mockMetrics(
        buttonWrapper,
        dropdown,
        { top: 100, bottom: 135, left: 50, right: 90, width: 40, height: 35 },
        200,
        100
      );

      buttonWrapper.click();
      await element.updateComplete;

      // Centered (400 - 200) / 2 = 100, NOT the trigger left edge (50) that
      // align='left' produces in the CURRENT code.
      expect(dropdown.style.left).toBe('100px');
      expect(dropdown.style.top).toBe('8px');
      expect(dropdown.style.bottom).toBe('auto');
      expect(dropdown.style.right).toBe('auto');
    });

    it('still compensates a transformed containing block (dropRect origin)', async () => {
      element.mobilePosition = 'top';
      await element.updateComplete;

      const buttonWrapper = element.shadowRoot?.querySelector(
        '.button-wrapper'
      ) as HTMLElement;
      const dropdown = element.shadowRoot?.querySelector(
        '.dropdown'
      ) as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      mockMetrics(
        buttonWrapper,
        dropdown,
        { top: 100, bottom: 135, left: 50, right: 90, width: 40, height: 35 },
        200,
        100
      );
      // Transformed ancestor shifts the fixed dropdown's origin down 60 and
      // right 40 in viewport coordinates (where it sits at top:0/left:0).
      vi.spyOn(dropdown, 'getBoundingClientRect').mockReturnValue({
        x: 40,
        y: 60,
        top: 60,
        right: 240,
        bottom: 160,
        left: 40,
        width: 200,
        height: 100,
        toJSON: () => ({}),
      });

      buttonWrapper.click();
      await element.updateComplete;

      // Centered left 100 minus the containing-block origin left 40 = 60.
      // CURRENT code clamps to the margin first: 8 - 40 = -32.
      expect(dropdown.style.left).toBe('60px');
      // top stays hardcoded '8px' in the mobile-top branch (no dropRect.top
      // compensation) — asserted so the centering change does not alter it.
      expect(dropdown.style.top).toBe('8px');
      expect(dropdown.style.bottom).toBe('auto');
      expect(dropdown.style.right).toBe('auto');
    });

    it('clamps the centered left to the viewport margin when the dropdown is wider than the screen', async () => {
      element.mobilePosition = 'top';
      element.align = 'left';
      await element.updateComplete;

      const buttonWrapper = element.shadowRoot?.querySelector(
        '.button-wrapper'
      ) as HTMLElement;
      const dropdown = element.shadowRoot?.querySelector(
        '.dropdown'
      ) as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      mockMetrics(
        buttonWrapper,
        dropdown,
        { top: 100, bottom: 135, left: 50, right: 90, width: 40, height: 35 },
        500,
        100
      );

      buttonWrapper.click();
      await element.updateComplete;

      // Centered (400 - 500) / 2 = -50 → clamped to the 8px viewport margin.
      // NOTE: this assertion also passes against the CURRENT code — the shared
      // clamp Math.max(8, Math.min(x, viewportWidth - popupWidth - 8)) already
      // pins any popup wider than the viewport to 8 regardless of align — so
      // this test is GREEN and documents the unchanged margin behavior.
      expect(dropdown.style.left).toBe('8px');
      expect(dropdown.style.top).toBe('8px');
      expect(dropdown.style.right).toBe('auto');
    });
  });

  describe('popover-style positioning', () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1000,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: originalInnerHeight,
      });
      vi.restoreAllMocks();
    });

    /**
     * Mocks the metrics computePopupPosition consumes: the button-wrapper
     * getBoundingClientRect() and the dropdown's offsetWidth/offsetHeight
     * (0 by default in happy-dom).
     */
    function mockMetrics(
      wrapper: HTMLElement,
      dropdown: HTMLElement,
      rect: {
        top: number;
        bottom: number;
        left: number;
        right: number;
        width: number;
        height: number;
      },
      popupWidth: number,
      popupHeight: number
    ) {
      vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
        x: rect.left,
        y: rect.top,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        toJSON: () => ({}),
      });
      Object.defineProperty(dropdown, 'offsetWidth', {
        configurable: true,
        value: popupWidth,
      });
      Object.defineProperty(dropdown, 'offsetHeight', {
        configurable: true,
        value: popupHeight,
      });
    }

    it('positions an open dropdown via top+left from computePopupPosition', async () => {
      await element.updateComplete;
      const buttonWrapper = element.shadowRoot?.querySelector(
        '.button-wrapper'
      ) as HTMLElement;
      const dropdown = element.shadowRoot?.querySelector(
        '.dropdown'
      ) as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      mockMetrics(
        buttonWrapper,
        dropdown,
        { top: 100, bottom: 135, left: 50, right: 90, width: 40, height: 35 },
        200,
        100
      );

      buttonWrapper.click();
      await element.updateComplete;

      // position 'down' + align 'right' (defaults): spaceBelow = 800-135-4 = 661
      // fits → top = 135+4 = 139; horizontalAlign 'right' → left = 90-200 = -110
      // → clamped to margin 8.
      expect(dropdown.style.top).toBe('139px');
      expect(dropdown.style.left).toBe('8px');
      expect(dropdown.style.bottom).toBe('auto');
      expect(dropdown.style.right).toBe('auto');
    });

    it('align="left" aligns the dropdown left edge with the trigger left edge', async () => {
      element.align = 'left';
      await element.updateComplete;
      const buttonWrapper = element.shadowRoot?.querySelector(
        '.button-wrapper'
      ) as HTMLElement;
      const dropdown = element.shadowRoot?.querySelector(
        '.dropdown'
      ) as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      mockMetrics(
        buttonWrapper,
        dropdown,
        { top: 100, bottom: 135, left: 50, right: 90, width: 40, height: 35 },
        200,
        100
      );

      buttonWrapper.click();
      await element.updateComplete;

      // horizontalAlign 'left' → left = triggerRect.left = 50 (no clamping).
      expect(dropdown.style.left).toBe('50px');
      expect(dropdown.style.top).toBe('139px');
      expect(dropdown.style.right).toBe('auto');
      expect(dropdown.style.bottom).toBe('auto');

      // Clamp case: trigger fully off-screen to the left → the left edge must
      // be clamped to the viewport margin (8), not set to the raw rect.left.
      vi.mocked(buttonWrapper.getBoundingClientRect).mockReturnValue({
        x: -150,
        y: 100,
        top: 100,
        right: -110,
        bottom: 135,
        left: -150,
        width: 40,
        height: 35,
        toJSON: () => ({}),
      });
      buttonWrapper.click(); // close
      await element.updateComplete;
      buttonWrapper.click(); // open → repositions with the new rect
      await element.updateComplete;

      expect(dropdown.style.left).toBe('8px');
    });

    it('clamps the dropdown left edge when the trigger right edge is off-screen', async () => {
      await element.updateComplete;
      const buttonWrapper = element.shadowRoot?.querySelector(
        '.button-wrapper'
      ) as HTMLElement;
      const dropdown = element.shadowRoot?.querySelector(
        '.dropdown'
      ) as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      mockMetrics(
        buttonWrapper,
        dropdown,
        { top: 100, bottom: 135, left: 940, right: 980, width: 40, height: 35 },
        200,
        100
      );

      buttonWrapper.click();
      await element.updateComplete;

      // horizontalAlign 'right' → left = 980-200 = 780, clamped to
      // min(780, 1000-200-8 = 792) → 780.
      expect(dropdown.style.left).toBe('780px');
      expect(dropdown.style.top).toBe('139px');
      expect(dropdown.style.right).toBe('auto');
    });

    it('position="up" prefers placing the dropdown above the trigger', async () => {
      element.position = 'up';
      await element.updateComplete;
      const buttonWrapper = element.shadowRoot?.querySelector(
        '.button-wrapper'
      ) as HTMLElement;
      const dropdown = element.shadowRoot?.querySelector(
        '.dropdown'
      ) as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      mockMetrics(
        buttonWrapper,
        dropdown,
        { top: 300, bottom: 335, left: 50, right: 90, width: 40, height: 35 },
        200,
        100
      );

      buttonWrapper.click();
      await element.updateComplete;

      // preferSide 'up' → spaceAbove = 300-4 = 296 fits → top = 300-100-4 = 196.
      expect(dropdown.style.top).toBe('196px');
      expect(dropdown.style.bottom).toBe('auto');
    });
  });

  describe('positioned under a transformed ancestor', () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1000,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: originalInnerHeight,
      });
      vi.restoreAllMocks();
    });

    /**
     * Mocks the metrics computePopupPosition consumes: the button-wrapper
     * getBoundingClientRect() and the dropdown's offsetWidth/offsetHeight.
     */
    function mockTriggerRect(
      wrapper: HTMLElement,
      dropdown: HTMLElement,
      rect: {
        top: number;
        bottom: number;
        left: number;
        right: number;
        width: number;
        height: number;
      },
      popupWidth: number,
      popupHeight: number
    ) {
      vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
        x: rect.left,
        y: rect.top,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        toJSON: () => ({}),
      });
      Object.defineProperty(dropdown, 'offsetWidth', {
        configurable: true,
        value: popupWidth,
      });
      Object.defineProperty(dropdown, 'offsetHeight', {
        configurable: true,
        value: popupHeight,
      });
    }

    /**
     * Mocks the dropdown's own getBoundingClientRect(). When a host (e.g.
     * t-media-parent's :host transform: translateY(100%) slide-up animation)
     * establishes a containing block, a position:fixed descendant is positioned
     * relative to that transformed box instead of the viewport — so at
     * top:0/left:0 the dropdown sits at this nonzero viewport origin.
     *
     * The component's _positionDropdown() measures this rect and subtracts its
     * origin from the computed top/left to convert viewport coordinates into
     * the containing block's coordinate space.
     */
    function mockContainingBlockOrigin(
      dropdown: HTMLElement,
      origin: { top: number; left: number },
      width = 200,
      height = 100
    ) {
      vi.spyOn(dropdown, 'getBoundingClientRect').mockReturnValue({
        x: origin.left,
        y: origin.top,
        top: origin.top,
        right: origin.left + width,
        bottom: origin.top + height,
        left: origin.left,
        width,
        height,
        toJSON: () => ({}),
      });
    }

    it('compensates for a translated containing block (position "down", align "right")', async () => {
      await element.updateComplete;
      const buttonWrapper = element.shadowRoot?.querySelector(
        '.button-wrapper'
      ) as HTMLElement;
      const dropdown = element.shadowRoot?.querySelector(
        '.dropdown'
      ) as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      mockTriggerRect(
        buttonWrapper,
        dropdown,
        { top: 100, bottom: 135, left: 50, right: 90, width: 40, height: 35 },
        200,
        100
      );
      // Transformed ancestor shifts the fixed dropdown's origin down 60 and
      // right 40 in viewport coordinates (where it sits at top:0/left:0).
      mockContainingBlockOrigin(dropdown, { top: 60, left: 40 });

      buttonWrapper.click();
      await element.updateComplete;

      // position 'down' + align 'right' (defaults): computed top = 135+4 = 139,
      // left = 90-200 = -110 → clamped to margin 8. Fix subtracts the origin:
      // top = 139-60 = 79, left = 8-40 = -32.
      expect(dropdown.style.top).toBe('79px');
      expect(dropdown.style.left).toBe('-32px');
      expect(dropdown.style.bottom).toBe('auto');
      expect(dropdown.style.right).toBe('auto');
    });

    it('compensates vertical offset with position="up"', async () => {
      element.position = 'up';
      await element.updateComplete;
      const buttonWrapper = element.shadowRoot?.querySelector(
        '.button-wrapper'
      ) as HTMLElement;
      const dropdown = element.shadowRoot?.querySelector(
        '.dropdown'
      ) as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      mockTriggerRect(
        buttonWrapper,
        dropdown,
        { top: 300, bottom: 335, left: 50, right: 90, width: 40, height: 35 },
        200,
        100
      );
      mockContainingBlockOrigin(dropdown, { top: 60, left: 40 });

      buttonWrapper.click();
      await element.updateComplete;

      // preferSide 'up' → spaceAbove = 300-4 = 296 fits → computed top =
      // 300-100-4 = 196; left = 90-200 = -110 → clamped to 8. Fix subtracts the
      // origin: top = 196-60 = 136, left = 8-40 = -32.
      expect(dropdown.style.top).toBe('136px');
      expect(dropdown.style.left).toBe('-32px');
      expect(dropdown.style.bottom).toBe('auto');
      expect(dropdown.style.right).toBe('auto');
    });

    it('compensates horizontal offset with align="left"', async () => {
      element.align = 'left';
      await element.updateComplete;
      const buttonWrapper = element.shadowRoot?.querySelector(
        '.button-wrapper'
      ) as HTMLElement;
      const dropdown = element.shadowRoot?.querySelector(
        '.dropdown'
      ) as HTMLElement | null;
      if (!buttonWrapper || !dropdown) throw new Error('dropdown elements not found');

      mockTriggerRect(
        buttonWrapper,
        dropdown,
        { top: 100, bottom: 135, left: 50, right: 90, width: 40, height: 35 },
        200,
        100
      );
      mockContainingBlockOrigin(dropdown, { top: 60, left: 40 });

      buttonWrapper.click();
      await element.updateComplete;

      // horizontalAlign 'left' → computed left = triggerRect.left = 50;
      // computed top = 135+4 = 139. Fix subtracts the origin:
      // top = 139-60 = 79, left = 50-40 = 10.
      expect(dropdown.style.top).toBe('79px');
      expect(dropdown.style.left).toBe('10px');
      expect(dropdown.style.bottom).toBe('auto');
      expect(dropdown.style.right).toBe('auto');
    });
  });
});