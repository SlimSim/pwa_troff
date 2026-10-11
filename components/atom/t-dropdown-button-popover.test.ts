import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DropdownButton } from './t-dropdown-button.js';

/**
 * FEATURE SPEC (top-layer escape): t-dropdown-button uses the Popover API.
 *
 * The shadow-DOM `.dropdown` panel is `position: fixed; z-index: 20000`, but
 * when the component sits inside a stacking-context ancestor (e.g.
 * `t-media-parent` with `transform` + `z-index`), the z-index is trapped and
 * the panel paints BELOW `t-header`. Escaping via the Popover API's top layer
 * fixes e.g. the group-status dropdown hidden behind the header.
 *
 * Fix contract pinned here:
 * 1. `.dropdown` is rendered with the literal attribute `popover="manual"`.
 * 2. On open: `dropdown.showPopover()` is called — only if it is a function
 *    (feature detection), before positioning, in `updated()`.
 * 3. On close: `dropdown.hidePopover()` is called — only if the component
 *    previously opened it via `showPopover` (hidePopover throws
 *    InvalidStateError on a never-shown popover, so the guard is required).
 * 4. On disconnect while open: the popover is hidden, same guard.
 * 5. Without the Popover API (old browsers / happy-dom): opening must NOT
 *    throw and falls back to today's behavior (inert attribute, no calls).
 *
 * happy-dom@20 does NOT implement the Popover API
 * (`typeof el.showPopover === 'undefined'`), so these tests POLYFILL
 * showPopover/hidePopover per `.dropdown` instance via Object.defineProperty
 * (never on globals) to observe calls.
 *
 * These tests import the ACTUAL component (never a re-implementation) and
 * stay GREEN-compatible with the ~28 existing t-dropdown-button tests
 * (toggle, events, display:none, positioning compensation, outside-click,
 * Escape) — the positioning code must remain untouched.
 */

type PopoverHost = HTMLElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

describe('t-dropdown-button popover (top-layer escape)', () => {
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

  function getDropdown(): PopoverHost {
    const dropdown = element.shadowRoot?.querySelector('.dropdown') as PopoverHost | null;
    if (!dropdown) throw new Error('dropdown element not found');
    return dropdown;
  }

  function getButtonWrapper(): HTMLElement {
    const buttonWrapper = element.shadowRoot?.querySelector('.button-wrapper') as HTMLElement | null;
    if (!buttonWrapper) throw new Error('button-wrapper element not found');
    return buttonWrapper;
  }

  async function openViaClick() {
    getButtonWrapper().click();
    await element.updateComplete;
  }

  async function closeViaClick() {
    getButtonWrapper().click();
    await element.updateComplete;
  }

  it('renders the dropdown panel with popover="manual"', async () => {
    await element.updateComplete;

    expect(getDropdown().getAttribute('popover')).toBe('manual');
  });

  it('calls showPopover when opened', async () => {
    await element.updateComplete;

    const dropdown = getDropdown();
    const showPopover = vi.fn();
    Object.defineProperty(dropdown, 'showPopover', { value: showPopover, configurable: true });

    await openViaClick();

    expect(element.open).toBe(true);
    expect(showPopover).toHaveBeenCalledTimes(1);
  });

  it('calls hidePopover when closed after being opened', async () => {
    await element.updateComplete;

    const dropdown = getDropdown();
    const showPopover = vi.fn();
    const hidePopover = vi.fn();
    Object.defineProperty(dropdown, 'showPopover', { value: showPopover, configurable: true });
    Object.defineProperty(dropdown, 'hidePopover', { value: hidePopover, configurable: true });

    await openViaClick();
    expect(showPopover).toHaveBeenCalledTimes(1);

    await closeViaClick();

    expect(element.open).toBe(false);
    expect(hidePopover).toHaveBeenCalledTimes(1);
  });

  it('does not call hidePopover when the popover was never shown via showPopover (guard against InvalidStateError)', async () => {
    await element.updateComplete;

    const dropdown = getDropdown();
    const hidePopover = vi.fn();
    Object.defineProperty(dropdown, 'hidePopover', { value: hidePopover, configurable: true });
    // Deliberately NO showPopover polyfill: happy-dom (and old browsers) lack
    // the Popover API, so the component falls back, never sets its internal
    // "I showed the popover" flag, and must therefore NEVER call hidePopover
    // on close — hidePopover() throws InvalidStateError on a never-shown
    // popover. Opening/closing must not throw either.
    expect(typeof dropdown.showPopover).toBe('undefined');

    await openViaClick();
    expect(element.open).toBe(true);

    await closeViaClick();
    expect(element.open).toBe(false);

    expect(hidePopover).not.toHaveBeenCalled();
  });

  it('opening does not throw when the Popover API is unavailable (fallback path)', async () => {
    await element.updateComplete;

    const dropdown = getDropdown();
    // No polyfills at all — this is the happy-dom / old-browser environment.
    expect(typeof dropdown.showPopover).toBe('undefined');
    expect(typeof dropdown.hidePopover).toBe('undefined');

    await openViaClick();

    expect(element.open).toBe(true);
    expect(dropdown.hasAttribute('open')).toBe(true);
  });

  it('hides the popover when disconnected while open', async () => {
    await element.updateComplete;

    const dropdown = getDropdown();
    const showPopover = vi.fn();
    const hidePopover = vi.fn();
    Object.defineProperty(dropdown, 'showPopover', { value: showPopover, configurable: true });
    Object.defineProperty(dropdown, 'hidePopover', { value: hidePopover, configurable: true });

    await openViaClick();
    expect(showPopover).toHaveBeenCalledTimes(1);
    expect(element.open).toBe(true);

    element.remove();

    expect(hidePopover).toHaveBeenCalledTimes(1);
  });

  it('re-opening after close calls showPopover again', async () => {
    await element.updateComplete;

    const dropdown = getDropdown();
    const showPopover = vi.fn();
    const hidePopover = vi.fn();
    Object.defineProperty(dropdown, 'showPopover', { value: showPopover, configurable: true });
    Object.defineProperty(dropdown, 'hidePopover', { value: hidePopover, configurable: true });

    await openViaClick(); // open #1
    await closeViaClick(); // close #1
    await openViaClick(); // open #2

    expect(element.open).toBe(true);
    expect(showPopover).toHaveBeenCalledTimes(2);
    expect(hidePopover).toHaveBeenCalledTimes(1);
  });
});
