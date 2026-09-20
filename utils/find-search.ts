/**
 * Pure search helpers for find.html server-song list.
 *
 * Behavior contract:
 * - Query is trimmed; empty/whitespace-only matches everything.
 * - Matching is case-insensitive substring against ANY of: fileName,
 *   displayName, customName, choreography, title, artist, album,
 *   choreographer, genre, tags, full song info (info, falling back to
 *   infoBeginning when info is absent).
 * - displayName === 'Unknown' (any case) is treated as empty: it never
 *   matches "unknown" and never blocks a filename match.
 * - A filename match is always OR-ed (via the fileNameMatches flag).
 */

export interface FindSearchEntry {
  displayName?: string | null;
  fileName?: string | null;
  customName?: string | null;
  choreography?: string | null;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  choreographer?: string | null;
  genre?: string | null;
  tags?: string | null;
  info?: string | null;
  infoBeginning?: string | null;
}

function normalize(value: string | null | undefined): string {
  return value ?? '';
}

function normalizeDisplayName(value: string | null | undefined): string {
  const v = value ?? '';
  if (v.trim().toLowerCase() === 'unknown') return '';
  return v;
}

export function getSearchableFields(entry: FindSearchEntry): string[] {
  return [
    normalize(entry.fileName),
    normalizeDisplayName(entry.displayName),
    normalize(entry.customName),
    normalize(entry.choreography),
    normalize(entry.title),
    normalize(entry.artist),
    normalize(entry.album),
    normalize(entry.choreographer),
    normalize(entry.genre),
    normalize(entry.tags),
    normalize(entry.info ? entry.info : entry.infoBeginning),
  ];
}

function strIncludes(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle);
}

export function includesSearch(
  query: string,
  entry: FindSearchEntry,
  fileNameMatches: boolean
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  if (fileNameMatches) return true;
  return getSearchableFields(entry).some((field) => strIncludes(field, needle));
}

export function matchesServerSongSearch(
  query: string,
  fileName: string,
  entry: FindSearchEntry
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  const name = fileName ?? '';
  const fileNameMatches = name.toLowerCase().includes(needle);
  const merged: FindSearchEntry = { ...entry, fileName: entry.fileName ?? name };
  return includesSearch(query, merged, fileNameMatches);
}
