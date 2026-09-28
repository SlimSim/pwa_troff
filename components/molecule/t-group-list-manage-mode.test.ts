import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GroupList } from './t-group-list.js';

describe('t-group-list manage mode', () => {
  let element: GroupList;

  const libraryTracks = [
    {
      songKey: 'song-in',
      title: 'In Group Song',
      artist: 'In Artist',
      album: 'In Album',
      genre: 'Jazz',
      year: '',
      comment: '',
      duration: '',
      rating: 0,
      tempo: '',
      albumArt: '',
      playsMonth: 0,
      playsTotal: 0,
    },
    {
      songKey: 'song-out',
      title: 'Outside Song',
      artist: 'Out Artist',
      album: 'Out Album',
      genre: 'Jazz',
      year: '',
      comment: '',
      duration: '',
      rating: 0,
      tempo: '',
      albumArt: '',
      playsMonth: 0,
      playsTotal: 0,
    },
  ];

  const inGroupTrack = {
    title: 'In Group Song',
    songKey: 'song-in',
    artist: 'In Artist',
    album: 'In Album',
    genre: 'Jazz',
    year: '',
    comment: '',
    duration: '',
    rating: 0,
    tempo: '',
    albumArt: '',
    playsMonth: 0,
    playsTotal: 0,
  };

  function setupDetail(managementOpen: boolean) {
    (element as any).groups = [
      {
        id: 1,
        name: 'Jazz',
        icon: 'users',
        info: 'info text',
        owners: ['a@x.se'],
        songs: [{ fullPath: 'song-in' }],
        tracks: [{ ...inGroupTrack }],
      },
    ];
    (element as any).tracks = [...libraryTracks];
    (element as any)._selectedGroupKey = '1';
    (element as any)._songManagementOpen = managementOpen;
    (element as any)._addSongQuery = '';
    (element as any)._groupTrackSearch = '';
  }

  function detailView(): HTMLElement | null {
    return element.shadowRoot?.querySelector('.detail-view') as HTMLElement | null;
  }

  function detailHeader(): HTMLElement | null {
    return element.shadowRoot?.querySelector('t-detail-header') as HTMLElement | null;
  }

  function headerActions(): HTMLElement | null {
    return element.shadowRoot?.querySelector('t-header-actions') as HTMLElement | null;
  }

  /** t-media rows for songs already in the group (outside the add-songs list). */
  function inGroupMediaEls(): HTMLElement[] {
    const all = Array.from(
      element.shadowRoot?.querySelectorAll('t-media') ?? []
    ) as HTMLElement[];
    return all.filter((m) => !m.closest('.add-songs-list'));
  }

  /** t-media rows in the add-songs (available library) list. */
  function addSongsMediaEls(): HTMLElement[] {
    const list = element.shadowRoot?.querySelector('.add-songs-list');
    if (!list) return [];
    return Array.from(list.querySelectorAll('t-media')) as HTMLElement[];
  }

  beforeEach(() => {
    element = new GroupList();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  // ---- manage-mode split layout ----

  it('adds a managing class to .detail-view when management is open', async () => {
    setupDetail(true);
    await element.updateComplete;

    const detail = detailView();
    expect(detail).toBeTruthy();
    expect(detail?.classList.contains('managing')).toBe(true);
  });

  it('non-managing detail view has no .managing class and no .manage-tracks wrapper', async () => {
    setupDetail(false);
    await element.updateComplete;

    const detail = detailView();
    expect(detail).toBeTruthy();
    expect(detail?.classList.contains('managing')).toBe(false);
    expect(element.shadowRoot?.querySelector('.manage-tracks')).toBeNull();
  });

  it('wraps in-group tracks in a .manage-tracks scroll region when managing', async () => {
    setupDetail(true);
    await element.updateComplete;

    const region = element.shadowRoot?.querySelector('.manage-tracks') as HTMLElement | null;
    expect(region).toBeTruthy();
    // In-group track rows (and their remove overlays) live inside the region.
    expect(region?.querySelector('t-media')).toBeTruthy();
    expect(region?.querySelector('.track-remove-overlay')).toBeTruthy();

    const cssText = (GroupList.styles as unknown as { cssText: string }).cssText;
    expect(cssText).toContain('.manage-tracks');
    expect(cssText).toMatch(/\.manage-tracks[^}]*overflow-y/);
  });

  it('.add-songs-section is a sibling BELOW .manage-tracks (not nested inside it)', async () => {
    setupDetail(true);
    await element.updateComplete;

    const detail = detailView();
    expect(detail).toBeTruthy();
    const region = detail?.querySelector(':scope > .manage-tracks') as HTMLElement | null;
    const section = detail?.querySelector(':scope > .add-songs-section') as HTMLElement | null;
    expect(region).toBeTruthy();
    expect(section).toBeTruthy();
    // Sibling order: tracks region first, add-songs section below it.
    const children = Array.from(detail?.children ?? []);
    expect(children.indexOf(section as HTMLElement)).toBeGreaterThan(
      children.indexOf(region as HTMLElement)
    );
    // Not nested: the section is not inside the tracks region.
    expect(region?.querySelector('.add-songs-section')).toBeNull();
    expect(region?.querySelector('.add-songs-list')).toBeNull();
  });

  it('keeps manage layout CSS rules (.manage-tracks scroll, .add-songs-section flex, .detail-view.managing column) including height 100% fix', () => {
    const cssText = (GroupList.styles as unknown as { cssText: string }).cssText;

    // desired height 100% propagation for flex children to size correctly
    expect(cssText).toContain(':host(.managing)');
    expect(cssText).toMatch(/:host\(\.managing\)[^}]*height:\s*100%/);
    expect(cssText).toMatch(/\.detail-view\.managing[^}]*height:\s*100%/);

    expect(cssText).toMatch(/\.detail-view\.managing[^}]*flex/);
    expect(cssText).toMatch(/\.detail-view\.managing[^}]*flex-direction:\s*column/);
    expect(cssText).toMatch(/\.manage-tracks[^}]*overflow-y/);
    expect(cssText).toMatch(/\.add-songs-section[^}]*flex/);
    expect(cssText).toMatch(/\.add-songs-section[^}]*min-height/);

    // still has the flex and min-height rules for the children
    expect(cssText).toMatch(/\.manage-tracks[^}]*flex:\s*1/);
    expect(cssText).toMatch(/\.manage-tracks[^}]*min-height:\s*0/);
    expect(cssText).toMatch(/\.add-songs-section[^}]*flex:\s*2/);
    expect(cssText).toMatch(/\.detail-view\.managing \.add-songs-list[^}]*flex:\s*1/);
  });

  it('add-songs rows set slim=true while in-group track rows do not', async () => {
    setupDetail(true);
    await element.updateComplete;

    const addRows = addSongsMediaEls();
    expect(addRows.length).toBeGreaterThan(0);
    for (const media of addRows) {
      expect((media as any).slim).toBe(true);
    }

    const inGroup = inGroupMediaEls();
    expect(inGroup.length).toBeGreaterThan(0);
    for (const media of inGroup) {
      expect((media as any).slim).toBe(false);
    }
  });

  // ---- compact detail header in manage mode ----

  it('rewrites the detail header entityName to "Add / remove songs to <name>" in manage mode', async () => {
    setupDetail(false);
    await element.updateComplete;
    expect((detailHeader() as any)?.entityName).toBe('Jazz');

    setupDetail(true);
    await element.updateComplete;
    expect((detailHeader() as any)?.entityName).toBe('Add / remove songs to Jazz');
  });

  it('hides header icon/info/shared in manage mode but keeps them in normal mode', async () => {
    setupDetail(false);
    await element.updateComplete;
    expect((detailHeader() as any)?.icon).toBe('users');
    expect((detailHeader() as any)?.infoText).toBe('info text');
    expect((detailHeader() as any)?.sharedWithCount).toBe(1);

    setupDetail(true);
    await element.updateComplete;
    expect((detailHeader() as any)?.icon).toBe('');
    expect((detailHeader() as any)?.infoText).toBe('');
    expect((detailHeader() as any)?.sharedWithCount).toBe(0);
  });

  it('compacts t-header-actions in manage mode (no add/edit/sort) but keeps them in normal mode', async () => {
    setupDetail(false);
    await element.updateComplete;
    expect((headerActions() as any)?.addIcon).toBe('note-plus');
    expect((headerActions() as any)?.showEdit).toBe(true);
    expect(headerActions()?.querySelector('slot[name="sort-controls"]')).toBeTruthy();

    setupDetail(true);
    await element.updateComplete;
    expect((headerActions() as any)?.addIcon).toBe('');
    expect((headerActions() as any)?.showEdit).toBe(false);
    expect(headerActions()?.querySelector('slot[name="sort-controls"]')).toBeNull();
  });

  it('keeps search placeholder/value wiring in both modes', async () => {
    setupDetail(false);
    (element as any)._groupTrackSearch = 'foo';
    await element.updateComplete;
    expect((headerActions() as any)?.searchPlaceholder).toBe('Search songs…');
    expect((headerActions() as any)?.searchValue).toBe('foo');

    setupDetail(true);
    (element as any)._groupTrackSearch = 'foo';
    await element.updateComplete;
    expect((headerActions() as any)?.searchPlaceholder).toBe('Search songs…');
    expect((headerActions() as any)?.searchValue).toBe('foo');
  });

  // ---- manage view fits without outer scroll (Fix B) ----

  it('managing view uses height:100% propagation from :host instead of (or in addition to) magic max-height calc', () => {
    const cssText = (GroupList.styles as unknown as { cssText: string }).cssText;

    // now expects height 100% for the flex container to have definite height
    expect(cssText).toMatch(/:host\(\.managing\)[^}]*height:\s*100%/);
    expect(cssText).toMatch(/\.detail-view\.managing[^}]*height:\s*100%/);
    expect(cssText).toMatch(/:host\(\.managing\)[^}]*min-height:\s*0/);
    expect(cssText).toMatch(/\.detail-view\.managing[^}]*min-height:\s*0/);

    // tolerate old max-height calc for transition (may be removed later); do not require the calc specifically
    // but still check the block has the managing rules
    const start = cssText.indexOf('.detail-view.managing');
    expect(start).toBeGreaterThanOrEqual(0);
    const block = cssText.slice(start, cssText.indexOf('}', start));
    expect(block).toMatch(/flex/);
    // no longer assert against height calc; we want height:100% now
  });

  it('Done row never shrinks in managing mode', () => {
    const cssText = (GroupList.styles as unknown as { cssText: string }).cssText;

    expect(cssText).toMatch(
      /\.detail-view\.managing \.manage-toggle-wrap[^}]*flex-shrink:\s*0/
    );
  });

  it('Done toggle is a direct child of .detail-view.managing AFTER .add-songs-section', async () => {
    setupDetail(true);
    await element.updateComplete;

    const detail = detailView();
    expect(detail?.classList.contains('managing')).toBe(true);
    const section = detail?.querySelector(':scope > .add-songs-section') as HTMLElement | null;
    const toggle = detail?.querySelector(':scope > .manage-toggle-wrap') as HTMLElement | null;
    expect(section).toBeTruthy();
    expect(toggle).toBeTruthy();
    expect(toggle?.textContent).toMatch(/Done/);
    const children = Array.from(detail?.children ?? []);
    expect(children.indexOf(toggle as HTMLElement)).toBeGreaterThan(
      children.indexOf(section as HTMLElement)
    );
  });

  it('.add-songs-count sits to the RIGHT of the label in the same header row', async () => {
    setupDetail(true);
    await element.updateComplete;

    const label = element.shadowRoot?.querySelector(
      '.add-songs-label'
    ) as HTMLElement | null;
    const count = element.shadowRoot?.querySelector(
      '.add-songs-count'
    ) as HTMLElement | null;
    expect(label).toBeTruthy();
    expect(count).toBeTruthy();
    expect(label?.textContent?.trim()).toBe('Add songs');
    expect(count?.textContent).toMatch(/showing \d+ of \d+ songs/);

    // Same header row parent, count after label in DOM order.
    expect(label?.parentElement).toBeTruthy();
    expect(label?.parentElement).toBe(count?.parentElement);
    expect(label?.parentElement?.classList.contains('add-songs-header')).toBe(true);
    const siblings = Array.from(label?.parentElement?.children ?? []);
    expect(siblings.indexOf(count as HTMLElement)).toBeGreaterThan(
      siblings.indexOf(label as HTMLElement)
    );

    // The header row parent is a flex row (e.g. .add-songs-header).
    const cssText = (GroupList.styles as unknown as { cssText: string }).cssText;
    expect(cssText).toMatch(/\.add-songs-header[^}]*display:\s*flex/);
  });

  it('.add-songs-section has no bottom padding (padding: 12px 16px 0)', () => {
    const cssText = (GroupList.styles as unknown as { cssText: string }).cssText;

    expect(cssText).toMatch(/\.add-songs-section[^}]*padding-bottom:\s*0/);
  });

  it('.manage-toggle-wrap base rule has no top border', () => {
    const cssText = (GroupList.styles as unknown as { cssText: string }).cssText;

    // Base rule: first `.manage-toggle-wrap` occurrence, before the
    // `.detail-view.managing .manage-toggle-wrap` override.
    const overrideMarker = '.detail-view.managing .manage-toggle-wrap';
    const overrideIndex = cssText.indexOf(overrideMarker);
    const baseIndex = cssText.indexOf('.manage-toggle-wrap');
    expect(baseIndex).toBeGreaterThanOrEqual(0);
    const baseBlock = cssText.slice(
      baseIndex,
      cssText.indexOf('}', baseIndex)
    );
    // Sanity: we sliced the base rule, not the managing override.
    expect(overrideIndex < 0 || baseIndex < overrideIndex).toBe(true);
    expect(baseBlock).not.toContain('border-top');
  });
});
