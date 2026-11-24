import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TROFF_SETTING_CLEAR_SEARCH_ON_SELECT } from '../constants/constants.js';
import { SettingsPanel } from '../components/molecule/t-settings-panel.js';
import { MediaParent } from '../components/molecule/t-media-parent.js';
import { ArtistList } from '../components/molecule/t-artist-list.js';
import { GenreList } from '../components/molecule/t-genre-list.js';
import { GroupList } from '../components/molecule/t-group-list.js';

// Mock nDB — never touch real services in tests (vi.hoisted: factory is hoisted).
const { nDBGetMock, nDBSetMock } = vi.hoisted(() => ({
  nDBGetMock: vi.fn(),
  nDBSetMock: vi.fn(),
}));
vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: nDBGetMock,
    set: nDBSetMock,
    setOnSong: vi.fn(),
  },
}));

interface PanelInternals {
  clearSearchOnSelect: boolean;
  _toggleSetting: (setting: string, currentValue: boolean) => void;
}

interface MediaParentInternals {
  searchQuery: string;
  songs: unknown[];
  groups: unknown[];
  currentFilter: string;
  _loadSongs: () => Promise<void>;
  _scrollActiveSongIntoView: () => void;
}

interface ArtistListInternals {
  _artistTrackSearch: string;
  clearDetailSearch: () => void;
}

interface GenreListInternals {
  _genreTrackSearch: string;
  clearDetailSearch: () => void;
}

interface GroupListInternals {
  _groupTrackSearch: string;
  clearDetailSearch: () => void;
}

function selectSong(target: EventTarget): void {
  target.dispatchEvent(
    new CustomEvent('media-selected', {
      detail: { songKey: 'a' },
      bubbles: true,
      composed: true,
    })
  );
}

describe('"Clear search on select" setting', () => {
  it('uses a dedicated nDB key', () => {
    expect(TROFF_SETTING_CLEAR_SEARCH_ON_SELECT).toBe('TROFF_SETTING_CLEAR_SEARCH_ON_SELECT');
  });

  describe('Advanced Settings UI', () => {
    let panel: SettingsPanel;

    beforeEach(async () => {
      nDBGetMock.mockReset();
      nDBSetMock.mockReset();
      nDBGetMock.mockReturnValue(null);
      panel = new SettingsPanel();
      document.body.appendChild(panel);
      await panel.updateComplete;
    });

    afterEach(() => {
      if (document.body.contains(panel)) {
        document.body.removeChild(panel);
      }
    });

    it('defaults clearSearchOnSelect to true', () => {
      expect((panel as unknown as PanelInternals).clearSearchOnSelect).toBe(true);
    });

    it('renders a toggle labelled "Clear search on select" inside Advanced Settings', () => {
      const advanced = panel.shadowRoot?.querySelector('t-details[title="Advanced Settings"]');
      expect(advanced, 'expected an "Advanced Settings" details block').toBeTruthy();
      const labels = Array.from(advanced?.querySelectorAll('t-butt') ?? []).map((b) =>
        (b.textContent ?? '').trim().toLowerCase()
      );
      expect(labels).toContain('clear search on select');
    });

    it('toggles the setting and dispatches setting-changed', () => {
      const handler = vi.fn();
      panel.addEventListener('setting-changed', handler);
      (panel as unknown as PanelInternals)._toggleSetting('clearSearchOnSelect', true);
      expect((panel as unknown as PanelInternals).clearSearchOnSelect).toBe(false);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'clearSearchOnSelect', value: false },
        })
      );
    });
  });

  describe('song selection clears the search fields', () => {
    let element: MediaParent;

    beforeEach(() => {
      nDBGetMock.mockReset();
      nDBSetMock.mockReset();
      nDBGetMock.mockReturnValue(null);

      const internals = MediaParent.prototype as unknown as MediaParentInternals;
      vi.spyOn(internals, '_loadSongs').mockResolvedValue(undefined);
      vi.spyOn(internals, '_scrollActiveSongIntoView').mockImplementation(() => {});

      element = new MediaParent();
      document.body.appendChild(element);

      const elementInternals = element as unknown as MediaParentInternals;
      elementInternals.songs = [{ songKey: 'a', title: 'Tango', artist: 'Alice', genre: 'Tango' }];
      elementInternals.groups = [];
      elementInternals.currentFilter = 'tracks';
    });

    afterEach(() => {
      if (document.body.contains(element)) {
        document.body.removeChild(element);
      }
      vi.restoreAllMocks();
    });

    it('clears the main search query when a song is selected (default true)', async () => {
      (element as unknown as MediaParentInternals).searchQuery = 'tan';
      await element.updateComplete;

      selectSong(element);
      await element.updateComplete;

      expect(element.searchQuery).toBe('');
    });

    it('keeps the main search query when the setting is false', async () => {
      nDBGetMock.mockImplementation((key: string) =>
        key === TROFF_SETTING_CLEAR_SEARCH_ON_SELECT ? false : null
      );
      (element as unknown as MediaParentInternals).searchQuery = 'tan';
      await element.updateComplete;

      selectSong(element);
      await element.updateComplete;

      expect(element.searchQuery).toBe('tan');
    });

    it('clears the artist detail track search when a song is selected', async () => {
      const elementInternals = element as unknown as MediaParentInternals;
      elementInternals.currentFilter = 'artists';
      await element.updateComplete;

      const artistList = element.shadowRoot?.querySelector('t-artist-list');
      expect(artistList, 'expected a rendered t-artist-list').toBeTruthy();
      (artistList as unknown as ArtistListInternals)._artistTrackSearch = 'tan';

      selectSong(element);
      await element.updateComplete;

      expect((artistList as unknown as ArtistListInternals)._artistTrackSearch).toBe('');
    });
  });

  describe('detail list clear API', () => {
    it('clears the artist detail search', () => {
      const list = new ArtistList();
      const internals = list as unknown as ArtistListInternals;
      internals._artistTrackSearch = 'foo';
      internals.clearDetailSearch();
      expect(internals._artistTrackSearch).toBe('');
    });

    it('clears the genre detail search', () => {
      const list = new GenreList();
      const internals = list as unknown as GenreListInternals;
      internals._genreTrackSearch = 'foo';
      internals.clearDetailSearch();
      expect(internals._genreTrackSearch).toBe('');
    });

    it('clears the group detail search', () => {
      const list = new GroupList();
      const internals = list as unknown as GroupListInternals;
      internals._groupTrackSearch = 'foo';
      internals.clearDetailSearch();
      expect(internals._groupTrackSearch).toBe('');
    });
  });
});
