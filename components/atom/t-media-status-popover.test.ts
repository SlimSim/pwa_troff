import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaItem } from './t-media.js';
import { THelpTip } from './t-help-tip.js';
import { DropdownButton } from './t-dropdown-button.js';
import './t-butt.js';
import {
  GROUP_SONG_STATUS_LABELS,
  GROUP_SONG_STATUS_ORDER,
  normalizeGroupSongStatus,
} from '../../utils/group-song-status.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * FEATURE SPEC (dropdown polish): t-media status dropdown.
 *
 * - Boolean property `showStatusButton = false`. When
 *   `showStatusButton && songKey && !hideEditButton` a `t-dropdown-button`
 *   (class="edit-btn", position="up") renders to the LEFT of the plain edit
 *   `t-butt`, so the three-dot trigger sits left of the edit icon.
 * - Trigger: `<t-butt icon ghost slot="button" title="Set Status">` with a
 *   `t-icon name="more-vertical"` inside. A click on the trigger must
 *   stopPropagation so the row's `media-selected` never fires.
 * - Dropdown content (`slot="dropdown"`, class="status-box", stays slotted in
 *   the t-media shadow tree — NOT portaled): a `t-help-tip h3="Status"`
 *   header carrying the explanation text, then one `t-butt full-width` per
 *   status in GROUP_SONG_STATUS_ORDER (prio/active/standard/archived) with
 *   the `active` attribute on the button whose value === this.status.
 * - Clicking a status button dispatches `song-status-changed`
 *   (detail `{ songKey, status }`, status normalized via
 *   normalizeGroupSongStatus, bubbles + composed) and CLOSES the
 *   `t-dropdown-button` (`.open = false`).
 * - Default (showStatusButton === false) renders no t-dropdown-button at all.
 *
 * These tests import the ACTUAL component/helpers (never re-implementations).
 * The close-on-select tests FAIL (RED) until `_handleStatusSelect` closes the
 * t-dropdown-button instead of the (now header-only) t-help-tip.
 */

/** Test-only view onto the not-yet-existing `showStatusButton` property. */
type MediaItemWithStatusButton = MediaItem & { showStatusButton: boolean };

function withStatusButton(el: MediaItem): MediaItemWithStatusButton {
  return el as MediaItemWithStatusButton;
}

/**
 * Status value of a dropdown status button: either the `value` attribute or a
 * `value` property (both Lit binding styles are allowed).
 */
function buttonValue(btn: Element): string | null {
  const attr = btn.getAttribute('value');
  if (attr !== null) return attr;
  const prop = (btn as Element & { value?: unknown }).value;
  return typeof prop === 'string' ? prop : null;
}

