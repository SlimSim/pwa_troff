import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { THelpTip, popupStyles } from '../../components/atom/t-help-tip.js';

/**
 * FEATURE SPEC (top-layer escape): t-help-tip's portaled popup joins the
 * browser's top layer via the Popover API, mirroring t-dropdown-button
 * (see t-dropdown-button.ts and t-dropdown-button-popover.test.ts).
 *
 * Why: the "Status" t-help-tip sits INSIDE a t-dropdown-button's dropdown
 * panel (see t-media.ts). That panel is `popover="manual"` and therefore
 * paints in the top layer, which always wins over the document layer — so the
 * help-tip popup (portaled into document.body with `z-index: 20000`) rendered
 * BEHIND the dropdown panel.
 *
 * Fix contract pinned here:
 * 1. The portaled `.detail-content` is rendered with the literal attribute
 *    `popover="manual"`.
 * 2. On render (open): `popup.showPopover()` — only if it is a function
 *    (feature detection), BEFORE positioning/measuring.
 * 3. On destroy (close, or disconnect while open): `popup.hidePopover()` —
 *    only if the component previously called showPopover on THAT element
 *    (hidePopover throws InvalidStateError on a never-shown popover).
 * 4. Re-rendering while open (slotchange) must NOT call showPopover again on
 *    the same already-showing element and must not throw.
 * 5. Without the Popover API (happy-dom / old browsers): open and close must
 *    not throw, and hidePopover must never be called if showPopover never was.
 * 6. `popupStyles` must neutralize the UA popover defaults the way
 *    t-dropdown-button does: `overflow: visible` and `inset: auto` on
 *    `.detail-content` (the UA popover stylesheet sets `inset: 0`, which
 *    would stretch the position:fixed popup, and `overflow: auto`).
 *
 * happy-dom@20 does NOT implement the Popover API, and `.detail-content` is
 * CREATED at open time inside a portal shadow root (so it cannot be patched
 * per-instance beforehand) — the spies are therefore installed on
 * `HTMLElement.prototype` per test (always removed in afterEach) and asserted
 * via call counts / `mock.contexts` (`this` === the popup element). The spies
 * also emulate the browser's InvalidStateError guards, so the "must not
 * throw" assertions actually bite.
 */

type PopoverSpies = ReturnType<typeof createPopoverSpies>;

function createPopoverSpies() {
  const shown = new WeakSet<HTMLElement>();
  const cssTextAtShow: string[] = [];

  // Emulates the browser: showPopover() on an already-showing popover throws
  // InvalidStateError.
  const showPopover = vi.fn(function (this: HTMLElement) {
    if (shown.has(this)) {
      throw new DOMException(
        'showPopover() called on an already-showing popover',
        'InvalidStateError'
      );
    }
    shown.add(this);
    cssTextAtShow.push(this.style.cssText);
  });

  // Emulates the browser: hidePopover() on a popover that was never shown
  // throws InvalidStateError.
  const hidePopover = vi.fn(function (this: HTMLElement) {
    if (!shown.has(this)) {
      throw new DOMException(
        'hidePopover() called on a popover that was never shown',
        'InvalidStateError'
      );
    }
    shown.delete(this);
  });

  return { showPopover, hidePopover, cssTextAtShow };
}

function patchPopoverPrototype(spies: PopoverSpies): void {
  Object.defineProperty(HTMLElement.prototype, 'showPopover', {
    value: spies.showPopover,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
    value: spies.hidePopover,
    configurable: true,
    writable: true,
  });
}

function unpatchPopoverPrototype(): void {
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
}

