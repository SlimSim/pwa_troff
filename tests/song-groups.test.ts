import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Header } from '../components/molecule/t-header.js';
import type {
  TroffFirebaseGroupIdentifyer,
  TroffFirebaseSongIdentifyer,
} from '../types/troff.d.js';

// ---------------------------------------------------------------------------
// Mock nDB before importing the module under test (utils/song-groups.js does
// not exist yet — importing it in beforeEach is the expected RED).
// ---------------------------------------------------------------------------

const nDBStore: Record<string, unknown> = {};

vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: vi.fn((key: string) => nDBStore[key]),
    set: vi.fn((key: string, value: unknown) => {
      nDBStore[key] = value;
    }),
    setOnSong: vi.fn(),
  },
}));

// `groupNames` does not exist on Header yet — cast keeps tsc green until the
// production property lands.
type HeaderWithGroups = Header & { groupNames: string[] };

// `selectedGroupName` does not exist on Header yet either — same cast trick.
type HeaderWithSelectedGroup = Header & { groupNames: string[]; selectedGroupName: string };

const song = (fullPath: string): TroffFirebaseSongIdentifyer => ({
  fullPath,
  galleryId: 'gallery-1',
});

const group = (overrides: Partial<TroffFirebaseGroupIdentifyer>): TroffFirebaseGroupIdentifyer => ({
  name: 'Group',
  firebaseGroupDocId: 'doc1',
  songs: [],
  ...overrides,
});

let getGroupNamesForSong: (songKey: string) => string[];
let updateHeaderGroupsWithCurrentSong: () => void;
let getSelectedGroupName: () => string;

const mountHeader = (): Header => {
  const header = new Header();
  header.id = 'header';
  document.body.appendChild(header);
  return header;
};