function buttonText(btn: Element): string {
  return (btn.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const STATUS_VALUES: readonly string[] = GROUP_SONG_STATUS_ORDER;
const STATUS_LABELS: readonly string[] = GROUP_SONG_STATUS_ORDER.map(
  (status) => GROUP_SONG_STATUS_LABELS[status]
);
const STATUS_VALUE_SET: ReadonlySet<string> = new Set(STATUS_VALUES);

describe('t-media status popover', () => {
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

  function getDropdown(): DropdownButton | null {
    return (el.shadowRoot?.querySelector('t-dropdown-button') ?? null) as DropdownButton | null;
  }

  function getStatusBox(): HTMLElement | null {
    return (el.shadowRoot?.querySelector('.status-box') ?? null) as HTMLElement | null;
  }

  function getHelpTip(): THelpTip | null {
    return (el.shadowRoot?.querySelector('t-help-tip') ?? null) as THelpTip | null;
  }

  /**
   * Open the status dropdown (content stays slotted in the t-media shadow
   * tree — no portal) and return it together with its .status-box content.
   */
  async function openStatusDropdown(): Promise<{
    dropdown: DropdownButton;
    content: HTMLElement;
  }> {
    const dropdown = getDropdown();
    if (!dropdown) {
      throw new Error('Expected a t-dropdown-button status trigger in the shadow root');
    }
    dropdown.open = true;
    await dropdown.updateComplete;
    await el.updateComplete;
    const content = getStatusBox();
    if (!content) {
      throw new Error('Expected .status-box dropdown content to stay in the shadow tree');
    }
    return { dropdown, content };
  }

  /** The four status buttons (excludes any non-status button in the box). */
  function statusButtons(content: HTMLElement): Element[] {
    return Array.from(content.querySelectorAll('t-butt')).filter((btn) => {
      const value = buttonValue(btn);
      return value !== null && STATUS_VALUE_SET.has(value);
    });
  }

  describe('showStatusButton gating', () => {
    it('defaults showStatusButton to false and renders no status dropdown', async () => {
      expect(withStatusButton(el).showStatusButton).toBe(false);
      expect(getDropdown()).toBeNull();
      expect(getStatusBox()).toBeNull();
      expect(getHelpTip()).toBeNull();
      expect(el.shadowRoot?.querySelector('.edit-btn')).toBeTruthy();
    });

    it('renders a t-dropdown-button trigger configured for the status popover when showStatusButton is true', async () => {
      withStatusButton(el).showStatusButton = true;
      await el.updateComplete;

      const dropdown = getDropdown();
      expect(dropdown).toBeTruthy();
      expect(dropdown?.classList.contains('edit-btn')).toBe(true);
      expect(dropdown?.getAttribute('position')).toBe('up');

      const trigger = dropdown?.querySelector('t-butt[slot="button"]');
      expect(trigger).toBeTruthy();
      expect(trigger?.getAttribute('title')).toBe('Set Status');
      expect(trigger?.hasAttribute('icon')).toBe(true);
      expect(trigger?.hasAttribute('ghost')).toBe(true);
      expect(trigger?.querySelector('t-icon')?.getAttribute('name')).toBe('more-vertical');
    });

    it('renders no status dropdown when songKey is empty', async () => {
      withStatusButton(el).showStatusButton = true;
      el.songKey = '';
      await el.updateComplete;

      expect(getDropdown()).toBeNull();
      expect(getStatusBox()).toBeNull();
      expect(getHelpTip()).toBeNull();
    });

    it('renders no status dropdown when hideEditButton is true', async () => {
      withStatusButton(el).showStatusButton = true;
      el.hideEditButton = true;
      await el.updateComplete;

      expect(getDropdown()).toBeNull();
      expect(getStatusBox()).toBeNull();
      expect(getHelpTip()).toBeNull();
      expect(el.shadowRoot?.querySelector('.edit-btn')).toBeNull();
    });
  });

  describe('DOM order and click isolation', () => {
    it('renders the status dropdown trigger BEFORE the plain edit button (dots left of edit)', async () => {
      withStatusButton(el).showStatusButton = true;
      await el.updateComplete;

      const editControls = Array.from(el.shadowRoot?.querySelectorAll('.edit-btn') ?? []);
      expect(editControls.length).toBeGreaterThanOrEqual(2);
      expect(editControls[0].tagName).toBe('T-DROPDOWN-BUTTON');
      expect(editControls[1].tagName).toBe('T-BUTT');
    });

    it('keeps the plain .edit-btn t-butt rendered after enabling the status dropdown', async () => {
      withStatusButton(el).showStatusButton = true;
      await el.updateComplete;

      expect(el.shadowRoot?.querySelector('t-butt.edit-btn')).toBeTruthy();
    });

    it('clicking the help-tip header does not dispatch media-selected (stopPropagation)', async () => {
      withStatusButton(el).showStatusButton = true;
      await el.updateComplete;

      const selectedSpy = vi.fn();
      el.addEventListener('media-selected', selectedSpy);

      const tip = getHelpTip() as HTMLElement | null;
      expect(tip).toBeTruthy();

      tip?.click();
      await el.updateComplete;
      expect(selectedSpy).not.toHaveBeenCalled();

      // Positive control: clicking the row itself still selects the media.
      const container = el.shadowRoot?.querySelector('.media-container') as HTMLElement | null;
      expect(container).toBeTruthy();
      container?.click();
      await el.updateComplete;
      expect(selectedSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('dropdown content', () => {
    it('renders the Status help-tip header, an explanation and one full-width button per status, in order', async () => {
      withStatusButton(el).showStatusButton = true;
      await el.updateComplete;

      const { content } = await openStatusDropdown();

      const header = content.querySelector('t-help-tip');
      expect(header).toBeTruthy();
      expect(header?.getAttribute('h3')).toBe('Status');
      expect(header?.getAttribute('position')).toBe('up');
      expect(buttonText(header as Element).toLowerCase()).toContain('status');

      const buttons = statusButtons(content);
      expect(buttons).toHaveLength(4);
      for (const btn of buttons) {
        expect(btn.hasAttribute('full-width')).toBe(true);
      }

      expect(buttons.map(buttonText)).toEqual([...STATUS_LABELS]);
      expect(buttons.map(buttonValue)).toEqual([...STATUS_VALUES]);
    });

    it('sets the active attribute on the button matching the current status (default standard)', async () => {
      withStatusButton(el).showStatusButton = true;
      await el.updateComplete;

      expect(el.status).toBe('standard');
      const { content } = await openStatusDropdown();

      const activeButtons = statusButtons(content).filter((btn) => btn.hasAttribute('active'));
      expect(activeButtons).toHaveLength(1);
      expect(buttonValue(activeButtons[0])).toBe(normalizeGroupSongStatus(el.status));
    });

    it('moves the active attribute when the status changes to prio', async () => {
      withStatusButton(el).showStatusButton = true;
      el.status = 'prio';
      await el.updateComplete;

      const { content } = await openStatusDropdown();

      const activeButtons = statusButtons(content).filter((btn) => btn.hasAttribute('active'));
      expect(activeButtons).toHaveLength(1);
      expect(buttonValue(activeButtons[0])).toBe('prio');
      expect(buttonText(activeButtons[0])).toBe(GROUP_SONG_STATUS_LABELS.prio);
    });
  });

  describe('clicking a status button', () => {
    it.each([...STATUS_VALUES])(
      'dispatches song-status-changed with status "%s" and closes the dropdown',
      async (status) => {
        withStatusButton(el).showStatusButton = true;
        await el.updateComplete;

        const { dropdown, content } = await openStatusDropdown();

        const statusSpy = vi.fn();
        el.addEventListener('song-status-changed', statusSpy);

        const button = statusButtons(content).find((btn) => buttonValue(btn) === status);
        expect(button).toBeTruthy();

        (button as HTMLElement).click();
        await el.updateComplete;
        await dropdown.updateComplete;
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(statusSpy).toHaveBeenCalledTimes(1);
        const event = statusSpy.mock.calls[0][0] as CustomEvent<{
          songKey: string;
          status: string;
        }>;
        expect(event.type).toBe('song-status-changed');
        expect(event.detail).toEqual({ songKey: 'my-song.mp3', status });
        expect(event.detail.status).toBe(normalizeGroupSongStatus(status));
        expect(event.bubbles).toBe(true);
        expect(event.composed).toBe(true);

        // Selecting a status must close the t-dropdown-button itself (the
        // t-help-tip in the shadow root is now only the header help-tip).
        expect(dropdown.open).toBe(false);
      }
    );

    it('keeps the dropdown open when a status button is not clicked (smoke check)', async () => {
      withStatusButton(el).showStatusButton = true;
      await el.updateComplete;

      const { dropdown } = await openStatusDropdown();
      expect(dropdown.open).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Feature spec D: the status dropdown trigger uses assets/icons/more-vertical.svg
// ---------------------------------------------------------------------------

describe('assets/icons/more-vertical.svg', () => {
  const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
  const iconPath = path.join(repoRoot, 'assets', 'icons', 'more-vertical.svg');

  it('exists', () => {
    expect(existsSync(iconPath)).toBe(true);
  });

  it('uses currentColor for fill AND stroke with the standard 24x24 box', () => {
    const svg = readFileSync(iconPath, 'utf8');

    expect(svg).toMatch(/fill="currentColor"/);
    expect(svg).toMatch(/stroke="currentColor"/);
    expect(svg).toMatch(/width="24"/);
    expect(svg).toMatch(/height="24"/);
    expect(svg).toMatch(/viewBox="0 0 24 24"/);
  });

  it('draws three vertical dots', () => {
    const svg = readFileSync(iconPath, 'utf8');

    const shapes = (svg.match(/<(circle|ellipse|rect)\b/g) ?? []).length;
    const pathTags = svg.match(/<path[^>]*\sd\s*=\s*"([^"]*)"/g) ?? [];
    const subpaths = pathTags.reduce((count, tag) => count + (tag.match(/[Mm]/g) ?? []).length, 0);

    expect(shapes + subpaths).toBeGreaterThanOrEqual(3);
  });
});
