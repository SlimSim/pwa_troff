import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DropdownButton } from '../components/atom/t-dropdown-button.js';
import { Popover } from '../components/atom/t-popover.js';
import { THelpTip } from '../components/atom/t-help-tip.js';
import { BottomNav } from '../components/molecule/t-footer.js';
import { MediaParent } from '../components/molecule/t-media-parent.js';

/**
 * FEATURE: Esc closes popups/sliders/song-list.
 *
 * Pressing Escape (keydown with key === 'Escape' on document/window) must close:
 *  1. any open popup (t-dropdown-button, t-popover, t-help-tip),
 *  2. the footer settings sliders (t-footer showSpeed/showTime/showMarkerDropdown),
 *  3. the song-list (t-media-parent visible).
 *
 * These tests dispatch the Escape keydown on `document` WITHOUT focusing
 * anything inside the popup first — the close must work via a document-level
 * listener, not via focus being inside the popup.
 */

function dispatchEscape(): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })
  );
}

describe('Esc closes popups', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('t-dropdown-button with open=true becomes open=false on Esc', async () => {
    const element = new DropdownButton();
    document.body.appendChild(element);
    try {
      element.open = true;
      await element.updateComplete;
      expect(element.open).toBe(true);

      dispatchEscape();
      await element.updateComplete;

      expect(element.open).toBe(false);
    } finally {
      if (document.body.contains(element)) {
        document.body.removeChild(element);
      }
    }
  });

  it('t-popover with open=true becomes open=false and dispatches popover-close on Esc', async () => {
    const element = new Popover();
    document.body.appendChild(element);
    try {
      element.open = true;
      await element.updateComplete;
      expect(element.open).toBe(true);

      const closeSpy = vi.fn();
      element.addEventListener('popover-close', closeSpy);

      dispatchEscape();
      await element.updateComplete;

      expect(element.open).toBe(false);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    } finally {
      if (document.body.contains(element)) {
        document.body.removeChild(element);
      }
    }
  });

  it('t-help-tip with open=true becomes open=false on Esc', async () => {
    const element = new THelpTip();
    document.body.appendChild(element);
    try {
      element.open = true;
      await element.updateComplete;
      expect(element.open).toBe(true);

      dispatchEscape();
      await element.updateComplete;

      expect(element.open).toBe(false);
    } finally {
      if (document.body.contains(element)) {
        document.body.removeChild(element);
      }
    }
  });
});

describe('Esc closes footer settings sliders', () => {
  let element: BottomNav;

  beforeEach(() => {
    element = new BottomNav();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('t-footer with showSpeedDropdown=true resets it to false on Esc', async () => {
    element.showSpeedDropdown = true;
    await element.updateComplete;
    expect(element.showSpeedDropdown).toBe(true);

    dispatchEscape();
    await element.updateComplete;

    expect(element.showSpeedDropdown).toBe(false);
  });

  it('t-footer with showTimeDropdown=true resets it to false on Esc', async () => {
    element.showTimeDropdown = true;
    await element.updateComplete;
    expect(element.showTimeDropdown).toBe(true);

    dispatchEscape();
    await element.updateComplete;

    expect(element.showTimeDropdown).toBe(false);
  });

  it('t-footer with showMarkerDropdown=true resets it to false on Esc', async () => {
    element.showMarkerDropdown = true;
    await element.updateComplete;
    expect(element.showMarkerDropdown).toBe(true);

    dispatchEscape();
    await element.updateComplete;

    expect(element.showMarkerDropdown).toBe(false);
  });

  it('t-footer with all three sliders open resets all three to false on Esc', async () => {
    element.showSpeedDropdown = true;
    element.showTimeDropdown = true;
    element.showMarkerDropdown = true;
    await element.updateComplete;

    dispatchEscape();
    await element.updateComplete;

    expect(element.showSpeedDropdown).toBe(false);
    expect(element.showTimeDropdown).toBe(false);
    expect(element.showMarkerDropdown).toBe(false);
  });
});

describe('Esc closes the song-list', () => {
  let element: MediaParent;

  beforeEach(() => {
    // Skip the async _loadSongs() that runs from connectedCallback; we
    // populate state directly so the component renders without touching
    // localStorage or the Cache API. Same pattern as t-media-parent.test.ts.
    vi.spyOn(MediaParent.prototype as any, '_loadSongs').mockResolvedValue(undefined);
    // Neutralize the fire-and-forget scroll timer like t-media-parent.test.ts does.
    vi.spyOn(MediaParent.prototype as any, '_scrollActiveSongIntoView').mockImplementation(() => {});

    element = new MediaParent();
    document.body.appendChild(element);

    (element as any).songs = [{ songKey: 'a', title: 'Tango' }];
    (element as any).groups = [];
    (element as any).currentFilter = 'tracks';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('t-media-parent with visible=true becomes visible=false on Esc (no search focus)', async () => {
    (element as any).searchQuery = '';
    element.visible = true;
    await element.updateComplete;
    expect(element.visible).toBe(true);

    dispatchEscape();
    await element.updateComplete;

    expect(element.visible).toBe(false);
  });
});
