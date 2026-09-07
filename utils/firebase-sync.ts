/**
 * Sync Firebase groups and songs into local storage after sign-in.
 *
 * When the user signs in, this module:
 * 1. Fetches all Firebase Groups the user belongs to (via `owners` array)
 * 2. For each group, fetches its Songs subcollection
 * 3. Saves song metadata to nDB
 * 4. Merges the Firebase group structure into `aoSongLists` in nDB
 *
 * Audio file downloads are NOT performed here — they are handled by
 * `t-media-parent._downloadPendingSongs()` after the track list renders,
 * so songs appear as pending (⏳) first, then download visibly in the
 * background.
 *
 * Designed for V2's onAuthStateChanged handler. All Firebase imports are
 * dynamic so tests (Vitest / happy-dom) are not broken by CDN imports.
 *
 * iOS / Safari notes:
 * - Cache API: supported since iOS 11.3
 */

import { nDB } from '../assets/internal/db.js';
import { toSongKey } from './utils.js';
import type { TroffFirebaseGroupIdentifyer, TroffFirebaseSongIdentifyer } from '../types/troff.d.js';
import log from './log.js';
import { mergeSyncedSongData } from './merge-synced-song-data.js';

const ts = () => new Date().toLocaleTimeString();

const CACHE_NAME = 'songCache-v1.0';

const RETRY_DELAY_MS = 2000;

/**
 * Fetch Firebase groups for the given user email, download any missing song
 * files, save metadata to nDB, and update `aoSongLists`.
 *
 * This is a no-op (safe to call) when Firebase is unavailable, offline,
 * or in test environments — all errors are caught and logged.
 *
 * Retries once after a short delay if the first attempt fails (e.g. due to
 * a transient IndexedDB connection loss on iOS).
 *
 * @param firebaseUserEmail  The email of the signed-in Firebase user.
 */
export async function syncFirebaseGroups(firebaseUserEmail: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await doSyncFirebaseGroups(firebaseUserEmail);
      return; // success
    } catch (error) {
      if (attempt === 0) {
        log.i('Firebase sync attempt 1 failed, retrying in ' + RETRY_DELAY_MS + 'ms:', error);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        log.i('Firebase sync not available:', error);
      }
    }
  }
}

/**
 * Internal implementation of the Firebase sync — performs the actual
 * Firestore queries, file downloads, and localStorage writes.
 */
async function doSyncFirebaseGroups(firebaseUserEmail: string): Promise<void> {
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
          const rawSongKey = songData.songKey as string | undefined;
          const fileUrl = songData.fileUrl as string | undefined;

          if (!rawSongKey || !fileUrl) {
            continue;
          }

          // Sanitize songKey: strip any path prefix (e.g. "font/song.mp3" → "song.mp3")
          // so that path-qualified keys from legacy or polluted Firestore data
          // never enter the local cache or nDB.
           const songKey = toSongKey(rawSongKey);

           // Check cache status for logging (actual download is handled by
           // t-media-parent._downloadPendingSongs() after the track list renders,
           // so songs show as pending ⏳ first, then download in the background).
           const cache = await caches.open(CACHE_NAME);
           const cachedResponse = await cache.match(songKey);
           if (cachedResponse) {
             console.log(`${ts()} [firebase-sync] ✓ already cached: "${songKey}"`);
           } else {
             console.log(`${ts()} [firebase-sync] ⏳ not cached (will download later): "${songKey}"`);
           }

          // Save / update song metadata in nDB (even if file download failed,
          // so the song still appears in the list — it just won't play until
          // the file is available)
          const jsonDataInfo = songData.jsonDataInfo as string | undefined;
          if (jsonDataInfo) {
            try {
              const parsedData = JSON.parse(jsonDataInfo) as Record<string, unknown>;
              const existingData = nDB.get(songKey) as Record<string, unknown> | null;
               const serverUploadTime = Number(parsedData.latestUploadToFirebase) || 0;
               const localUploadTime = Number(existingData?.latestUploadToFirebase) || 0;
               if (serverUploadTime >= localUploadTime) {
                 if (!existingData) {
                   console.log(`${ts()} [firebase-sync] 💾 saving full metadata to nDB (first-time): "${songKey}"`);
                   nDB.set(songKey, parsedData);
                 } else {
                   console.log(`${ts()} [firebase-sync] 💾 merging metadata in nDB (existing): "${songKey}"`);
                   const merged = mergeSyncedSongData(existingData, parsedData);
                   nDB.set(songKey, merged);
                 }
               } else {
                 console.log(`${ts()} [firebase-sync] ⏭️  skipping (local is newer): "${songKey}"`);
               }
            } catch (err) {
              log.e(`Failed to parse song data for "${songKey}":`, err);
            }
          } else {
            console.log(`${ts()} [firebase-sync] ⚠️  no jsonDataInfo for "${songKey}"`);
          }

          groupSongs.push({
            firebaseSongDocId: songDoc.id,
            fullPath: songKey,
            galleryId: 'pwa-galleryId',
            fileUrl,
          });
      }

      firebaseSongLists.push({
        name: (groupData.name as string) || 'Unnamed Group',
        firebaseGroupDocId: groupDoc.id,
        owners: (groupData.owners as string[]) || [],
        info: groupData.info as string | undefined,
        color: groupData.color as string | undefined,
        icon: groupData.icon as string | undefined,
        songs: groupSongs,
      });
    }

    // Merge into aoSongLists: keep all local songlists, replace those with
    // a matching Firebase group, and add any new Firebase groups.
    const existingSongLists: TroffFirebaseGroupIdentifyer[] =
      (nDB.get('aoSongLists') as TroffFirebaseGroupIdentifyer[]) || [];

    const fbById = new Map<string, TroffFirebaseGroupIdentifyer>();
    for (const g of firebaseSongLists) {
      if (g.firebaseGroupDocId) {
        fbById.set(g.firebaseGroupDocId, g);
      }
    }

    const merged = existingSongLists.map((local) =>
      local.firebaseGroupDocId && fbById.has(local.firebaseGroupDocId)
        ? fbById.get(local.firebaseGroupDocId)!
        : local
    );

    const localFbIds = new Set(
      existingSongLists
        .filter((g) => g.firebaseGroupDocId)
        .map((g) => g.firebaseGroupDocId)
    );
    for (const g of firebaseSongLists) {
      if (!localFbIds.has(g.firebaseGroupDocId)) {
        merged.push(g);
      }
    }

    nDB.set('aoSongLists', merged);

    log.i(
      `Firebase sync complete: ${firebaseSongLists.length} group(s), ` +
        `${firebaseSongLists.reduce((sum, g) => sum + g.songs.length, 0)} song(s)`
    );
}
