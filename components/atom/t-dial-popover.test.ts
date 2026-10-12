import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Dial } from './t-dial.js';

/**
 * FEATURE SPEC (top-layer escape): t-dial's floating wheel must join the
 * browser's top layer via the Popover API, mirroring t-dropdown-button and
 * t-help-tip (see t-help-tip-popover.test.ts).
 *
 * Why: commit 75c68e4 made t-dropdown-button's dropdown use the Popover API
 * top-layer (popover="manual" + showPopover). t-dial's wheel is portaled to
 * document.body as a plain div with position:fixed z-index:20000. Top-layer
 * always paints above the document layer, so the wheel renders BEHIND the
 * dropdown panel (e.g. in the edit marker dialog) and is invisible.
 *
 * Fix contract pinned here:
 * 1. The portaled wheel is rendered with the literal attribute
 *    `popover="manual"`.
 * 2. On show: `popoverEl.showPopover()` — only if it is a function (feature
 *    detection), BEFORE positioning/measuring.
 * 3. On hide (drag end or disconnect while dragging): `hidePopover()` — only
 *    if the component previously called showPopover on THAT element
 *    (hidePopover throws InvalidStateError on a never-shown popover).
 * 4. Re-rendering while visible (updated() -> _renderPortal) must NOT call
 *    showPopover again on the same already-showing element.
 * 5. Without the Popover API (happy-dom / old browsers): open and close must
 *    not throw, and hidePopover must never be called if show was never
 *    available.
 * 6. Portal CSS must neutralize the UA popover defaults the way
 *    t-dropdown-button/t-help-tip do (overflow: visible plus an inset/padding
 *    reset, so the plain-div appearance is kept).
 *
 * happy-dom@20 does NOT implement the Popover API, and the wheel portal is
 * CREATED at show time in document.body (so it cannot be patched per-instance
 * beforehand) — the spies are therefore installed on
 * `HTMLElement.prototype` per test (always removed in afterEach) and asserted
 * via call counts / `mock.contexts` (`this` === the popover element). The
 * spies also emulate the browser's InvalidStateError guards, so the "must not
 * throw" assertions actually bite.
 *
 * These tests import the ACTUAL Dial code (never a re-implementation) and
 * drive the REAL interaction (mousedown on .value-display, mouseup on
 * document for drag end).
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

// Private-member access without `any`: only the members this test needs.
type DialPrivate = {
  _portalContainer: HTMLDivElement | null;
  _dialCenterX: number;
  _dialCenterY: number;
};
const asPrivate = (el: Dial): DialPrivate => el as unknown as DialPrivate;

describe('t-dial wheel popover (top-layer escape)', () => {
  let element: Dial;
  let spies: PopoverSpies;

  beforeEach(async () => {
    spies = createPopoverSpies();
    patchPopoverPrototype(spies);
    element = new Dial();
    document.body.appendChild(element);
    await element.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    // Never leave the prototype patch behind for other tests/files.
    unpatchPopoverPrototype();
    // Never leave a leaked wheel portal behind for other tests/files.
    for (const wheel of Array.from(document.body.querySelectorAll('.t-dial-portal'))) {
      const host: Element | null = wheel.parentElement;
      if (host) host.remove();
      else wheel.remove();
    }
  });

  function getWheel(): HTMLElement | null {
    return document.body.querySelector('.t-dial-portal') as HTMLElement | null;
  }

  function getPortalStyleText(): string {
    const wheel = getWheel();
    const host = wheel?.parentElement;
    return host?.querySelector('style')?.textContent ?? '';
  }

  /** The portaled element carrying popover="manual" (wheel or its host). */
  function getPopoverElement(): HTMLElement | null {
    const wheel = getWheel();
    if (!wheel) return null;
    if (wheel.getAttribute('popover') === 'manual') return wheel;
    const host = wheel.parentElement as HTMLElement | null;
    if (!host) return null;
    if (host.getAttribute('popover') === 'manual') return host;
    return host.querySelector('[popover="manual"]') as HTMLElement | null;
  }

  /** Real interaction: press on the value display to float the wheel. */
  async function showWheel(): Promise<HTMLElement> {
    const valueDisplay = element.shadowRoot?.querySelector(
      '.value-display'
    ) as HTMLElement | null;
    if (!valueDisplay) throw new Error('.value-display not found');
    valueDisplay.dispatchEvent(
      new MouseEvent('mousedown', {
        button: 0,
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await element.updateComplete;
    const wheel = getWheel();
    if (!wheel) throw new Error('wheel portal (.t-dial-portal) not found after mousedown');
    return wheel;
  }

  /** Real interaction: drag end hides the wheel (document mouseup). */
  async function hideWheel(): Promise<void> {
    document.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, composed: true, cancelable: true })
    );
    await element.updateComplete;
  }

  it('renders the portaled wheel with popover="manual"', async () => {
    await showWheel();

    const popover = getPopoverElement();
    expect(popover).toBeTruthy();
    expect(popover?.getAttribute('popover')).toBe('manual');
  });

  it('calls showPopover on the portaled element exactly once when shown', async () => {
    await showWheel();

    const popover = getPopoverElement();
    expect(popover).toBeTruthy();
    expect(spies.showPopover).toHaveBeenCalledTimes(1);
    expect(spies.showPopover.mock.contexts[0]).toBe(popover);
  });

  it('calls showPopover before positioning the wheel', async () => {
    await showWheel();

    expect(spies.showPopover).toHaveBeenCalledTimes(1);

    // Positioning writes styles after show: an empty inline cssText at show
    // time proves showPopover ran BEFORE positioning started.
    expect(spies.cssTextAtShow[0]).toBe('');

    // ...and positioning did happen afterwards (portal carries coordinates).
    expect(getPortalStyleText()).toMatch(/left\s*:/);
  });

  it('calls hidePopover exactly once on THAT element when the drag ends', async () => {
    await showWheel();
    const popover = getPopoverElement();
    expect(spies.showPopover).toHaveBeenCalledTimes(1);

    await hideWheel();

    expect(getWheel()).toBeNull();
    expect(spies.hidePopover).toHaveBeenCalledTimes(1);
    expect(spies.hidePopover.mock.contexts[0]).toBe(popover);
  });

  it('calls hidePopover exactly once when disconnected while dragging', async () => {
    await showWheel();
    expect(spies.showPopover).toHaveBeenCalledTimes(1);

    element.remove(); // disconnectedCallback while the wheel is visible
    expect(asPrivate(element)._portalContainer).toBeNull();

    expect(spies.hidePopover).toHaveBeenCalledTimes(1);
  });

  it('does not call showPopover again when re-rendering while visible', async () => {
    await showWheel();
    expect(spies.showPopover).toHaveBeenCalledTimes(1);

    // updated() -> _renderPortal() re-renders the same open wheel. Calling
    // showPopover again on it would throw InvalidStateError in a browser.
    element.requestUpdate();
    await element.updateComplete;

    // Proves the re-render path actually ran and kept the wheel.
    expect(getWheel()).toBeTruthy();
    expect(spies.showPopover).toHaveBeenCalledTimes(1);
    expect(spies.hidePopover).not.toHaveBeenCalled();
  });

  it('neutralizes the UA popover overflow default on the portal', async () => {
    await showWheel();

    // UA popover stylesheet sets overflow: auto; the portal must keep its
    // pre-popover plain-div appearance.
    expect(getPortalStyleText()).toMatch(/overflow\s*:\s*visible/);
  });

  it('neutralizes the UA popover inset/padding default on the portal', async () => {
    await showWheel();

    // UA popover stylesheet sets inset: 0 (stretches position:fixed popups)
    // and padding: 0.25em; at least one must be reset.
    expect(getPortalStyleText()).toMatch(/(inset\s*:\s*auto|padding\s*:\s*0)/);
  });

  it('keeps left/top after the inset reset (inset must not clobber position)', async () => {
    await showWheel();

    const styleText = getPortalStyleText();
    // Declared coordinates must equal the expected center coords.
    const { _dialCenterX, _dialCenterY } = asPrivate(element);
    expect(styleText).toMatch(new RegExp(`left\\s*:\\s*${_dialCenterX}px`));
    expect(styleText).toMatch(new RegExp(`top\\s*:\\s*${_dialCenterY}px`));

    // `inset:auto` shorthand resets left/top when it comes AFTER them in
    // the same rule (wheel lands top-left). It must come BEFORE left/top
    // (or only reset right/bottom/margin). Pin declaration order within
    // the .t-dial-portal rule.
    const portalRule = styleText.split('.t-dial-portal-badge')[0];
    const insetIdx = portalRule.search(/inset\s*:/);
    const leftIdx = portalRule.search(/left\s*:/);
    const topIdx = portalRule.search(/top\s*:/);
    expect(insetIdx).toBeGreaterThanOrEqual(0);
    expect(leftIdx).toBeGreaterThanOrEqual(0);
    expect(topIdx).toBeGreaterThanOrEqual(0);
    expect(insetIdx).toBeLessThan(leftIdx);
    expect(insetIdx).toBeLessThan(topIdx);
  });

  it('neutralizes the UA popover chrome on the portal', async () => {
    await showWheel();

    // UA popover stylesheet gives [popover]{background:Canvas; border:solid;
    // padding:0.25em; margin:auto; ...} — a white square around the wheel.
    // The portal must reset each of these to keep its plain-div appearance.
    const styleText = getPortalStyleText();
    expect(styleText).toMatch(
      /background\s*:\s*transparent|background\s*:\s*none|background-color\s*:\s*transparent/
    );
    expect(styleText).toMatch(/border\s*:\s*(none|0)\b|border-width\s*:\s*0/);
    expect(styleText).toMatch(/padding\s*:\s*0\b/);
    expect(styleText).toMatch(/margin\s*:\s*0\b/);
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

      await showWheel(); // must not throw without the Popover API

      const popover = getPopoverElement();
      expect(popover).toBeTruthy();
      expect(popover?.getAttribute('popover')).toBe('manual');

      await hideWheel(); // must not throw without the Popover API

      expect(getWheel()).toBeNull();
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

      await showWheel();
      expect(getPopoverElement()?.getAttribute('popover')).toBe('manual');

      await hideWheel();

      expect(getWheel()).toBeNull();
      expect(hideSpies.hidePopover).not.toHaveBeenCalled();
    });
  });
});
