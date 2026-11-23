import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ListHeader } from './t-list-header.js';
import { GroupList } from './t-group-list.js';

/**
 * Type-safe view of the detail-view props t-list-header gains in the
 * t-detail-header → t-list-header unification (showBack, syncing, icon,
 * infoText, sharedWithCount, headerColor/headerTextColor/headerBorderColor).
 * The intersection cast keeps this file valid both before (RED) and after the
 * feature lands — no `any`, same pattern as t-detail-header-syncing.test.ts.
 */
type ListHeaderDetailProps = ListHeader & {
  showBack: boolean;
  syncing: boolean;
  icon: string;
  infoText: string;
  sharedWithCount: number;
  headerColor: string;
  headerTextColor: string;
  headerBorderColor: string;
};

const asDetail = (header: ListHeader): ListHeaderDetailProps =>
  header as unknown as ListHeaderDetailProps;

describe('t-list-header', () => {
  let header: ListHeader;

  beforeEach(async () => {
    header = new ListHeader();
    header.title = 'Tracks';
    document.body.appendChild(header);
    await header.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(header)) {
      document.body.removeChild(header);
    }
  });

  // ---- defaults ----

  it('renders the title and the default "# 0" count', () => {
    const shadow = header.shadowRoot;
    expect(shadow?.querySelector('.song-list-title')?.textContent?.trim()).toBe('Tracks');
    expect(shadow?.querySelector('.song-count')?.textContent).toContain('# 0');
  });

  it('renders no back arrow / icon / info text / shared-with / syncing badge by default', () => {
    const shadow = header.shadowRoot;
    expect(shadow?.querySelector('.back-arrow')).toBeNull();
    expect(shadow?.querySelector('.detail-icon')).toBeNull();
    expect(shadow?.querySelector('.detail-info-text')).toBeNull();
    expect(shadow?.querySelector('.shared-with')).toBeNull();
    expect(shadow?.querySelector('.syncing-badge')).toBeNull();
    expect(shadow?.querySelector('t-loading')).toBeNull();
  });

  it('always renders the count as "# N" (count=42 → "# 42") with no gating property', async () => {
    header.count = 42;
    await header.updateComplete;

    const count = header.shadowRoot?.querySelector('.song-count');
    expect(count, 'the count must render without any gating property').toBeTruthy();
    expect(count?.textContent).toContain('# 42');
  });

  // ---- showBack ----

  it('showBack=true renders .back-arrow; clicking it dispatches a bubbling composed "back" event', async () => {
    asDetail(header).showBack = true;
    await header.updateComplete;

    const backArrow = header.shadowRoot?.querySelector('.back-arrow') as HTMLElement | null;
    expect(backArrow, 'expected .back-arrow when showBack=true').toBeTruthy();
    expect(
      backArrow?.querySelector('t-icon[name="chevron-up"]'),
      'expected the chevron-up t-icon inside .back-arrow'
    ).toBeTruthy();

    let received: Event | null = null;
    header.addEventListener('back', (e) => {
      received = e;
    });
    backArrow!.click();

    expect(received, 'expected a "back" event on the host element').toBeTruthy();
    expect(received!.bubbles).toBe(true);
    expect(received!.composed).toBe(true);
  });

  it('renders no .back-arrow by default (showBack=false)', () => {
    expect(header.shadowRoot?.querySelector('.back-arrow')).toBeNull();
  });

  // ---- syncing badge (moved from t-detail-header-syncing.test.ts) ----

  describe('syncing badge', () => {
    beforeEach(async () => {
      header.title = 'My Band';
      await header.updateComplete;
    });

    /** Badge state as observed in the header's shadow root. */
    function getBadgeState() {
      const shadow = header.shadowRoot;
      return {
        loading: shadow?.querySelector('t-loading') ?? null,
        hasSyncingText: /\bsyncing\b/i.test(shadow?.textContent ?? ''),
        title: (shadow?.querySelector('.song-list-title')?.textContent ?? '').trim(),
      };
    }

    it('defaults syncing to false and renders neither t-loading nor the "syncing" text', async () => {
      expect(asDetail(header).syncing).toBe(false);

      const { loading, hasSyncingText, title } = getBadgeState();
      expect(loading).toBeNull();
      expect(hasSyncingText).toBe(false);
      expect(title).toBe('My Band');
    });

    it('syncing=true renders t-loading plus the literal "syncing" text next to the intact title', async () => {
      asDetail(header).syncing = true;
      await header.updateComplete;

      const { loading, hasSyncingText, title } = getBadgeState();
      expect(loading).toBeTruthy();
      expect(hasSyncingText).toBe(true);
      expect(title).toBe('My Band');

      // Spinner and text live together inside a row wrapper (side by side).
      const wrapper = loading?.parentElement ?? null;
      expect(wrapper, 'expected the badge inside a row wrapper').toBeTruthy();
      expect(wrapper?.textContent ?? '').toMatch(/\bsyncing\b/i);
      expect(wrapper?.classList.contains('syncing-badge')).toBe(true);
    });

    it('syncing=false again removes the badge but keeps the title', async () => {
      asDetail(header).syncing = true;
      await header.updateComplete;
      // RED guard: the badge must actually appear before we take it away.
      expect(getBadgeState().loading).toBeTruthy();

      asDetail(header).syncing = false;
      await header.updateComplete;

      const { loading, hasSyncingText, title } = getBadgeState();
      expect(loading).toBeNull();
      expect(hasSyncingText).toBe(false);
      expect(title).toBe('My Band');
    });
  });

  // ---- infoText ----

  it('renders infoText and toggles .expanded on click', async () => {
    asDetail(header).infoText = 'Some info about the group';
    await header.updateComplete;

    const info = header.shadowRoot?.querySelector('.detail-info-text') as HTMLElement | null;
    expect(info, 'expected .detail-info-text when infoText is set').toBeTruthy();
    expect(info?.textContent).toContain('Some info about the group');
    expect(info?.classList.contains('expanded')).toBe(false);

    info!.click();
    expect(info?.classList.contains('expanded')).toBe(true);

    info!.click();
    expect(info?.classList.contains('expanded')).toBe(false);
  });

  // ---- sharedWithCount ----

  it('sharedWithCount renders "Shared with N person/people" only when > 0', async () => {
    asDetail(header).sharedWithCount = 0;
    await header.updateComplete;
    expect(header.shadowRoot?.querySelector('.shared-with')).toBeNull();

    asDetail(header).sharedWithCount = 1;
    await header.updateComplete;
    const one = header.shadowRoot?.querySelector('.shared-with');
    expect(one, 'expected .shared-with when sharedWithCount=1').toBeTruthy();
    expect(one?.textContent).toContain('Shared with 1 person');
    expect(one?.textContent).not.toContain('people');

    asDetail(header).sharedWithCount = 2;
    await header.updateComplete;
    const two = header.shadowRoot?.querySelector('.shared-with');
    expect(two, 'expected .shared-with when sharedWithCount=2').toBeTruthy();
    expect(two?.textContent).toContain('Shared with 2 people');
  });

  // ---- headerColor ----

  it('headerColor drives the inline background-color; empty headerColor applies none', async () => {
    asDetail(header).headerColor = '#123456';
    asDetail(header).headerTextColor = '#ffffff';
    asDetail(header).headerBorderColor = 'rgba(255, 255, 255, 0.3)';
    await header.updateComplete;

    const bar = header.shadowRoot?.querySelector('.song-list-header') as HTMLElement | null;
    expect(bar, 'expected the .song-list-header bar').toBeTruthy();
    const styled = /background-color/.test(bar!.getAttribute('style') ?? '');
    expect(styled, 'expected an inline background-color when headerColor is set').toBe(true);

    asDetail(header).headerColor = '';
    asDetail(header).headerTextColor = '';
    asDetail(header).headerBorderColor = '';
    await header.updateComplete;

    const clearedBar = header.shadowRoot?.querySelector(
      '.song-list-header'
    ) as HTMLElement | null;
    const clearedStyle = clearedBar?.getAttribute('style') ?? '';
    expect(/background-color/.test(clearedStyle)).toBe(false);
  });

  // ---- search focus count collapse ----

  it('isSearchFocused=true adds .search-expanded to .song-count', async () => {
    expect(
      header.shadowRoot?.querySelector('.song-count')?.classList.contains('search-expanded')
    ).toBe(false);

    header.isSearchFocused = true;
    await header.updateComplete;

    expect(
      header.shadowRoot?.querySelector('.song-count')?.classList.contains('search-expanded'),
      '.song-count must collapse when the search is focused'
    ).toBe(true);
    expect(header.hasAttribute('issearchfocused')).toBe(true);
  });

  // ---- sticky bar (the actual bug fix) ----

  it('the .song-list-header bar is sticky (top:0) with an opaque var(--tertiary-color) background', () => {
    const bar = header.shadowRoot?.querySelector('.song-list-header');
    expect(bar, 'expected the .song-list-header bar').toBeTruthy();

    // happy-dom resolves position/top from the shadow styles (verified);
    // var() backgrounds do not resolve, so assert those against the
    // component's own styles text.
    const computed = getComputedStyle(bar as Element);
    expect(computed.position).toBe('sticky');
    expect(computed.top).toMatch(/^0(px)?$/);

    const cssText = (ListHeader.styles as unknown as { cssText: string }).cssText;
    const start = cssText.indexOf('.song-list-header');
    expect(start).toBeGreaterThanOrEqual(0);
    const block = cssText.slice(start, cssText.indexOf('}', start));

    // Opaque default background: --tertiary-color, never the translucent
    // --list-hover-bg (rows would show through the sticky bar).
    expect(block).toMatch(/background-color:\s*var\(--tertiary-color\)/);
    expect(cssText).not.toContain('--list-hover-bg');
  });
});

