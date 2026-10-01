import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroupList } from './t-group-list.js';

/**
 * Regression test: opening a group detail that contains the active song
 * (currentSongKey) must scroll that song's t-media row into view.
 *
 * Follows the existing scroll pattern used in t-track-list.ts /
 * t-artist-list.ts / t-genre-list.ts / t-group-list.ts updated():
 *   highlighted.scrollIntoView({ block: 'nearest' })
 *
 * Bug: t-group-list.updated() only scrolls highlighted items
 * (highlightedIndex / _highlightedIndex), never the active song, and
 * t-media-parent._scrollActiveSongIntoView() only runs on app start and on
 * song-list close — never when a group detail opens. So entering a group
 * leaves the active song off-screen.
 */

describe('t-group-list group-detail active-song scroll', () => {
  let element: GroupList;

  function makeGroups(): GroupList['groups'] {
    return [
      {
        id: 1,
        name: 'Test Group',
        songs: [{ fullPath: 'a' }, { fullPath: 'b' }],
        tracks: [
          { title: 'Song A', songKey: 'a' },
          { title: 'Song B', songKey: 'b' },
        ],
      },
    ] as unknown as GroupList['groups'];
  }

  function findActiveMedia(): HTMLElement | null {
    const rows: Element[] = element.shadowRoot
      ? Array.from(element.shadowRoot.querySelectorAll('t-media'))
      : [];
    for (const row of rows) {
      if ((row as unknown as { active: boolean }).active === true) {
        return row as unknown as HTMLElement;
      }
    }
    return null;
  }

  function ensureScrollIntoViewExists(): void {
    if (typeof HTMLElement.prototype.scrollIntoView !== 'function') {
      HTMLElement.prototype.scrollIntoView = function (): void {};
    }
  }

  beforeEach(() => {
    element = new GroupList();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('scrolls the active song into view when opening a group detail that contains it', async () => {
    element.groups = makeGroups();
    element.tracks = [];
    element.currentSongKey = 'b';
    await element.updateComplete;

    ensureScrollIntoViewExists();
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(function (this: HTMLElement): void {});

    // Public entry point used by both item clicks and t-media-parent.
    element.openGroup('1');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await element.updateComplete;

    const active = findActiveMedia();
    expect(active).not.toBeNull();
    expect(scrollSpy.mock.instances).toContain(active);
    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }));
  });

  it('does not scroll when the active song is not in the opened group', async () => {
    element.groups = makeGroups();
    element.tracks = [];
    element.currentSongKey = 'zzz-not-in-group';
    await element.updateComplete;

    ensureScrollIntoViewExists();
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(function (this: HTMLElement): void {});

    element.openGroup('1');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await element.updateComplete;

    expect(findActiveMedia()).toBeNull();
    expect(scrollSpy).not.toHaveBeenCalled();
  });
});