describe('song-groups', () => {
  beforeEach(async () => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((key) => delete nDBStore[key]);
    const songGroups = await import('../utils/song-groups.js');
    getGroupNamesForSong = songGroups.getGroupNamesForSong;
    updateHeaderGroupsWithCurrentSong = songGroups.updateHeaderGroupsWithCurrentSong;
    getSelectedGroupName = songGroups.getSelectedGroupName;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('getGroupNamesForSong', () => {
    it('returns [] when aoSongLists is missing', () => {
      expect(getGroupNamesForSong('song.mp3')).toEqual([]);
    });

    it('returns [] when aoSongLists is empty', () => {
      nDBStore['aoSongLists'] = [];
      expect(getGroupNamesForSong('song.mp3')).toEqual([]);
    });

    it('returns [] when no group contains the song', () => {
      nDBStore['aoSongLists'] = [
        group({ name: 'Band', songs: [song('other.mp3')] }),
      ];
      expect(getGroupNamesForSong('song.mp3')).toEqual([]);
    });

    it('excludes groups without firebaseGroupDocId even when they contain the song', () => {
      nDBStore['aoSongLists'] = [
        group({
          name: 'Local only',
          firebaseGroupDocId: undefined,
          songs: [song('song.mp3')],
        }),
      ];
      expect(getGroupNamesForSong('song.mp3')).toEqual([]);
    });

    it('returns shared group names in aoSongLists order, skipping local groups', () => {
      nDBStore['aoSongLists'] = [
        group({ name: 'First', firebaseGroupDocId: 'd1', songs: [song('song.mp3')] }),
        group({
          name: 'Local',
          firebaseGroupDocId: undefined,
          songs: [song('song.mp3')],
        }),
        group({ name: 'Second', firebaseGroupDocId: 'd2', songs: [song('song.mp3')] }),
        group({ name: 'Unrelated', firebaseGroupDocId: 'd3', songs: [song('other.mp3')] }),
      ];
      expect(getGroupNamesForSong('song.mp3')).toEqual(['First', 'Second']);
    });

    it('matches a path-prefixed songKey against a basename fullPath (toSongKey on the key side)', () => {
      nDBStore['aoSongLists'] = [
        group({ name: 'Band', firebaseGroupDocId: 'd1', songs: [song('song.mp3')] }),
      ];
      expect(getGroupNamesForSong('some/dir/song.mp3')).toEqual(['Band']);
      expect(getGroupNamesForSong('C:\\some\\dir\\song.mp3')).toEqual(['Band']);
    });

    it('matches a basename songKey against a path-prefixed fullPath (toSongKey on the song side)', () => {
      nDBStore['aoSongLists'] = [
        group({ name: 'Band', firebaseGroupDocId: 'd1', songs: [song('some/dir/song.mp3')] }),
      ];
      expect(getGroupNamesForSong('song.mp3')).toEqual(['Band']);
    });

    it("falls back to 'Untitled songlist' when a matching group has no name", () => {
      nDBStore['aoSongLists'] = [
        group({ name: undefined, firebaseGroupDocId: 'd1', songs: [song('song.mp3')] }),
      ];
      expect(getGroupNamesForSong('song.mp3')).toEqual(['Untitled songlist']);
    });
  });

  describe('getSelectedGroupName', () => {
    it('returns "" when TROFF_SONG_LIST_NAVIGATION_STATE is missing', () => {
      expect(getSelectedGroupName()).toBe('');
    });

    it('returns "" when the navigation state tab is not "groups"', () => {
      nDBStore['TROFF_SONG_LIST_NAVIGATION_STATE'] = {
        tab: 'artists',
        selected_entity: 'Band',
      };
      expect(getSelectedGroupName()).toBe('');
    });

    it('returns "" when selected_entity is empty', () => {
      nDBStore['TROFF_SONG_LIST_NAVIGATION_STATE'] = { tab: 'groups', selected_entity: '' };
      expect(getSelectedGroupName()).toBe('');
    });

    it("returns the group name when selected_entity matches the group's firebaseGroupDocId", () => {
      nDBStore['TROFF_SONG_LIST_NAVIGATION_STATE'] = { tab: 'groups', selected_entity: 'd1' };
      nDBStore['aoSongLists'] = [
        group({ name: 'Band', firebaseGroupDocId: 'd1', songs: [] }),
      ];
      expect(getSelectedGroupName()).toBe('Band');
    });

    it('matches by String(id) when the group has no firebaseGroupDocId', () => {
      nDBStore['TROFF_SONG_LIST_NAVIGATION_STATE'] = { tab: 'groups', selected_entity: '7' };
      nDBStore['aoSongLists'] = [
        group({ name: 'Local', firebaseGroupDocId: undefined, id: 7, songs: [] }),
      ];
      expect(getSelectedGroupName()).toBe('Local');
    });

    it('returns "" when selected_entity matches no group', () => {
      nDBStore['TROFF_SONG_LIST_NAVIGATION_STATE'] = {
        tab: 'groups',
        selected_entity: 'nope',
      };
      nDBStore['aoSongLists'] = [
        group({ name: 'Band', firebaseGroupDocId: 'd1', songs: [] }),
      ];
      expect(getSelectedGroupName()).toBe('');
    });
  });

  describe('updateHeaderGroupsWithCurrentSong', () => {
    it('sets header.groupNames on <t-header id="header"> from the current song', () => {
      const header = mountHeader();
      nDBStore['stroCurrentSongPathAndGalleryId'] = { strPath: 'song.mp3' };
      nDBStore['aoSongLists'] = [
        group({ name: 'Band', firebaseGroupDocId: 'd1', songs: [song('song.mp3')] }),
        group({
          name: 'Local',
          firebaseGroupDocId: undefined,
          songs: [song('song.mp3')],
        }),
      ];

      updateHeaderGroupsWithCurrentSong();

      expect((header as HeaderWithGroups).groupNames).toEqual(['Band']);
    });

    it('clears header.groupNames when no current song is selected', () => {
      const header = mountHeader();
      (header as HeaderWithGroups).groupNames = ['Stale group'];
      nDBStore['aoSongLists'] = [
        group({ name: 'Band', firebaseGroupDocId: 'd1', songs: [song('song.mp3')] }),
      ];
      // No stroCurrentSongPathAndGalleryId in nDB.

      updateHeaderGroupsWithCurrentSong();

      expect((header as HeaderWithGroups).groupNames).toEqual([]);
    });

    it('sets header.selectedGroupName from the navigation state alongside groupNames', () => {
      const header = mountHeader();
      nDBStore['stroCurrentSongPathAndGalleryId'] = { strPath: 'song.mp3' };
      nDBStore['aoSongLists'] = [
        group({ name: 'Band', firebaseGroupDocId: 'd1', songs: [song('song.mp3')] }),
      ];
      nDBStore['TROFF_SONG_LIST_NAVIGATION_STATE'] = { tab: 'groups', selected_entity: 'd1' };

      updateHeaderGroupsWithCurrentSong();

      expect((header as HeaderWithSelectedGroup).selectedGroupName).toBe('Band');
      expect((header as HeaderWithGroups).groupNames).toEqual(['Band']);
    });

    it('clears a stale header.selectedGroupName when the navigation state points at a non-group tab', () => {
      const header = mountHeader();
      (header as HeaderWithSelectedGroup).selectedGroupName = 'Band';
      nDBStore['stroCurrentSongPathAndGalleryId'] = { strPath: 'song.mp3' };
      nDBStore['aoSongLists'] = [
        group({ name: 'Band', firebaseGroupDocId: 'd1', songs: [song('song.mp3')] }),
      ];
      nDBStore['TROFF_SONG_LIST_NAVIGATION_STATE'] = { tab: 'tracks', selected_entity: '' };

      updateHeaderGroupsWithCurrentSong();

      expect((header as HeaderWithSelectedGroup).selectedGroupName).toBe('');
    });

    it('is a no-op (no throw) when there is no #header element', () => {
      nDBStore['stroCurrentSongPathAndGalleryId'] = { strPath: 'song.mp3' };
      nDBStore['aoSongLists'] = [
        group({ name: 'Band', firebaseGroupDocId: 'd1', songs: [song('song.mp3')] }),
      ];

      expect(() => updateHeaderGroupsWithCurrentSong()).not.toThrow();
      expect(document.getElementById('header')).toBeNull();
    });

    it('is reached by the REAL updateHeaderWithCurrentSong() (utils/current-song.ts glue)', async () => {
      const header = mountHeader();
      nDBStore['stroCurrentSongPathAndGalleryId'] = { strPath: 'song.mp3' };
      nDBStore['aoSongLists'] = [
        group({ name: 'Band', firebaseGroupDocId: 'd1', songs: [song('song.mp3')] }),
      ];

      const { updateHeaderWithCurrentSong } = await import('../utils/current-song.js');
      updateHeaderWithCurrentSong();

      expect((header as HeaderWithGroups).groupNames).toEqual(['Band']);
    });
  });
});
