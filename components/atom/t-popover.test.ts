import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Popover } from './t-popover.js';

describe('t-popover', () => {
  let element: Popover;

  beforeEach(() => {
    element = new Popover();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  /** Open the popover via the trigger wrapper click, like the old tests. */
  async function openViaTrigger() {
    await element.updateComplete;
    const triggerWrapper = element.shadowRoot?.querySelector(
      '.trigger-wrapper'
    ) as HTMLElement;
    triggerWrapper.click();
    await element.updateComplete;
  }

  it('initially has open=false', async () => {
    await element.updateComplete;
    expect(element.open).toBe(false);
  });

  it('toggles open to true when trigger is clicked', async () => {
    await openViaTrigger();
    expect(element.open).toBe(true);
  });

  it('toggles open back to false when trigger is clicked again', async () => {
    await openViaTrigger();
    expect(element.open).toBe(true);

    const triggerWrapper = element.shadowRoot?.querySelector(
      '.trigger-wrapper'
    ) as HTMLElement;
    triggerWrapper.click();
    await element.updateComplete;
    expect(element.open).toBe(false);
  });

  it('dispatches popover-opened event when opened', async () => {
    const spy = vi.fn();
    element.addEventListener('popover-opened', spy);
    await openViaTrigger();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('dispatches popover-close event when closed via trigger click', async () => {
    await openViaTrigger();

    const spy = vi.fn();
    element.addEventListener('popover-close', spy);

    // Close via trigger
    const triggerWrapper = element.shadowRoot?.querySelector(
      '.trigger-wrapper'
    ) as HTMLElement;
    triggerWrapper.click();
    await element.updateComplete;

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('dispatches popover-close event when close button is clicked', async () => {
    element.header = 'Test Header';
    await openViaTrigger();

    const spy = vi.fn();
    element.addEventListener('popover-close', spy);

    // The close button now lives inside the PORTALED popup, not the
    // component's shadow root.
    const closeBtn = element.popupElement?.querySelector(
      '.popup-header t-butt'
    ) as HTMLElement | null;
    expect(closeBtn).not.toBeNull();
    closeBtn?.click();
    await element.updateComplete;

    expect(spy).toHaveBeenCalledTimes(1);
    expect(element.open).toBe(false);
  });

  it('closes on outside document mousedown', async () => {
    await openViaTrigger();
    expect(element.open).toBe(true);

    // Mousedown outside the element
    document.body.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true })
    );
    await element.updateComplete;
    expect(element.open).toBe(false);
  });

  it('has no popup in the shadow root and popupElement is null when closed', async () => {
    await element.updateComplete;
    expect(element.popupElement).toBeNull();
    expect(element.shadowRoot?.querySelector('.popup')).toBeNull();
  });

  it('portals the popup into document.body when opened', async () => {
    await openViaTrigger();

    const popup = element.popupElement;
    expect(popup).not.toBeNull();
    expect(popup).toBeInstanceOf(HTMLElement);

    // The popup must NOT live inside the component's shadow root...
    expect(element.shadowRoot?.querySelector('.popup')).toBeNull();

    // ...but it must be attached to document.body via a portal host.
    // NOTE: happy-dom's Node.contains() does NOT cross shadow boundaries
    // (real browsers do via shadow-including semantics), so assert on the
    // portal host div (the popup's shadow root host) instead of the popup.
    const popupRoot = popup?.getRootNode() as ShadowRoot | null;
    expect(popupRoot?.host).toBeInstanceOf(HTMLElement);
    expect(document.body.contains(popupRoot?.host as Node)).toBe(true);
  });

  it('renders body text inside the portaled popup-body', async () => {
    element.body = 'The popup body text';
    await openViaTrigger();

    const bodyEl = element.popupElement?.querySelector('.popup-body');
    expect(bodyEl?.textContent?.trim()).toBe('The popup body text');
  });

  it('renders header text when header prop is set', async () => {
    element.header = 'My Header';
    await openViaTrigger();

    const headerText = element.popupElement?.querySelector(
      '.popup-header-text'
    );
    expect(headerText?.textContent?.trim()).toBe('My Header');
  });

  it('omits the header block when header prop is not set', async () => {
    await openViaTrigger();

    const headerText = element.popupElement?.querySelector(
      '.popup-header-text'
    );
    expect(headerText).toBeNull();
  });

  it('sets inline position styles on the portaled popup when opened', async () => {
    await openViaTrigger();

    const popup = element.popupElement;
    expect(popup?.style.top).toBeTruthy();
    expect(popup?.style.left).toBeTruthy();
  });

  it('renders the open portaled popup with z-index 20000', async () => {
    await openViaTrigger();

    const popup = element.popupElement as HTMLElement;
    expect(getComputedStyle(popup).zIndex).toBe('20000');
  });

  it('does not close when mousedown is dispatched inside the popup', async () => {
    await openViaTrigger();
    expect(element.open).toBe(true);

    const popup = element.popupElement as HTMLElement;
    popup.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, composed: true })
    );
    await element.updateComplete;

    expect(element.open).toBe(true);
  });

  it('repositions the portaled popup on window resize when open', async () => {
    await openViaTrigger();

    const popup = element.popupElement;
    expect(popup?.style.top).toBeTruthy();
    expect(popup?.style.left).toBeTruthy();

    // Trigger resize
    window.dispatchEvent(new Event('resize'));
    await element.updateComplete;

    // Positioning function ran without error
    expect(popup?.style.top).toBeTruthy();
    expect(popup?.style.left).toBeTruthy();
  });

  it('does nothing on window scroll/resize when closed and popupElement stays null', async () => {
    await element.updateComplete;
    expect(element.popupElement).toBeNull();

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    await element.updateComplete;

    // Should stay null (no portaled popup exists to reposition)
    expect(element.popupElement).toBeNull();
  });

  it('does not dispatch popover-opened when closing via trigger', async () => {
    await openViaTrigger();

    const spy = vi.fn();
    element.addEventListener('popover-opened', spy);

    // Close
    const triggerWrapper = element.shadowRoot?.querySelector(
      '.trigger-wrapper'
    ) as HTMLElement;
    triggerWrapper.click();
    await element.updateComplete;

    expect(spy).not.toHaveBeenCalled();
  });

  it('closing removes the portaled popup and popupElement becomes null', async () => {
    await openViaTrigger();
    expect(element.popupElement).not.toBeNull();

    const triggerWrapper = element.shadowRoot?.querySelector(
      '.trigger-wrapper'
    ) as HTMLElement;
    triggerWrapper.click();
    await element.updateComplete;
    expect(element.open).toBe(false);

    expect(element.popupElement).toBeNull();
    expect(element.shadowRoot?.querySelector('.popup')).toBeNull();
  });

  it("preferPosition defaults to 'center'", async () => {
    await element.updateComplete;
    expect(element.preferPosition).toBe('center');
  });

  it('prefer-position attribute maps to the preferPosition property', async () => {
    element.setAttribute('prefer-position', 'right');
    await element.updateComplete;
    expect(element.preferPosition).toBe('right');
  });
});
