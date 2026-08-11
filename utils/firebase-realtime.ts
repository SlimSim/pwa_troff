/**
 * Real-time Firebase sync for song markers and settings (V2).
 *
 * Mirrors the V1 pattern: on sign-in, `onSnapshot` listeners are attached to
 * every synced song document. When a remote client edits markers or settings,
 * the listener fires, applies the change locally (timestamp-based conflict
 * resolution), and triggers a UI callback to refresh markers/settings without
 * interrupting playback.
 *
 * All Firebase imports are dynamic so Vitest / happy-dom tests are not broken.
 */

import { nDB } from '../assets/internal/db.js';
import { toSongKey } from './utils.js';
import type { TroffFirebaseGroupIdentifyer, TroffObjectLocal } from '../types/troff.d.js';
import log from './log.js';

const CACHE_NAME = 'songCache-v1.0';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Holds the unsubscribe callbacks returned by onSnapshot(). */
let unsubscribers: Array<() => void> = [];

/** Holds the group-song collection `onSnapshot` unsubscribe callbacks. */
let groupUnsubscribers: Array<() => void> = [];

/**
 * Optional callback invoked when the *currently-playing* song receives a
 * remote update. Receives the songKey and the parsed jsonDataInfo from
 * Firestore.
 */
let liveUpdateCallback: ((songKey: string, remoteData: Record<string, unknown>) => void) | null = null;

/**
 * Optional callback invoked when a group's Songs collection changes remotely.
 * Receives the groupId of the group that changed.
 */
let groupUpdateCallback: ((groupId: string) => void) | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a reverse-map from local songKey → Firestore document references.
 *
 * Scans `aoSongLists` (populated by `syncFirebaseGroups` after a successful
 * sign-in) and returns every (groupDocId, songDocId) pair that belongs to
 * a given song.
 */
