import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaItem } from './t-media.js';
import type { DropdownButton } from './t-dropdown-button.js';
import {
  GROUP_SONG_STATUS_LABELS,
  GROUP_SONG_STATUS_ORDER,
  normalizeGroupSongStatus,
} from '../../utils/group-song-status.js';

/**
 * NEW CONTRACT (dropdown edit): the more-vertical `t-dropdown-button` renders
 * for ALL songs (not just groups) and the edit `t-butt` lives INSIDE it.
 *
 * - Default (`showStatusButton == false`): ONE `t-dropdown-button.edit-btn`
 *   (`position="up"`) with a `t-butt[slot=button][icon][ghost]` trigger holding
 *   `t-icon[name=more-vertical]`; trigger clicks stopPropagation (no
 *   `media-selected`). Dropdown content (`slot="dropdown"`, `.status-box`)
 *   has NO status help-tip, NO status buttons, NO `.status-remove-row`, but
 *   HAS an edit `t-butt` that dispatches `song-edit-requested { songKey }`
 *   (bubbles + composed) without `media-selected`. No separate
 *   `t-butt.edit-btn` outside the dropdown.
 * - Group (`showStatusButton == true`): same dropdown PLUS status help-tip
 *   `h3="Status"`, 4 full-width status buttons in GROUP_SONG_STATUS_ORDER,
 *   `.status-remove-row`, and the edit button inside the same dropdown.
 * - Gates: no dropdown when `songKey == ''` or `hideEditButton == true`.
 *
 * Imports ACTUAL code only (never re-implementations). RED on current code:
 * the default case renders no dropdown and keeps a separate `t-butt.edit-btn`
 * outside, and the group case keeps the edit button outside the dropdown.
 */

const STATUS_VALUE_SET: ReadonlySet<string> = new Set([...GROUP_SONG_STATUS_ORDER]);

function buttonValue(btn: Element): string | null {
  const attr = btn.getAttribute('value');
  if (attr !== null) return attr;
  const prop = (btn as Element & { value?: unknown }).value;
  return typeof prop === 'string' ? prop : null;
}

