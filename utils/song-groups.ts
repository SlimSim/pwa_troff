import { nDB } from '../assets/internal/db.js';
import { toSongKey } from './utils.js';
import type { TroffFirebaseGroupIdentifyer } from '../types/troff.d.js';

/**
 * Returns the names of shared (Firebase) songlists that contain the given song.
 * Matches using normalized song keys (basename).
 */
export function getGroupNamesForSong(songKey: string): string[] {
  const songLists = nDB.get('aoSongLists') as TroffFirebaseGroupIdentifyer[] | undefined;
  if (!songLists) return [];

  const key = toSongKey(songKey);
  const names: string[] = [];

  for (const group of songLists) {
    if (!group.firebaseGroupDocId) continue;
    const hasSong = (group.songs || []).some((s) => toSongKey(s.fullPath) === key);
    if (hasSong) {
      names.push(group.name || 'Untitled songlist');
    }
  }

  return names;
}

/**
 * Updates the current <t-header id="header"> with the list of groups
 * the current song belongs to (for the shared-songlist indicator).
 */
export function updateHeaderGroupsWithCurrentSong(): void {
  const header = document.getElementById('header');
  if (!header) return;

  const currentSongData = nDB.get('stroCurrentSongPathAndGalleryId');
  const songKey = currentSongData?.strPath;
  (header as any).groupNames = songKey ? getGroupNamesForSong(songKey) : [];
}