// ---------------------------------------------------------------------------
// Integration: t-group-list detail view must render the unified t-list-header
// (this is the RED that proves the sticky-header bug fix in the detail view).
// ---------------------------------------------------------------------------

/** Minimal group fixture so the group detail view (and its header) renders. */
const detailViewGroups = [
  {
    id: 1,
    name: 'Test Group',
    songs: [],
    tracks: [{ title: 'Tango', songKey: 'a' }],
  },
];

describe('t-group-list detail view uses the unified t-list-header', () => {
  let element: GroupList;

  beforeEach(async () => {
    element = new GroupList();
    document.body.appendChild(element);

    // Same detail-view setup as t-group-list-sync-status.test.ts: one group
    // whose key (String(id) = '1') matches _selectedGroupKey.
    (element as unknown as { groups: typeof detailViewGroups }).groups = detailViewGroups;
    (element as unknown as { tracks: unknown[] }).tracks = [];
    (element as unknown as { _selectedGroupKey: string })._selectedGroupKey = '1';

    await element.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  function getListHeader(): ListHeader | null {
    return element.shadowRoot?.querySelector('t-list-header') as ListHeader | null;
  }

  it('renders <t-list-header> (not <t-detail-header>) with a sticky .song-list-header bar', async () => {
    const header = getListHeader();
    expect(header, 'Expected t-list-header in the group detail view').toBeTruthy();
    expect(element.shadowRoot?.querySelector('t-detail-header')).toBeNull();

    await header!.updateComplete;
    const bar = header!.shadowRoot?.querySelector('.song-list-header');
    expect(bar, 'expected the .song-list-header bar inside t-list-header').toBeTruthy();

    const computed = getComputedStyle(bar as Element);
    expect(computed.position).toBe('sticky');
    expect(computed.top).toMatch(/^0(px)?$/);

    const cssText = (ListHeader.styles as unknown as { cssText: string }).cssText;
    expect(cssText).toMatch(
      /\.song-list-header[^}]*background-color:\s*var\(--tertiary-color\)/
    );
    expect(cssText).not.toContain('--list-hover-bg');
  });

  it('clicking .back-arrow closes the detail view (group list renders again)', async () => {
    const header = getListHeader();
    expect(header, 'Expected t-list-header in the group detail view').toBeTruthy();
    await header!.updateComplete;

    const backArrow = header!.shadowRoot?.querySelector('.back-arrow') as HTMLElement | null;
    expect(backArrow, 'expected .back-arrow in the detail view header').toBeTruthy();

    backArrow!.click();
    await element.updateComplete;
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.detail-view')).toBeNull();
    expect(element.shadowRoot?.querySelector('.group-list-container')).toBeTruthy();
  });
});