function buttonText(btn: Element): string {
  return (btn.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function getDropdown(el: MediaItem): DropdownButton | null {
  return (el.shadowRoot?.querySelector('t-dropdown-button') ?? null) as DropdownButton | null;
}

function getStatusBox(el: MediaItem): HTMLElement | null {
  return (el.shadowRoot?.querySelector('.status-box') ?? null) as HTMLElement | null;
}

/** Status buttons only (excludes edit / remove buttons inside the box). */
function statusButtons(content: Element): Element[] {
  return Array.from(content.querySelectorAll('t-butt')).filter((btn) => {
    const value = buttonValue(btn);
    return value !== null && STATUS_VALUE_SET.has(value);
  });
}

/**
 * The edit button INSIDE the dropdown: title "Edit song" or text containing
 * "Edit", excluding status-valued and remove buttons.
 */
function editButtonInside(content: Element): Element | null {
  const candidates = Array.from(content.querySelectorAll('t-butt'));
  return (
    candidates.find((btn) => {
      const value = buttonValue(btn);
      if (value !== null && STATUS_VALUE_SET.has(value)) return false;
      const text = buttonText(btn).toLowerCase();
      if (text.includes('remove from group')) return false;
      const title = (btn.getAttribute('title') ?? '').toLowerCase();
      const aria = (btn.getAttribute('aria-label') ?? '').toLowerCase();
      return (
        title.includes('edit song') ||
        title.includes('edit') ||
        aria.includes('edit song') ||
        text.includes('edit')
      );
    }) ?? null
  );
}

describe('t-media dropdown edit — default (outside a group)', () => {
  let el: MediaItem;

  beforeEach(async () => {
    el = new MediaItem();
    document.body.appendChild(el);
    el.songKey = 'my-song.mp3';
    el.showStatusButton = false;
    el.hideEditButton = false;
    await el.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
    vi.restoreAllMocks();
  });

  it('renders ONE t-dropdown-button.edit-btn[position=up] with a more-vertical trigger', async () => {
    const dropdowns = Array.from(el.shadowRoot?.querySelectorAll('t-dropdown-button') ?? []);
    expect(dropdowns).toHaveLength(1);

    const dropdown = getDropdown(el);
    expect(dropdown).toBeTruthy();
    expect(dropdown?.classList.contains('edit-btn')).toBe(true);
    expect(dropdown?.getAttribute('position')).toBe('up');

    const trigger = dropdown?.querySelector('t-butt[slot="button"]');
    expect(trigger).toBeTruthy();
    expect(trigger?.hasAttribute('icon')).toBe(true);
    expect(trigger?.hasAttribute('ghost')).toBe(true);
    expect(trigger?.querySelector('t-icon')?.getAttribute('name')).toBe('more-vertical');
  });

  it('trigger click does not dispatch media-selected (stopPropagation)', async () => {
    const dropdown = getDropdown(el);
    expect(dropdown).toBeTruthy();
    const trigger = dropdown?.querySelector('t-butt[slot="button"]') as HTMLElement | null;
    expect(trigger).toBeTruthy();

    const selectedSpy = vi.fn();
    el.addEventListener('media-selected', selectedSpy);

    (dropdown as unknown as HTMLElement).click();
    await el.updateComplete;
    expect(selectedSpy).not.toHaveBeenCalled();

    trigger?.click();
    await el.updateComplete;
    expect(selectedSpy).not.toHaveBeenCalled();

    // Positive control: clicking the row itself still selects the media.
    const container = el.shadowRoot?.querySelector('.media-container') as HTMLElement | null;
    expect(container).toBeTruthy();
    container?.click();
    await el.updateComplete;
    expect(selectedSpy).toHaveBeenCalledTimes(1);
  });

  it('dropdown content has NO status UI (no help-tip, no status buttons, no remove row)', async () => {
    const box = getStatusBox(el);
    expect(box).toBeTruthy();
    expect(box?.getAttribute('slot')).toBe('dropdown');

    expect(box?.querySelector('t-help-tip')).toBeNull();
    expect(statusButtons(box as HTMLElement)).toHaveLength(0);
    expect(box?.querySelector('.status-remove-row')).toBeNull();
  });

  it('dropdown content HAS an edit button that dispatches song-edit-requested (no media-selected)', async () => {
    const box = getStatusBox(el);
    expect(box).toBeTruthy();

    const editBtn = editButtonInside(box as HTMLElement) as HTMLElement | null;
    expect(editBtn).toBeTruthy();

    const editSpy = vi.fn();
    const selectedSpy = vi.fn();
    el.addEventListener('song-edit-requested', editSpy);
    el.addEventListener('media-selected', selectedSpy);

    editBtn?.click();
    await el.updateComplete;

    expect(editSpy).toHaveBeenCalledTimes(1);
    const event = (editSpy.mock.calls[0] as unknown[])[0] as CustomEvent<{ songKey: string }>;
    expect(event.type).toBe('song-edit-requested');
    expect(event.detail).toEqual({ songKey: 'my-song.mp3' });
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(selectedSpy).not.toHaveBeenCalled();
  });

  it('has NO separate t-butt.edit-btn outside the dropdown (only the dropdown carries edit-btn)', async () => {
    const allEdit = Array.from(el.shadowRoot?.querySelectorAll('.edit-btn') ?? []);
    expect(allEdit).toHaveLength(1);
    expect(allEdit[0].tagName).toBe('T-DROPDOWN-BUTTON');
    expect(el.shadowRoot?.querySelector('t-butt.edit-btn')).toBeNull();
  });
});

describe('t-media dropdown edit — group case (showStatusButton == true)', () => {
  let el: MediaItem;

  beforeEach(async () => {
    el = new MediaItem();
    document.body.appendChild(el);
    el.songKey = 'my-song.mp3';
    el.showStatusButton = true;
    el.hideEditButton = false;
    await el.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
    vi.restoreAllMocks();
  });

  it('renders Status help-tip plus 4 full-width status buttons in order with active on current status', async () => {
    const dropdown = getDropdown(el);
    expect(dropdown).toBeTruthy();
    const box = getStatusBox(el);
    expect(box).toBeTruthy();

    const header = box?.querySelector('t-help-tip');
    expect(header).toBeTruthy();
    expect(header?.getAttribute('h3')).toBe('Status');

    const buttons = statusButtons(box as HTMLElement);
    expect(buttons).toHaveLength(4);
    expect(buttons.map(buttonValue)).toEqual([...GROUP_SONG_STATUS_ORDER]);
    expect(buttons.map(buttonText)).toEqual(
      GROUP_SONG_STATUS_ORDER.map((status) => GROUP_SONG_STATUS_LABELS[status])
    );
    for (const btn of buttons) {
      expect(btn.hasAttribute('full-width')).toBe(true);
    }

    const active = buttons.filter((btn) => btn.hasAttribute('active'));
    expect(active).toHaveLength(1);
    expect(buttonValue(active[0])).toBe(normalizeGroupSongStatus(el.status));
  });

  it('clicking a status button dispatches song-status-changed and closes the dropdown', async () => {
    const dropdown = getDropdown(el) as DropdownButton & { updateComplete: Promise<boolean> };
    expect(dropdown).toBeTruthy();
    const box = getStatusBox(el);
    expect(box).toBeTruthy();

    dropdown.open = true;
    await dropdown.updateComplete;
    await el.updateComplete;

    const statusSpy = vi.fn();
    el.addEventListener('song-status-changed', statusSpy);

    const button = statusButtons(box as HTMLElement).find(
      (btn) => buttonValue(btn) === 'prio'
    ) as HTMLElement | undefined;
    expect(button).toBeTruthy();

    button?.click();
    await el.updateComplete;
    await dropdown.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(statusSpy).toHaveBeenCalledTimes(1);
    const event = (statusSpy.mock.calls[0] as unknown[])[0] as CustomEvent<{
      songKey: string;
      status: string;
    }>;
    expect(event.type).toBe('song-status-changed');
    expect(event.detail).toEqual({ songKey: 'my-song.mp3', status: 'prio' });
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(dropdown.open).toBe(false);
  });

  it('renders .status-remove-row with a confirm Remove from group button', async () => {
    const box = getStatusBox(el);
    expect(box).toBeTruthy();
    const row = box?.querySelector('.status-remove-row') as HTMLElement | null;
    expect(row).toBeTruthy();
    const buttons = Array.from(row?.querySelectorAll('t-butt') ?? []);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].hasAttribute('confirm')).toBe(true);
    expect(buttonText(buttons[0])).toContain('Remove');
  });

  it('renders the edit button INSIDE the same dropdown and it dispatches song-edit-requested', async () => {
    const box = getStatusBox(el);
    expect(box).toBeTruthy();

    const editBtn = editButtonInside(box as HTMLElement) as HTMLElement | null;
    expect(editBtn).toBeTruthy();
    expect(box?.contains(editBtn as Node)).toBe(true);

    const editSpy = vi.fn();
    el.addEventListener('song-edit-requested', editSpy);
    editBtn?.click();
    await el.updateComplete;

    expect(editSpy).toHaveBeenCalledTimes(1);
    const event = (editSpy.mock.calls[0] as unknown[])[0] as CustomEvent<{ songKey: string }>;
    expect(event.detail).toEqual({ songKey: 'my-song.mp3' });
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });
});

describe('t-media dropdown edit — gates (both cases)', () => {
  let el: MediaItem;

  beforeEach(async () => {
    el = new MediaItem();
    document.body.appendChild(el);
    el.songKey = 'my-song.mp3';
    await el.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
    vi.restoreAllMocks();
  });

  it.each([false, true])(
    'renders no dropdown at all when songKey is empty (showStatusButton=%s)',
    async (showStatus: boolean) => {
      el.showStatusButton = showStatus;
      el.hideEditButton = false;
      el.songKey = '';
      await el.updateComplete;

      expect(getDropdown(el)).toBeNull();
      expect(getStatusBox(el)).toBeNull();
    }
  );

  it.each([false, true])(
    'renders no dropdown at all when hideEditButton is true (showStatusButton=%s)',
    async (showStatus: boolean) => {
      el.showStatusButton = showStatus;
      el.hideEditButton = true;
      el.songKey = 'my-song.mp3';
      await el.updateComplete;

      expect(getDropdown(el)).toBeNull();
      expect(getStatusBox(el)).toBeNull();
      expect(el.shadowRoot?.querySelector('.edit-btn')).toBeNull();
    }
  );
});
