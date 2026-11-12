// FEATURE SPEC — regression tests for the collapsed group "Add / Remove
// songs" manage mode (bug: neither the in-group song list nor the "Add
// songs" list is visible; the Done button overlaps other content).
//
// Root cause encoded here (the height chain must stay definite):
//   t-group-list `:host(.managing) { height: 100% }` resolves against its
//   light-DOM parent `.local-songs-content` in t-media-parent. With no height
//   on that parent, height:100% → auto → `.detail-view.managing`'s flex
//   column gets an indefinite height and `.manage-tracks` /
//   `.add-songs-section` (flex-basis: 0 + min-height: 0) collapse to ~0px.
//
// The fix this file encodes (RED against current code):
//   1. MediaParent gains a plain `.local-songs-content { height: 100% }` rule.
//   2. GroupList's shared overlay rule loses `opacity`/`transition`, the
//      `:hover { opacity: 1 }` rule is gone entirely, and both overlay
//      buttons become plain `ghost` t-butt icon buttons (the t-media
//      in-row `<t-butt icon ghost slot="button">` pattern).
//
// Preserved behaviour is asserted too (GREEN on current code): the split-pane
// flex design, in-group rows + remove overlays, sibling order of
// .manage-tracks → .add-songs-section → .manage-toggle-wrap, and the click
// handlers (incl. the t-butt confirm gate).
//
// NOTE: vitest + happy-dom has NO layout engine — layout is asserted via the
// component stylesheet text (`styles.cssText`) and shadow-DOM
// structure/attributes only, never via computed box sizes.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroupList } from './t-group-list.js';
import { MediaParent } from './t-media-parent.js';

// ---------------------------------------------------------------------------
// Mocks — MediaParent instantiation must never touch real nDB / Firebase.
// (Same pattern as t-media-parent-add-dropdown.test.ts.)
// ---------------------------------------------------------------------------

const nDBStore = new Map<string, unknown>();

vi.mock('../../assets/internal/db.js', () => ({
  nDB: {
    get: vi.fn((key: string) => nDBStore.get(key) ?? null),
    set: vi.fn((key: string, value: unknown) => {
      nDBStore.set(key, value);
    }),
    setOnSong: vi.fn(),
    delete: vi.fn((key: string) => {
      nDBStore.delete(key);
    }),
  },
}));

const firebaseMocks = vi.hoisted(() => ({
  db: {},
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  getDocs: vi.fn(async (_ref: unknown) => ({ docs: [] })),
}));

vi.mock('../../services/firebaseClient.js', () => firebaseMocks);

// ---------------------------------------------------------------------------
// Helpers (cssText assertions follow the repo precedent from
// t-group-list-manage-mode.test.ts / t-media-status-remove.test.ts)
// ---------------------------------------------------------------------------

/** The component stylesheet as text. */
function cssTextOf(component: { styles: unknown }): string {
  return (component.styles as { cssText: string }).cssText;
}

interface CssRule {
  selectors: string[];
  declarations: string;
}

/**
 * Split a stylesheet into rules. CSS comments are stripped first so a comment
 * sitting above a rule does not leak into its selector list. Nested @media
 * blocks yield their inner rules (the @media wrapper itself never matches
 * because its body contains braces), which is all we need here.
 */
function ruleBlocks(cssText: string): CssRule[] {
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withoutComments)) !== null) {
    const selectors = match[1]
      .split(',')
      .map((selector) => selector.trim())
      .filter((selector) => selector.length > 0);
    rules.push({ selectors, declarations: match[2] });
  }
  return rules;
}

/** Declaration body of the rule whose selector list contains `selector` exactly. */
function declarationsOf(cssText: string, selector: string): string | undefined {
  return ruleBlocks(cssText).find((rule) => rule.selectors.includes(selector))?.declarations;
}

/** Property names declared by a rule body (values ignored). */
function declaredProperties(declarations: string): string[] {
  return declarations
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.includes(':'))
    .map((declaration) => declaration.split(':')[0].trim())
    .filter((property) => property.length > 0);
}