function buildSongRefMap(): Map<string, Array<{ groupDocId: string; songDocId: string }>> {
  const map = new Map<string, Array<{ groupDocId: string; songDocId: string }>>();
  const songLists = nDB.get('aoSongLists') as TroffFirebaseGroupIdentifyer[] | undefined;
  if (!songLists) return map;

  for (const group of songLists) {
    if (!group.firebaseGroupDocId) continue;
    for (const song of group.songs) {
      if (!song.firebaseSongDocId) continue;
      const refs = map.get(song.fullPath) || [];
      refs.push({ groupDocId: group.firebaseGroupDocId, songDocId: song.firebaseSongDocId });
      map.set(song.fullPath, refs);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Remote update handling
// ---------------------------------------------------------------------------

/**
 * Called when an `onSnapshot` listener fires for a song document.
 *
 * Skips snapshots that come from local writes (`hasPendingWrites`) to avoid
 * echo feedback. Compares `latestUploadToFirebase` timestamps and only
 * overwrites local data when the remote data is strictly newer.
 */
function handleRemoteUpdate(songKey: string, snapshot: { data: () => Record<string, unknown> | undefined; metadata: { hasPendingWrites: boolean } }): void {
  // Ignore our own writes
  if (snapshot.metadata.hasPendingWrites) {
    return;
  }

  const songData = snapshot.data();
  if (!songData?.jsonDataInfo) return;

  try {
    const newData = JSON.parse(songData.jsonDataInfo as string) as Record<string, unknown>;
    const existingData = nDB.get(songKey) as Record<string, unknown> | null;
    const existingTime = Number(existingData?.latestUploadToFirebase) || 0;
    const newTime = Number(newData.latestUploadToFirebase) || 0;

    // Remote data is strictly older — nothing to do
    if (newTime < existingTime) {
      return;
    }

    // Preserve local-only fields that are not stored in Firestore
    const localInfo = existingData?.localInformation;
    if (localInfo !== undefined) {
      newData.localInformation = localInfo;
    }

    // Only overwrite local storage when the remote data is strictly newer.
    // On an equal timestamp (e.g. the initial onSnapshot fire right after
    // syncFirebaseGroups already applied the data to nDB) the UI is still
    // refreshed so a song that was already loaded at boot picks up the
    // synced markers without requiring a manual re-select.
    if (newTime > existingTime) {
      nDB.set(songKey, newData);
    }

    // If this is the currently-playing song, refresh the UI
    if (liveUpdateCallback) {
      liveUpdateCallback(songKey, newData);
    }
  } catch (err) {
    log.e(`Failed to apply remote update for "${songKey}":`, err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a callback that will be called when the currently-playing song
 * receives a remote update. The callback should refresh the marker slider,
 * settings panel, and any other UI that reflects song data.
 */
export function setLiveUpdateCallback(cb: (songKey: string, remoteData: Record<string, unknown>) => void): void {
  liveUpdateCallback = cb;
}

/**
 * Tear down all active Firestore `onSnapshot` listeners.
 *
 * Safe to call multiple times — no-ops when no listeners are active.
 */
export function teardownListeners(): void {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  groupUnsubscribers.forEach((unsub) => unsub());
  groupUnsubscribers = [];
}

/**
 * Set up `onSnapshot` listeners for every Firebase song document in the
 * current `aoSongLists`. Each listener calls `handleRemoteUpdate` when a
 * remote change is detected.
 *
 * This is a no-op when Firebase is unavailable (tests, offline, CDN blocked).
 *
 * Must be called *after* `syncFirebaseGroups()` has populated `aoSongLists`.
 */
export async function setupListeners(): Promise<void> {
  // Tear down any existing listeners first (e.g. on re-sign-in)
  teardownListeners();

  try {
    const firebaseClient = await import('../services/firebaseClient.js');
    const { db, doc, onSnapshot } = firebaseClient;

    const songRefMap = buildSongRefMap();
    if (songRefMap.size === 0) {
      log.i('No Firebase songs to listen to');
      return;
    }

    for (const [songKey, refs] of songRefMap) {
      for (const ref of refs) {
        const songDocRef = doc(db, 'Groups', ref.groupDocId, 'Songs', ref.songDocId);
        const unsub = onSnapshot(
          songDocRef,
          (snapshot: { data: () => Record<string, unknown> | undefined; metadata: { hasPendingWrites: boolean }; exists: () => boolean }) => {
            if (!snapshot.exists()) return;
            handleRemoteUpdate(songKey, snapshot);
          },
          (err: unknown) => {
            log.e(`onSnapshot error for "${songKey}":`, err);
          }
        );
        unsubscribers.push(unsub);
      }
    }

    log.i(`Firebase real-time listeners active for ${songRefMap.size} song(s)`);
  } catch (err) {
    // Firebase may not be available (tests, offline, CDN blocked)
    log.i('Firebase real-time sync not available:', err);
  }
}

/**
 * Save the current local data for `songKey` to every Firestore document it
 * belongs to (i.e. every group subcollection entry).
 *
 * Strips `localInformation` (never uploaded), sets a fresh
 * `latestUploadToFirebase` timestamp, and uses `{ merge: true }` to avoid
 * overwriting `fileUrl` and other fields already in Firestore.
 *
 * @param songKey  The local nDB key (filename).
 */
export async function saveSongData(songKey: string): Promise<void> {
   // Sanitize songKey: strip any path prefix so polluted keys
   // never enter Firestore.
   const cleanSongKey = toSongKey(songKey);

   const existingData = nDB.get(cleanSongKey) as TroffObjectLocal | null;
   if (!existingData) return;

   try {
     const firebaseClient = await import('../services/firebaseClient.js');
     const { db, doc, setDoc } = firebaseClient;

     const songRefMap = buildSongRefMap();
     const refs = songRefMap.get(cleanSongKey);
     if (!refs || refs.length === 0) return;

     // Strip local-only fields
     const { localInformation, ...publicData } = existingData;
     publicData.latestUploadToFirebase = Date.now();

     const payload = {
       songKey: cleanSongKey,
       jsonDataInfo: JSON.stringify(publicData),
     };

     for (const ref of refs) {
       const songDocRef = doc(db, 'Groups', ref.groupDocId, 'Songs', ref.songDocId);
       await setDoc(songDocRef, payload, { merge: true } as any);
     }
   } catch (err) {
     // Firebase may not be available (offline, CDN blocked)
     log.i('Firebase save not available:', err);
   }
 }

// ---------------------------------------------------------------------------
// Group song listeners
// ---------------------------------------------------------------------------

/** Shape of a server-side song document inside a group's Songs collection. */
type ServerSongDoc = {
  firebaseSongDocId: string;
  fullPath: string;
  galleryId: string;
  fileUrl: string;
  jsonDataInfo?: string;
};

type GroupSongsSnapshot = {
  docs: Array<{ id: string; data: () => Record<string, unknown> }>;
  metadata: { hasPendingWrites: boolean };
};

/**
 * Handle a snapshot of a group's Songs collection.
 *
 * Adds new remote songs (downloading missing audio files and saving metadata)
 * and removes local entries whose Firestore doc no longer exists. Only persists
 * `aoSongLists` when something changed, then invokes the group update callback.
 */
async function handleGroupSongsSnapshot(groupId: string, snapshot: GroupSongsSnapshot): Promise<void> {
  // Ignore our own writes (local echo)
  if (snapshot.metadata?.hasPendingWrites) return;

  // Build the server-side song doc list (skip malformed docs)
  const serverDocs: ServerSongDoc[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const rawSongKey = data.songKey as string | undefined;
    const fileUrl = data.fileUrl as string | undefined;
    if (!rawSongKey || !fileUrl) continue;
    serverDocs.push({
      firebaseSongDocId: doc.id,
      fullPath: toSongKey(rawSongKey),
      galleryId: 'pwa-galleryId',
      fileUrl,
      jsonDataInfo: data.jsonDataInfo as string | undefined,
    });
  }

  const songLists: TroffFirebaseGroupIdentifyer[] =
    (nDB.get('aoSongLists') as TroffFirebaseGroupIdentifyer[] | undefined) || [];
  const group = songLists.find((g) => g.firebaseGroupDocId === groupId);
  if (!group) return;

  const localSongs = group.songs || [];
  const serverIds = new Set(serverDocs.map((d) => d.firebaseSongDocId));
  let changed = false;

  // Removed songs: keep only entries that still exist on the server.
  // Entries without a firebaseSongDocId are local-only (e.g. added offline)
  // and are kept until they get synced.
  const kept = localSongs.filter((s) => {
    if (!s.firebaseSongDocId) return true;
    return serverIds.has(s.firebaseSongDocId);
  });
  if (kept.length !== localSongs.length) changed = true;

  // New songs: download the file first (mirroring firebase-sync.ts), then save
  // metadata and append locally. Songs whose file cannot be fetched are skipped.
  for (const serverDoc of serverDocs) {
    if (kept.some((s) => s.firebaseSongDocId === serverDoc.firebaseSongDocId)) continue;

    const downloaded = await downloadAndCacheFile(serverDoc);
    if (!downloaded) continue;

    // Save/update song metadata in nDB (timestamp guarded)
    if (serverDoc.jsonDataInfo) {
      try {
        const parsedData = JSON.parse(serverDoc.jsonDataInfo) as Record<string, unknown>;
        const existingData = nDB.get(serverDoc.fullPath) as Record<string, unknown> | null;
        const serverUploadTime = Number(parsedData.latestUploadToFirebase) || 0;
        const localUploadTime = Number(existingData?.latestUploadToFirebase) || 0;
        if (serverUploadTime >= localUploadTime) {
          nDB.set(serverDoc.fullPath, parsedData);
        }
      } catch (err) {
        log.e(`Failed to parse song data for "${serverDoc.fullPath}":`, err);
      }
    }

    kept.push({
      firebaseSongDocId: serverDoc.firebaseSongDocId,
      fullPath: serverDoc.fullPath,
      galleryId: serverDoc.galleryId,
      fileUrl: serverDoc.fileUrl,
    });
    changed = true;
  }

  if (changed) {
    group.songs = kept;
    nDB.set('aoSongLists', songLists);
    if (groupUpdateCallback) {
      groupUpdateCallback(groupId);
    }
  }
}

/**
 * Download a song file from Firestore Storage if it is not already cached,
 * and put it into the local song cache.
 *
 * @returns true when the file is available in the cache (already present or
 * downloaded), false when the download failed.
 */
async function downloadAndCacheFile(serverDoc: ServerSongDoc): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(serverDoc.fullPath);
    if (cachedResponse) return true;

    const response = await fetch(serverDoc.fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${serverDoc.fullPath}: ${response.statusText}`);
    }
    await cache.put(serverDoc.fullPath, response.clone());
    return true;
  } catch (err) {
    log.e(`Failed to download song "${serverDoc.fullPath}":`, err);
    return false;
  }
}

/**
 * Register a callback invoked when a group's Songs collection changes
 * remotely. The callback receives the groupId of the changed group.
 */
export function setGroupUpdateCallback(cb: (groupId: string) => void): void {
  groupUpdateCallback = cb;
}

/**
 * Set up `onSnapshot` listeners for every Firebase group's Songs collection
 * in the current `aoSongLists`. Remote changes add/remove group songs locally.
 *
 * Tear down any previous group listeners first. No-op when Firebase is
 * unavailable or no group has a `firebaseGroupDocId`.
 */
export async function setupGroupSongListeners(): Promise<void> {
  // Tear down any existing group listeners first (e.g. on re-sign-in)
  groupUnsubscribers.forEach((unsub) => unsub());
  groupUnsubscribers = [];

  try {
    const firebaseClient = await import('../services/firebaseClient.js');
    const { db, collection, onSnapshot } = firebaseClient;

    const songLists: TroffFirebaseGroupIdentifyer[] =
      (nDB.get('aoSongLists') as TroffFirebaseGroupIdentifyer[] | undefined) || [];
    const firebaseGroups = songLists.filter((g) => g.firebaseGroupDocId);
    if (firebaseGroups.length === 0) {
      log.i('No Firebase groups to listen to');
      return;
    }

    for (const group of firebaseGroups) {
      const groupId = group.firebaseGroupDocId!;
      const songsCollectionRef = collection(db, 'Groups', groupId, 'Songs');
      const unsub = onSnapshot(
        songsCollectionRef,
        (snapshot: GroupSongsSnapshot) => {
          handleGroupSongsSnapshot(groupId, snapshot);
        },
        (err: unknown) => {
          log.e(`onSnapshot error for group "${groupId}":`, err);
        }
      );
      groupUnsubscribers.push(unsub);
    }

    log.i(`Firebase group song listeners active for ${firebaseGroups.length} group(s)`);
  } catch (err) {
    // Firebase may not be available (tests, offline, CDN blocked)
    log.i('Firebase group song sync not available:', err);
  }
}
