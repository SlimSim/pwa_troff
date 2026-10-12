import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaItem } from './t-media.js';
import type { DropdownButton } from './t-dropdown-button.js';

/**
 * REGRESSION: t-dropdown should close when pressing Edit (same as status select).
 *
 * Status buttons already close the dropdown via `_handleStatusSelect`
 * setting `dropdown.open = false`. Edit currently does NOT close it.
 *
 * These tests import ACTUAL code only (never re-implementations) and are
 * expected to be RED until `_handleEditClick` closes the dropdown.
 */

function getDropdown(el: MediaItem): DropdownButton | null {
  return (el.shadowRoot?.querySelector('t-dropdown-button') ?? null) as DropdownButton | null;
}

function getEditButton(el: MediaItem): HTMLElement | null {
  return (el.shadowRoot?.querySelector(
    '.status-box t-butt[title="Edit song"]'
  ) ?? null) as HTMLElement | null;
}

describe('t-media dropdown closes on Edit', () => {
  let el: MediaItem;

  beforeEach(async () => {
    el = new MediaItem();
    document.body.appendChild(el);
    el.songKey = 'my-song.mp3';
    el.hideEditButton = false;
    await el.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
    vi.restoreAllMocks();
  });

  it.each([false, true])(
    'clicking Edit dispatches song-edit-requested and closes the dropdown (showStatusButton=%s)',
    async (showStatus: boolean) => {
      el.showStatusButton = showStatus;
      await el.updateComplete;

      const dropdown = getDropdown(el);
      expect(dropdown).toBeTruthy();
      if (!dropdown) return;

      dropdown.open = true;
      await dropdown.updateComplete;
      await el.updateComplete;
      expect(dropdown.open).toBe(true);

      const editBtn = getEditButton(el);
      expect(editBtn).toBeTruthy();
      if (!editBtn) return;

      const editSpy = vi.fn();
      const selectedSpy = vi.fn();
      el.addEventListener('song-edit-requested', editSpy);
      el.addEventListener('media-selected', selectedSpy);

      editBtn.click();
      await el.updateComplete;
      await dropdown.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(editSpy).toHaveBeenCalledTimes(1);
      const event = (editSpy.mock.calls[0] as unknown[])[0] as CustomEvent<{
        songKey: string;
      }>;
      expect(event.type).toBe('song-edit-requested');
      expect(event.detail).toEqual({ songKey: 'my-song.mp3' });
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
      expect(selectedSpy).not.toHaveBeenCalled();
      expect(dropdown.open).toBe(false);
    }
  );
});