/** Every rule that targets a track overlay (shared or hover variant). */
function overlayRules(cssText: string): CssRule[] {
  return ruleBlocks(cssText).filter((rule) =>
    rule.selectors.some(
      (selector) =>
        selector.includes('.track-remove-overlay') || selector.includes('.track-add-overlay')
    )
  );
}

// ---------------------------------------------------------------------------
// 1. The broken link in the height chain: .local-songs-content (t-media-parent)
// ---------------------------------------------------------------------------

describe('t-media-parent: definite height chain for group manage mode', () => {
  let element: MediaParent;

  it(
    'defines a plain `.local-songs-content { height: 100% }` rule (the link t-group-list height:100% resolves against)',
    () => {
      const cssText = cssTextOf(MediaParent);
      const block = ruleBlocks(cssText).find(
        (rule) =>
          rule.selectors.includes('.local-songs-content') &&
          /height:\s*100%/.test(rule.declarations)
      );
      expect(
        block,
        'MediaParent must define `.local-songs-content { height: 100% }`; without it ' +
          't-group-list :host(.managing) height:100% resolves to auto, the ' +
          '.detail-view.managing flex column gets an indefinite height, and ' +
          '.manage-tracks / .add-songs-section collapse to ~0px'
      ).toBeDefined();
    }
  );

  it('renders t-group-list inside .local-songs-content (the element whose height must be definite)', async () => {
    nDBStore.clear();
    // Skip real _loadSongs (touches nDB/Cache) and the scroll timer.
    vi.spyOn(
      MediaParent.prototype as unknown as { _loadSongs: () => Promise<void> },
      '_loadSongs'
    ).mockResolvedValue(undefined);
    vi.spyOn(
      MediaParent.prototype as unknown as { _scrollActiveSongIntoView: () => void },
      '_scrollActiveSongIntoView'
    ).mockImplementation(() => {});

    element = new MediaParent();
    document.body.appendChild(element);

    try {
      // Seed minimal state so the groups tab renders the group list.
      Object.assign(element, {
        songs: [{ songKey: 'song-in', title: 'In Group Song' }],
        groups: [{ id: 1, name: 'Jazz', songs: [{ fullPath: 'song-in' }], tracks: [] }],
        currentFilter: 'groups',
        searchQuery: '',
      });

      await element.updateComplete;
      await element.updateComplete;

      const localContent = element.shadowRoot?.querySelector(
        '.local-songs-content'
      ) as HTMLElement | null;
      expect(localContent).toBeTruthy();
      expect(localContent?.classList.contains('hidden-in-online-mode')).toBe(false);
      expect(localContent?.querySelector('t-group-list')).toBeTruthy();
    } finally {
      if (document.body.contains(element)) {
        document.body.removeChild(element);
      }
      vi.restoreAllMocks();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. GroupList manage mode: overlay buttons + layout contract
// ---------------------------------------------------------------------------

describe('t-group-list manage mode: overlay buttons + layout contract', () => {
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
    Object.assign(element, {
      groups: [
        {
          id: 1,
          name: 'Jazz',
          icon: 'users',
          info: 'info text',
          owners: ['a@x.se'],
          songs: [{ fullPath: 'song-in' }],
          tracks: [{ ...inGroupTrack }],
        },
      ],
      tracks: [...libraryTracks],
      _selectedGroupKey: '1',
      _songManagementOpen: managementOpen,
      _addSongQuery: '',
      _groupTrackSearch: '',
    });
  }

  function detailView(): HTMLElement | null {
    return element.shadowRoot?.querySelector('.detail-view') as HTMLElement | null;
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

  // ---- overlay button styling (the RED fix assertions) ----

  it('overlay rules carry no opacity/transition declarations (buttons are plain, always visible)', () => {
    const cssText = cssTextOf(GroupList);
    const rules = overlayRules(cssText);
    expect(rules.length).toBeGreaterThan(0);

    for (const rule of rules) {
      const properties = declaredProperties(rule.declarations);
      const label = `rule [${rule.selectors.join(', ')}]`;
      expect(properties, `${label} must not declare opacity`).not.toContain('opacity');
      expect(properties, `${label} must not declare transition`).not.toContain('transition');
    }
  });

  it('has no :hover opacity rule for the track overlays (the separate hover rule is gone)', () => {
    const cssText = cssTextOf(GroupList);
    const hoverSelectors = ruleBlocks(cssText)
      .flatMap((rule) => rule.selectors)
      .filter(
        (selector) =>
          selector.includes(':hover') &&
          (selector.includes('.track-remove-overlay') ||
            selector.includes('.track-add-overlay'))
      );
    expect(
      hoverSelectors,
      'overlay :hover opacity rules must be gone — the buttons are plain ghost buttons'
    ).toEqual([]);
  });

  it('keeps the shared overlay positioning rule (absolute, right 4px, top/bottom 0, flex, center)', () => {
    const cssText = cssTextOf(GroupList);
    const rule = ruleBlocks(cssText).find(
      (candidate) =>
        candidate.selectors.includes('.track-remove-overlay') &&
        candidate.selectors.includes('.track-add-overlay')
    );
    expect(rule, 'shared .track-remove-overlay/.track-add-overlay rule must exist').toBeDefined();

    const declarations = rule?.declarations ?? '';
    expect(declarations).toMatch(/position:\s*absolute/);
    expect(declarations).toMatch(/right:\s*4px/);
    expect(declarations).toMatch(/top:\s*0(?:px)?\b/);
    expect(declarations).toMatch(/bottom:\s*0(?:px)?\b/);
    expect(declarations).toMatch(/display:\s*flex/);
    expect(declarations).toMatch(/align-items:\s*center/);
  });

  // ---- preserved split-pane layout (must not regress with the fix) ----

  it('keeps the split-pane manage layout CSS (definite heights, flex column, 1:2 split)', () => {
    const cssText = cssTextOf(GroupList);

    const host = declarationsOf(cssText, ':host(.managing)');
    expect(host).toBeDefined();
    expect(host).toMatch(/height:\s*100%/);
    expect(host).toMatch(/min-height:\s*0/);

    const detail = declarationsOf(cssText, '.detail-view.managing');
    expect(detail).toBeDefined();
    expect(detail).toMatch(/display:\s*flex/);
    expect(detail).toMatch(/flex-direction:\s*column/);
    expect(detail).toMatch(/height:\s*100%/);
    expect(detail).toMatch(/min-height:\s*0/);

    const tracks = declarationsOf(cssText, '.manage-tracks');
    expect(tracks).toBeDefined();
    expect(tracks).toMatch(/flex:\s*1\s+1\s+0/);
    expect(tracks).toMatch(/min-height:\s*0/);
    expect(tracks).toMatch(/overflow-y:\s*auto/);

    const section = declarationsOf(cssText, '.add-songs-section');
    expect(section).toBeDefined();
    expect(section).toMatch(/flex:\s*2\s+1\s+0/);
    expect(section).toMatch(/min-height:\s*0/);
  });

  // ---- preserved DOM structure ----

  it('keeps in-group songs rendered as .track-row rows with a .track-remove-overlay in manage mode', async () => {
    setupDetail(true);
    await element.updateComplete;

    const rows = Array.from(
      element.shadowRoot?.querySelectorAll('.manage-tracks .track-row') ?? []
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelector('t-media'), 'in-group row keeps its t-media').toBeTruthy();
      expect(
        row.querySelector('.track-remove-overlay'),
        'in-group row keeps its remove overlay (the "Remove" half of Add / Remove songs)'
      ).toBeTruthy();
    }
  });

  it('keeps sibling order: .manage-tracks, then .add-songs-section, then .manage-toggle-wrap (Done)', async () => {
    setupDetail(true);
    await element.updateComplete;

    const detail = detailView();
    expect(detail).toBeTruthy();
    expect(detail?.classList.contains('managing')).toBe(true);

    const region = detail?.querySelector(':scope > .manage-tracks');
    const section = detail?.querySelector(':scope > .add-songs-section');
    const toggle = detail?.querySelector(':scope > .manage-toggle-wrap');
    expect(region).toBeTruthy();
    expect(section).toBeTruthy();
    expect(toggle).toBeTruthy();

    const children = Array.from(detail?.children ?? []);
    expect(children.indexOf(section as Element)).toBeGreaterThan(children.indexOf(region as Element));
    expect(children.indexOf(toggle as Element)).toBeGreaterThan(
      children.indexOf(section as Element)
    );
  });

  // ---- overlay buttons: ghost t-butt (the RED fix assertions) ----

  it('remove overlay button is a plain ghost t-butt icon button (keeps confirm/title)', async () => {
    setupDetail(true);
    await element.updateComplete;

    const btn = element.shadowRoot?.querySelector(
      '.track-remove-overlay t-butt'
    ) as HTMLElement | null;
    expect(btn, 'remove overlay must contain a t-butt').toBeTruthy();
    expect(btn?.hasAttribute('icon')).toBe(true);
    expect(
      btn?.hasAttribute('ghost'),
      'remove overlay button must be a ghost t-butt (t-media in-row pattern)'
    ).toBe(true);
    expect(btn?.hasAttribute('confirm')).toBe(true);
    expect(btn?.getAttribute('confirmText')).toBe('Remove?');
    expect(btn?.getAttribute('title')).toBe('Remove from group');
    expect(btn?.querySelector('t-icon[name="delete"]')).toBeTruthy();
  });

  it('add overlay button is a plain ghost t-butt icon button titled "Add to group"', async () => {
    setupDetail(true);
    await element.updateComplete;

    const btn = element.shadowRoot?.querySelector(
      '.track-add-overlay t-butt'
    ) as HTMLElement | null;
    expect(btn, 'add overlay must contain a t-butt').toBeTruthy();
    expect(btn?.hasAttribute('icon')).toBe(true);
    expect(
      btn?.hasAttribute('ghost'),
      'add overlay button must be a ghost t-butt (t-media in-row pattern)'
    ).toBe(true);
    expect(btn?.getAttribute('title')).toBe('Add to group');
    expect(btn?.querySelector('t-icon[name="note-plus"]')).toBeTruthy();
  });

  // ---- preserved click handlers ----

  it('remove button: first click only enters confirm state, second click calls _handleRemoveSong(songKey)', async () => {
    setupDetail(true);
    await element.updateComplete;

    const btn = element.shadowRoot?.querySelector('.track-remove-overlay t-butt') as
      | (HTMLElement & { shadowRoot: ShadowRoot; updateComplete: Promise<boolean> })
      | null;
    expect(btn).toBeTruthy();
    const innerButton = btn?.shadowRoot.querySelector('button') as HTMLElement | null;
    expect(innerButton).toBeTruthy();

    const removeSpy = vi.fn();
    Object.assign(element, { _handleRemoveSong: removeSpy });

    // First click — t-butt confirm gate, no handler yet.
    innerButton?.click();
    await btn?.updateComplete;
    expect(btn?.shadowRoot.querySelector('.confirm-text')).toBeTruthy();
    expect(removeSpy).not.toHaveBeenCalled();

    // Second click — confirmed, handler fires with the in-group songKey.
    innerButton?.click();
    await element.updateComplete;
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith('song-in');
  });

  it('add button click calls _handleAddSong exactly once (row click handler does not double-fire)', async () => {
    setupDetail(true);
    await element.updateComplete;

    const addSpy = vi.fn();
    Object.assign(element, { _handleAddSong: addSpy });

    const btn = element.shadowRoot?.querySelector('.track-add-overlay t-butt') as
      | HTMLElement
      | null;
    expect(btn).toBeTruthy();

    btn?.click();
    await element.updateComplete;
    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith('song-out', 'Outside Song');
  });
});
