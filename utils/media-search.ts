/**
 * Pure filter functions used by `t-media-parent` to filter the currently
 * displayed list (tracks / artists / genres / groups) by a free-text search
 * query.
 *
 * Behavior contract:
 * - An empty or whitespace-only query returns the input array unchanged
 *   (same reference) — this lets callers cheaply skip filtering.
 * - A non-empty query is trimmed and matched case-insensitively as a
 *   substring against the item's primary name field. For tracks, the query
 *   also matches against `artist`, `genre`, `album`, `tags`,
 *   `choreographer`, `choreography`, `info`, and `songKey` (file name)
 *   fields.
 * - The input array is never mutated; a new array is returned on the
 *   non-empty-query path.
 * - `filterGroups` additionally drops groups with no name
 *   (`name === undefined` or `name === null`) when the query is non-empty.
 */

import type { TroffFirebaseGroupIdentifyer } from '../types/troff.d.js';

/** Minimum shape required to filter tracks — the formatted song objects
 * produced by `LocalSongDataService.getAllSongs()` satisfy this. */
export interface TrackLike {
  title: string;
  artist?: string;
  genre?: string;
  album?: string;
  songKey?: string;
  tags?: string;
  choreographer?: string;
  choreography?: string;
  info?: string;
  [key: string]: unknown;
}

/** Shape produced by `_getUniqueArtists` / `_getUniqueGenres` in
 * `t-media-parent` — a unique name plus the songs that belong to it. */
export interface NamedItemLike {
  name: string;
  tracks: TrackLike[];
  [key: string]: unknown;
}

export type ArtistLike = NamedItemLike;
export type GenreLike = NamedItemLike;

/** Minimum shape required to filter groups. A `TroffFirebaseGroupIdentifyer`
 * is structurally assignable to this, but we also accept objects whose
 * `name` may be `null` (not just `undefined`) to gracefully handle
 * partially-constructed data. */
export interface GroupLike {
  name?: string | null;
  [key: string]: unknown;
}

/** Convenience alias: anything `filterGroups` can accept. */
export type GroupInput = TroffFirebaseGroupIdentifyer | GroupLike;

export function filterTracks(tracks: TrackLike[], query: string): TrackLike[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return tracks;
  }
  return tracks.filter((track) => matchesTrackSearch(track, needle));
}

function matchesTrackSearch(track: TrackLike, needle: string): boolean {
  return (
    track.title.toLowerCase().includes(needle) ||
    strIncludes(track.artist, needle) ||
    strIncludes(track.genre, needle) ||
    strIncludes(track.album, needle) ||
    strIncludes(track.tags, needle) ||
    strIncludes(track.choreographer, needle) ||
    strIncludes(track.choreography, needle) ||
    strIncludes(track.info, needle) ||
    strIncludes(track.songKey, needle)
  );
}

function strIncludes(value: unknown, needle: string): boolean {
  return typeof value === 'string' && value.toLowerCase().includes(needle);
}

export function filterArtists(artists: ArtistLike[], query: string): ArtistLike[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return artists;
  }
  return artists.filter((artist) => artist.name.toLowerCase().includes(needle));
}

export function filterGenres(genres: GenreLike[], query: string): GenreLike[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return genres;
  }
  return genres.filter((genre) => genre.name.toLowerCase().includes(needle));
}

export function filterGroups<T extends GroupLike>(groups: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return groups;
  }
  return groups.filter(
    (group) => typeof group.name === 'string' && group.name.toLowerCase().includes(needle)
  );
}
