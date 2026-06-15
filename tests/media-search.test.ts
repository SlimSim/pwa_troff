// Tests for the media-search filter utility used by `t-media-parent`.
// These functions are pure: given a list of tracks/artists/genres/groups
// and a search query, they return a filtered list. They are expected to
// match case-insensitively as substrings, return input unchanged for empty
// or whitespace-only queries, and never mutate the input.

import { describe, it, expect } from 'vitest';
import {
  filterTracks,
  filterArtists,
  filterGenres,
  filterGroups,
} from '../utils/media-search.js';

// ---- Fixtures ---------------------------------------------------------------

const tracks = [
  { id: 't1', title: 'Tango' },
  { id: 't2', title: 'Waltz' },
  { id: 't3', title: 'Foxtrot' },
  { id: 't4', title: 'TANGO nuevo' },
];

const artists = [
  { name: 'Astor Piazzolla', tracks: [{ id: 't1', title: 'Tango' }] },
  { name: 'Carlos Gardel', tracks: [{ id: 't2', title: 'Waltz' }] },
  { name: 'Johann Strauss', tracks: [{ id: 't3', title: 'Foxtrot' }] },
];

const genres = [
  { name: 'Tango', tracks: [{ id: 't1', title: 'Tango' }] },
  { name: 'Waltz', tracks: [{ id: 't2', title: 'Waltz' }] },
  { name: 'Foxtrot', tracks: [{ id: 't3', title: 'Foxtrot' }] },
];

const groups = [
  { name: 'My Favorites', id: 'g1' },
  { name: 'Practice List', id: 'g2' },
  { name: 'Tango Night', id: 'g3' },
  { id: 'g4' }, // no name at all
  { name: undefined, id: 'g5' }, // name explicitly undefined
  { name: null, id: 'g6' }, // name explicitly null
];

// ---- filterTracks -----------------------------------------------------------