describe('t-help-tip popover (top-layer escape)', () => {
  let element: THelpTip;
  let spies: PopoverSpies;

  beforeEach(() => {
    spies = createPopoverSpies();
    patchPopoverPrototype(spies);
    element = new THelpTip();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    // Never leave the prototype patch behind for other tests/files.
    unpatchPopoverPrototype();
  });

  function setDetailContent(content: string): void {
    const div = document.createElement('div');
    div.textContent = content;
    element.appendChild(div);
  }

  async function openPopup(): Promise<void> {
    element.open = true;
    await element.updateComplete;
  }

  async function closePopup(): Promise<void> {
    element.open = false;
    await element.updateComplete;
  }

  it('renders the portaled .detail-content popup with popover="manual"', async () => {
    setDetailContent('Detail content');
    await openPopup();

    const popup = element.popupElement;
    expect(popup).toBeTruthy();
    expect(popup?.getAttribute('popover')).toBe('manual');
  });

  it('calls showPopover on the portaled popup exactly once when opened', async () => {
    setDetailContent('Detail content');
    await openPopup();

    const popup = element.popupElement;
    expect(popup).toBeTruthy();
    expect(spies.showPopover).toHaveBeenCalledTimes(1);
    expect(spies.showPopover.mock.contexts[0]).toBe(popup);
  });

  it('calls showPopover before positioning/measuring the popup', async () => {
    setDetailContent('Detail content');
    await openPopup();

    const popup = element.popupElement;
    expect(popup).toBeTruthy();
    expect(spies.showPopover).toHaveBeenCalledTimes(1);

    // _positionPopup() mutates the popup's inline styles as its first action,
    // so an empty style.cssText at showPopover time proves the popover was
    // shown BEFORE positioning (the contract); any inline style means it was
    // shown after positioning had already started.
    expect(spies.cssTextAtShow[0]).toBe('');

    // ...and positioning did happen afterwards.
    expect(popup?.style.top).toBeTruthy();
    expect(popup?.style.left).toBeTruthy();
  });

  it('calls hidePopover exactly once when closed after being opened', async () => {
    setDetailContent('Detail content');
    await openPopup();

    const popup = element.popupElement;
    expect(spies.showPopover).toHaveBeenCalledTimes(1);

    await closePopup();

    expect(element.popupElement).toBeNull();
    expect(spies.hidePopover).toHaveBeenCalledTimes(1);
    expect(spies.hidePopover.mock.contexts[0]).toBe(popup);
  });

  it('calls hidePopover exactly once when disconnected while open', async () => {
    setDetailContent('Detail content');
    await openPopup();
    expect(spies.showPopover).toHaveBeenCalledTimes(1);

    element.remove(); // disconnectedCallback → destroys the portal

    expect(spies.hidePopover).toHaveBeenCalledTimes(1);
  });

  it('does not call showPopover again when the popup re-renders while open (slotchange)', async () => {
    setDetailContent('Detail content');
    await openPopup();
    expect(spies.showPopover).toHaveBeenCalledTimes(1);

    // Appending light-DOM detail content while open fires slotchange, which
    // calls _renderPopup() again. The existing popup element is reused by lit,
    // so showPopover() must NOT be called a second time (InvalidStateError in
    // a real browser) and nothing may throw.
    const extra = document.createElement('div');
    extra.textContent = 'Re-rendered detail';
    element.appendChild(extra);
    await element.updateComplete;

    // Proves the slotchange → _renderPopup() path actually ran.
    expect(element.popupElement?.textContent).toContain('Re-rendered detail');
    expect(spies.showPopover).toHaveBeenCalledTimes(1);
    expect(spies.hidePopover).not.toHaveBeenCalled();
  });

  describe('without the Popover API (fallback path)', () => {
    beforeEach(() => {
      // The outer beforeEach just patched HTMLElement.prototype — remove the
      // patches so the component truly sees showPopover/hidePopover as
      // undefined (happy-dom / old browsers).
      unpatchPopoverPrototype();
    });

    it('opens and closes without throwing and still renders popover="manual"', async () => {
      expect(typeof HTMLElement.prototype.showPopover).toBe('undefined');
      expect(typeof HTMLElement.prototype.hidePopover).toBe('undefined');

      setDetailContent('Detail content');

      await openPopup(); // must not throw without the Popover API

      const popup = element.popupElement;
      expect(popup).toBeTruthy();
      expect(typeof popup?.showPopover).toBe('undefined');
      expect(popup?.getAttribute('popover')).toBe('manual');

      await closePopup(); // must not throw without the Popover API

      expect(element.popupElement).toBeNull();
    });

    it('never calls hidePopover when showPopover was never available', async () => {
      const hideSpies = createPopoverSpies();
      Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
        value: hideSpies.hidePopover,
        configurable: true,
        writable: true,
      });
      // showPopover deliberately NOT patched: the component must
      // feature-detect, never set its "I showed the popover" flag, and
      // therefore never call hidePopover (InvalidStateError on a
      // never-shown popover).

      setDetailContent('Detail content');

      await openPopup();
      expect(element.popupElement?.getAttribute('popover')).toBe('manual');

      await closePopup();

      expect(element.popupElement).toBeNull();
      expect(hideSpies.hidePopover).not.toHaveBeenCalled();
    });
  });
});

describe('t-help-tip popupStyles (UA popover default neutralization)', () => {
  const cssText = popupStyles.cssText;

  it('sets overflow: visible on .detail-content (UA popover sets overflow: auto)', () => {
    expect(cssText).toMatch(/\.detail-content\s*\{[^}]*overflow\s*:\s*visible/);
  });

  it('sets inset: auto on .detail-content (UA popover sets inset: 0)', () => {
    expect(cssText).toMatch(/\.detail-content\s*\{[^}]*inset\s*:\s*auto/);
  });
});
