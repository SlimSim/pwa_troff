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
import type { TroffFirebaseGroupIdentifyer, TroffObjectLocal } from '../types/troff.d.js';
import log from './log.js';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Holds the unsubscribe callbacks returned by onSnapshot(). */
let unsubscribers: Array<() => void> = [];

/**
 * Optional callback invoked when the *currently-playing* song receives a
 * remote update. Receives the songKey and the parsed jsonDataInfo from
 * Firestore.
 */
let liveUpdateCallback: ((songKey: string, remoteData: Record<string, unknown>) => void) | null = null;

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

    // Local data is at least as recent — nothing to do
    if (newTime <= existingTime) {
      return;
    }

    // Preserve local-only fields that are not stored in Firestore
    const localInfo = existingData?.localInformation;
    if (localInfo !== undefined) {
      newData.localInformation = localInfo;
    }

    // Write remote data to local storage
    nDB.set(songKey, newData);

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
  const existingData = nDB.get(songKey) as TroffObjectLocal | null;
  if (!existingData) return;

  try {
    const firebaseClient = await import('../services/firebaseClient.js');
    const { db, doc, setDoc } = firebaseClient;

    const songRefMap = buildSongRefMap();
    const refs = songRefMap.get(songKey);
    if (!refs || refs.length === 0) return;

    // Strip local-only fields
    const { localInformation, ...publicData } = existingData;
    publicData.latestUploadToFirebase = Date.now();

    const payload = {
      songKey,
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
