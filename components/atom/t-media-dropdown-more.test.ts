import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaItem } from './t-media.js';
import type { DropdownButton } from './t-dropdown-button.js';

/**
 * NEW CONTRACT (dropdown "More"): the more-vertical `t-dropdown-button` dropdown
 * (`.status-box[slot=dropdown]`) gains:
 *
 * (a) a plain headline `More` as the VERY FIRST element of the dropdown content
 *     (NOT a `t-help-tip` — help-tips explain statuses; this is just a header
 *     element, e.g. `<h3>` / `.dropdown-header` with text `More`),
 * (b) the song's note (`TroffObjectLocal.info` — new `songInfo: string = ''` prop
 *     on `t-media`), hidden entirely when empty/whitespace-only, with
 *     single-line-ellipsis + click-to-expand behaviour mirroring
 *     `t-detail-header`'s `span.detail-info-text` / `.expanded` pattern
 *     (collapsed: ellipsis single line; click toggles expanded showing full
 *     text; needs its OWN toggle state separate from the existing `expanded`
 *     comment read-more),
 * (c) a marker count line (new `markerCount: number = 0` prop, always rendered
 *     inside the dropdown): RECOMMENDED deterministic format `N marker(s)`
 *     with correct plural — `3 markers` / `1 marker` / `0 markers`.
 *
 * Data plumbing (`formatSongForUI` -> `nrMarkers` -> `.songInfo`/`.markerCount`
 * through the render sites) is the coder's job. This test targets
 * `t-media` props -> UI only.
 *
 * Imports ACTUAL code only (never re-implementations). RED on current code:
 * headline / songInfo / markerCount do not exist yet.
 */

/** Future props on `t-media` (coder adds `@property songInfo/markerCount`). */
type MediaItemWithMore = MediaItem & {
  songInfo: string;
  markerCount: number;
};

function asMore(el: MediaItem): MediaItemWithMore {
  return el as unknown as MediaItemWithMore;
}

function getDropdown(el: MediaItem): DropdownButton | null {
  return (el.shadowRoot?.querySelector('t-dropdown-button') ?? null) as DropdownButton | null;
}

function getStatusBox(el: MediaItem): HTMLElement | null {
  return (el.shadowRoot?.querySelector('.status-box') ?? null) as HTMLElement | null;
}