describe('filterTracks', () => {
  it('returns the input array unchanged (same reference) for an empty query', () => {
    const input = [...tracks];
    const result = filterTracks(input, '');
    expect(result).toBe(input);
  });

  it('returns the input array unchanged for a whitespace-only query', () => {
    const input = [...tracks];
    const result = filterTracks(input, '   ');
    expect(result).toBe(input);
  });

  it('matches case-insensitively when query is lowercase', () => {
    const result = filterTracks(tracks, 'tango');
    expect(result).toHaveLength(2);
    expect(result.map((t: any) => t.id)).toEqual(['t1', 't4']);
  });

  it('matches case-insensitively when query is uppercase', () => {
    const result = filterTracks(tracks, 'WALTZ');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('returns an empty array when no tracks match', () => {
    const result = filterTracks(tracks, 'samba');
    expect(result).toEqual([]);
  });

  it('matches on substring, not only exact whole-word matches', () => {
    // 'tang' is a substring of 'Tango' and 'TANGO nuevo'
    const result = filterTracks(tracks, 'tang');
    expect(result).toHaveLength(2);
    expect(result.map((t: any) => t.id)).toEqual(['t1', 't4']);
  });

  it('does not mutate the input array', () => {
    const input = [...tracks];
    const snapshot = input.map((t) => ({ ...t }));
    filterTracks(input, 'tango');
    expect(input).toHaveLength(snapshot.length);
    expect(input).toEqual(snapshot);
  });

  it('trims surrounding whitespace from the query before matching', () => {
    const result = filterTracks(tracks, '   waltz   ');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });
});

// ---- filterArtists ----------------------------------------------------------

describe('filterArtists', () => {
  it('returns the input array unchanged (same reference) for an empty query', () => {
    const input = [...artists];
    const result = filterArtists(input, '');
    expect(result).toBe(input);
  });

  it('returns the input array unchanged for a whitespace-only query', () => {
    const input = [...artists];
    const result = filterArtists(input, '\t\n ');
    expect(result).toBe(input);
  });

  it('matches case-insensitively when query is lowercase', () => {
    const result = filterArtists(artists, 'piazzo');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Astor Piazzolla');
  });

  it('matches case-insensitively when query is uppercase', () => {
    const result = filterArtists(artists, 'STRAUSS');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Johann Strauss');
  });

  it('returns an empty array when no artists match', () => {
    const result = filterArtists(artists, 'beethoven');
    expect(result).toEqual([]);
  });

  it('matches on substring, not only exact whole-word matches', () => {
    // 'gard' is a substring of 'Carlos Gardel'
    const result = filterArtists(artists, 'gard');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Carlos Gardel');
  });

  it('does not mutate the input array', () => {
    const input = [...artists];
    const snapshot = input.map((a) => ({ ...a, tracks: [...a.tracks] }));
    filterArtists(input, 'gard');
    expect(input).toHaveLength(snapshot.length);
    expect(input).toEqual(snapshot);
  });

  it('trims surrounding whitespace from the query before matching', () => {
    const result = filterArtists(artists, '   piazzolla   ');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Astor Piazzolla');
  });
});

// ---- filterGenres -----------------------------------------------------------

describe('filterGenres', () => {
  it('returns the input array unchanged (same reference) for an empty query', () => {
    const input = [...genres];
    const result = filterGenres(input, '');
    expect(result).toBe(input);
  });

  it('returns the input array unchanged for a whitespace-only query', () => {
    const input = [...genres];
    const result = filterGenres(input, '   ');
    expect(result).toBe(input);
  });

  it('matches case-insensitively when query is lowercase', () => {
    const result = filterGenres(genres, 'tango');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tango');
  });

  it('matches case-insensitively when query is uppercase', () => {
    const result = filterGenres(genres, 'FOXTROT');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Foxtrot');
  });

  it('returns an empty array when no genres match', () => {
    const result = filterGenres(genres, 'salsa');
    expect(result).toEqual([]);
  });

  it('matches on substring, not only exact whole-word matches', () => {
    // 'walt' is a substring of 'Waltz'
    const result = filterGenres(genres, 'walt');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Waltz');
  });

  it('does not mutate the input array', () => {
    const input = [...genres];
    const snapshot = input.map((g) => ({ ...g, tracks: [...g.tracks] }));
    filterGenres(input, 'walt');
    expect(input).toHaveLength(snapshot.length);
    expect(input).toEqual(snapshot);
  });

  it('trims surrounding whitespace from the query before matching', () => {
    const result = filterGenres(genres, '   tango   ');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tango');
  });
});

// ---- filterGroups -----------------------------------------------------------

describe('filterGroups', () => {
  it('returns the input array unchanged (same reference) for an empty query', () => {
    const input = [...groups];
    const result = filterGroups(input, '');
    expect(result).toBe(input);
  });

  it('returns the input array unchanged for a whitespace-only query', () => {
    const input = [...groups];
    const result = filterGroups(input, '   ');
    expect(result).toBe(input);
  });

  it('matches case-insensitively when query is lowercase', () => {
    const result = filterGroups(groups, 'tango');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g3');
  });

  it('matches case-insensitively when query is uppercase', () => {
    const result = filterGroups(groups, 'PRACTICE');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g2');
  });

  it('returns an empty array when no groups match', () => {
    const result = filterGroups(groups, 'reggaeton');
    expect(result).toEqual([]);
  });

  it('matches on substring, not only exact whole-word matches', () => {
    // 'fav' is a substring of 'My Favorites'
    const result = filterGroups(groups, 'fav');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g1');
  });

  it('does not mutate the input array', () => {
    const input = [...groups];
    const snapshot = input.map((g) => ({ ...g }));
    filterGroups(input, 'fav');
    expect(input).toHaveLength(snapshot.length);
    expect(input).toEqual(snapshot);
  });

  it('trims surrounding whitespace from the query before matching', () => {
    const result = filterGroups(groups, '   tango   ');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g3');
  });

  it('filters out groups with no name when the query is non-empty', () => {
    // With a non-empty query, the three "nameless" groups (no name, undefined,
    // null) should be removed. Only the 3 named groups that match the query
    // should remain.
    const result = filterGroups(groups, 'tango');
    expect(result).toHaveLength(1);
    expect(result.every((g: any) => g.id !== 'g4' && g.id !== 'g5' && g.id !== 'g6')).toBe(true);
  });

  it('keeps groups with no name when the query is empty', () => {
    // The whole input — including nameless groups — must be returned as-is.
    const input = [...groups];
    const result = filterGroups(input, '');
    expect(result).toBe(input);
    expect(result).toHaveLength(6);
  });

  it('returns a NEW array (not the same reference) when the query is non-empty', () => {
    const input = [...groups];
    const result = filterGroups(input, 'tango');
    expect(result).not.toBe(input);
  });
});
