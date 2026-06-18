/**
 * Sync Firebase groups and songs into local storage after sign-in.
 *
 * When the user signs in, this module:
 * 1. Fetches all Firebase Groups the user belongs to (via `owners` array)
 * 2. For each group, fetches its Songs subcollection
 * 3. Downloads any song files not yet cached locally
 * 4. Saves song metadata to nDB
 * 5. Merges the Firebase group structure into `aoSongLists` in nDB
 *
 * Designed for V2's onAuthStateChanged handler. All Firebase imports are
 * dynamic so tests (Vitest / happy-dom) are not broken by CDN imports.
 *
 * iOS / Safari notes:
 * - Cache API: supported since iOS 11.3
 * - Uses simple `response.clone()` — avoids ReadableStream for maximum
 *   cross-browser compatibility
 */

import { nDB } from '../assets/internal/db.js';
import type { TroffFirebaseGroupIdentifyer, TroffFirebaseSongIdentifyer } from '../types/troff.d.js';
import log from './log.js';

const CACHE_NAME = 'songCache-v1.0';

/**
 * Download a file from a remote URL and store it in the local song cache.
 * Uses `response.clone()` to avoid consuming the body stream — compatible
 * with all modern browsers including Safari / iOS.
 */
async function fetchAndCacheFile(fileUrl: string, songKey: string): Promise<void> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${songKey}: ${response.statusText}`);
  }
  const cache = await caches.open(CACHE_NAME);
  await cache.put(songKey, response.clone());
}

/**
 * Fetch Firebase groups for the given user email, download any missing song
 * files, save metadata to nDB, and update `aoSongLists`.
 *
 * This is a no-op (safe to call) when Firebase is unavailable, offline,
 * or in test environments — all errors are caught and logged.
 *
 * @param firebaseUserEmail  The email of the signed-in Firebase user.
 */
export async function syncFirebaseGroups(firebaseUserEmail: string): Promise<void> {
  try {
    const firebaseClient = await import('../services/firebaseClient.js');

    const { initiateAllFirebaseGroups, db, collection, getDocs } = firebaseClient;

    const snapshot = await initiateAllFirebaseGroups(firebaseUserEmail);
    if (!snapshot) {
      return;
    }

    // If the snapshot comes from the local cache, skip it — we want fresh data.
    if (snapshot.metadata?.fromCache) {
      log.i('Firebase groups snapshot is from cache — skipping sync');
      return;
    }

    const firebaseSongLists: TroffFirebaseGroupIdentifyer[] = [];

    for (const groupDoc of snapshot.docs) {
      const groupData = groupDoc.data();

      // Fetch the Songs subcollection for this group
      let songsSnapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> };
      try {
        songsSnapshot = await getDocs(collection(db, 'Groups', groupDoc.id, 'Songs'));
      } catch (err) {
        log.e(`Failed to fetch Songs for group "${groupData.name}":`, err);
        continue;
      }

      const groupSongs: TroffFirebaseSongIdentifyer[] = [];

      for (const songDoc of songsSnapshot.docs) {
        const songData = songDoc.data();
        const songKey = songData.songKey as string | undefined;
        const fileUrl = songData.fileUrl as string | undefined;

        if (!songKey || !fileUrl) {
          continue;
        }

        // Download the audio file if it's not already in cache
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(songKey);

        if (!cachedResponse) {
          try {
            await fetchAndCacheFile(fileUrl, songKey);
          } catch (err) {
            log.e(`Failed to download song "${songKey}":`, err);
            // Skip this song but continue with others
            continue;
          }
        }

        // Save / update song metadata in nDB
        const jsonDataInfo = songData.jsonDataInfo as string | undefined;
        if (jsonDataInfo) {
          try {
            const parsedData = JSON.parse(jsonDataInfo) as Record<string, unknown>;
            const existingData = nDB.get(songKey) as Record<string, unknown> | null;
            const serverUploadTime = Number(parsedData.latestUploadToFirebase) || 0;
            const localUploadTime = Number(existingData?.latestUploadToFirebase) || 0;
            if (serverUploadTime >= localUploadTime) {
              nDB.set(songKey, parsedData);
            }
          } catch (err) {
            log.e(`Failed to parse song data for "${songKey}":`, err);
          }
        }

        groupSongs.push({
          firebaseSongDocId: songDoc.id,
          fullPath: songKey,
          galleryId: 'pwa-galleryId',
        });
      }

      firebaseSongLists.push({
        name: (groupData.name as string) || 'Unnamed Group',
        firebaseGroupDocId: groupDoc.id,
        owners: (groupData.owners as string[]) || [],
        color: groupData.color as string | undefined,
        icon: groupData.icon as string | undefined,
        songs: groupSongs,
      });
    }

    // Merge into aoSongLists: keep local-only groups, replace Firebase groups
    const existingSongLists: TroffFirebaseGroupIdentifyer[] =
      (nDB.get('aoSongLists') as TroffFirebaseGroupIdentifyer[]) || [];
    const localOnly = existingSongLists.filter(
      (sl: TroffFirebaseGroupIdentifyer) => !sl.firebaseGroupDocId
    );
    const updatedSongLists = [...localOnly, ...firebaseSongLists];
    nDB.set('aoSongLists', updatedSongLists);

    log.i(
      `Firebase sync complete: ${firebaseSongLists.length} group(s), ` +
        `${firebaseSongLists.reduce((sum, g) => sum + g.songs.length, 0)} song(s)`
    );
  } catch (error) {
    // Firebase may not be available (tests, offline, CDN blocked)
    log.i('Firebase sync not available:', error);
  }
}