function boxText(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Find the song-info element inside the dropdown.
 * Preferred: explicit selectors mirroring the `t-detail-header`
 * `span.detail-info-text` pattern. Fallback: leaf element whose text contains
 * the expected info string (excluding buttons / help-tips).
 */
function queryInfoElement(box: Element, expectedText?: string): Element | null {
  const explicit = box.querySelector(
    '[data-song-info], .detail-info-text, .dropdown-info-text, .dropdown-info, .song-info, .media-info-text'
  );
  if (explicit) return explicit;
  if (expectedText) {
    const candidates = Array.from(box.querySelectorAll('span, div, p'));
    for (const c of candidates) {
      if (c.closest('t-butt') !== null || c.closest('t-help-tip') !== null) continue;
      if (c.classList.contains('status-box')) continue;
      const text = c.textContent ?? '';
      if (text.includes(expectedText)) {
        const childHasText = Array.from(c.children).some((ch) =>
          (ch.textContent ?? '').includes(expectedText)
        );
        if (!childHasText) return c;
      }
    }
    for (const c of candidates) {
      if (c.closest('t-butt') !== null || c.closest('t-help-tip') !== null) continue;
      if (c.classList.contains('status-box')) continue;
      if ((c.textContent ?? '').includes(expectedText)) return c;
    }
  }
  return null;
}

/**
 * Find the marker-count line inside the dropdown.
 * Preferred: explicit selectors. Fallback: leaf element mentioning "marker".
 */
function queryMarkerElement(box: Element): Element | null {
  const explicit = box.querySelector(
    '[data-marker-count], .marker-count, .dropdown-markers, .dropdown-marker-count, .song-markers'
  );
  if (explicit) return explicit;
  const candidates = Array.from(box.querySelectorAll('span, div, p'));
  for (const c of candidates) {
    if (c.closest('t-butt') !== null || c.closest('t-help-tip') !== null) continue;
    if (c.classList.contains('status-box')) continue;
    const text = (c.textContent ?? '').toLowerCase();
    if (text.includes('marker')) {
      const childHasMarker = Array.from(c.children).some((ch) =>
        (ch.textContent ?? '').toLowerCase().includes('marker')
      );
      if (!childHasMarker) return c;
    }
  }
  return null;
}

async function makeRow(init?: { songInfo?: string; markerCount?: number }): Promise<MediaItem> {
  const el = new MediaItem();
  document.body.appendChild(el);
  el.songKey = 'my-song.mp3';
  el.hideEditButton = false;
  el.showStatusButton = false;
  const more = asMore(el);
  if (init?.songInfo !== undefined) more.songInfo = init.songInfo;
  if (init?.markerCount !== undefined) more.markerCount = init.markerCount;
  await el.updateComplete;
  return el;
}

describe('t-media dropdown More — headline', () => {
  let el: MediaItem;

  beforeEach(async () => {
    el = await makeRow();
  });

  afterEach(() => {
    if (document.body.contains(el)) document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('first element of .status-box is a plain header with text "More" (not a t-help-tip)', async () => {
    const box = getStatusBox(el);
    expect(box).toBeTruthy();
    const first = box?.firstElementChild ?? null;
    expect(first).toBeTruthy();
    expect(boxText(first)).toBe('More');
    expect(first?.tagName).not.toBe('T-HELP-TIP');
  });

  it.each([false, true])(
    'headline is first even in group case (showStatusButton=%s)',
    async (showStatus: boolean) => {
      el.showStatusButton = showStatus;
      await el.updateComplete;
      const box = getStatusBox(el);
      expect(box).toBeTruthy();
      const first = box?.firstElementChild ?? null;
      expect(first).toBeTruthy();
      expect(boxText(first)).toBe('More');
      expect(first?.tagName).not.toBe('T-HELP-TIP');
    }
  );
});

describe('t-media dropdown More — new props exist with defaults', () => {
  let el: MediaItem;

  beforeEach(async () => {
    el = await makeRow();
  });

  afterEach(() => {
    if (document.body.contains(el)) document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('exposes songInfo="" and markerCount=0 by default', async () => {
    const more = asMore(el);
    expect(more.songInfo).toBe('');
    expect(more.markerCount).toBe(0);
  });
});

describe('t-media dropdown More — song info hidden when empty', () => {
  let el: MediaItem;

  afterEach(() => {
    if (el && document.body.contains(el)) document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it.each(['', '   ', '\n\t  '])('renders no info element when songInfo=%j', async (value: string) => {
    el = await makeRow({ songInfo: value, markerCount: 0 });
    const box = getStatusBox(el);
    expect(box).toBeTruthy();
    expect(queryInfoElement(box as HTMLElement)).toBeNull();
  });
});

describe('t-media dropdown More — song info expand/collapse', () => {
  const NOTE = 'A quiet waltz note for testing the dropdown info row';
  let el: MediaItem;

  beforeEach(async () => {
    el = await makeRow({ songInfo: NOTE, markerCount: 0 });
  });

  afterEach(() => {
    if (document.body.contains(el)) document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('shows the full info text, initially collapsed (ellipsis class, NOT expanded)', async () => {
    const box = getStatusBox(el);
    expect(box).toBeTruthy();
    const infoEl = queryInfoElement(box as HTMLElement, NOTE) as HTMLElement | null;
    expect(infoEl).toBeTruthy();
    expect(boxText(infoEl)).toContain(NOTE);
    // Collapsed single-line: has an ellipsis/info class, NOT the expanded state.
    expect(infoEl?.classList.contains('expanded')).toBe(false);
    expect(infoEl?.getAttribute('class') ?? '').toMatch(/info|ellipsis|truncate/i);
  });

  it('click toggles expanded, click again collapses', async () => {
    const box = getStatusBox(el);
    const infoEl = queryInfoElement(box as HTMLElement, NOTE) as HTMLElement | null;
    expect(infoEl).toBeTruthy();
    if (infoEl === null) return;

    infoEl.click();
    await el.updateComplete;
    expect(infoEl.classList.contains('expanded')).toBe(true);

    infoEl.click();
    await el.updateComplete;
    expect(infoEl.classList.contains('expanded')).toBe(false);
  });

  it('info toggle uses its OWN state — row comment `expanded` read-more is untouched', async () => {
    // Long comment so the row itself renders a "... read more" control.
    el.comment = 'Row comment ' + 'x'.repeat(200);
    await el.updateComplete;
    const box = getStatusBox(el);
    const infoEl = queryInfoElement(box as HTMLElement, NOTE) as HTMLElement | null;
    expect(infoEl).toBeTruthy();
    if (infoEl === null) return;

    expect(el.expanded).toBe(false);
    const readMoreBefore = boxText(el.shadowRoot?.querySelector('.media-details') ?? null);
    expect(readMoreBefore).toContain('read more');

    infoEl.click();
    await el.updateComplete;

    // Info expanded, but the row-level comment state must not flip.
    expect(infoEl.classList.contains('expanded')).toBe(true);
    expect(el.expanded).toBe(false);
    const detailsText = boxText(el.shadowRoot?.querySelector('.media-details') ?? null);
    expect(detailsText).toContain('read more');
    expect(detailsText).not.toContain('read less');

    infoEl.click();
    await el.updateComplete;
    expect(infoEl.classList.contains('expanded')).toBe(false);
    expect(el.expanded).toBe(false);
  });
});

describe('t-media dropdown More — marker count', () => {
  let el: MediaItem;

  afterEach(() => {
    if (el && document.body.contains(el)) document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it.each([
    [3, '3 markers'],
    [2, '2 markers'],
    [1, '1 marker'],
    [0, '0 markers'],
  ])('markerCount=%i renders %j (songInfo empty)', async (count: number, expected: string) => {
    el = await makeRow({ songInfo: '', markerCount: count });
    const box = getStatusBox(el);
    expect(box).toBeTruthy();
    const markerEl = queryMarkerElement(box as HTMLElement);
    expect(markerEl).toBeTruthy();
    expect(boxText(markerEl)).toContain(expected);
  });

  it('with info present, BOTH the info row and the marker row show', async () => {
    const NOTE = 'Both rows visible note';
    el = await makeRow({ songInfo: NOTE, markerCount: 3 });
    const box = getStatusBox(el);
    expect(box).toBeTruthy();
    const infoEl = queryInfoElement(box as HTMLElement, NOTE);
    expect(infoEl).toBeTruthy();
    expect(boxText(infoEl)).toContain(NOTE);
    const markerEl = queryMarkerElement(box as HTMLElement);
    expect(markerEl).toBeTruthy();
    expect(boxText(markerEl)).toContain('3 markers');
  });
});

describe('t-media dropdown More — gates (inside existing dropdown gate)', () => {
  let el: MediaItem;

  beforeEach(async () => {
    el = new MediaItem();
    document.body.appendChild(el);
    el.songKey = 'my-song.mp3';
    await el.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(el)) document.body.removeChild(el);
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
    }
  );
});
