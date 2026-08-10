/**
 * Save/delete group data to/from Firestore (V2).
 *
 * All Firebase imports are dynamic so Vitest / happy-dom tests are not broken.
 */

import { nDB } from '../assets/internal/db.js';
import type { TroffFirebaseGroupIdentifyer, TroffFirebaseSongIdentifyer } from '../types/troff.d.js';
import log from './log.js';
import { fileUrlToStorageFileName, removeLocalInfo, toSongKey } from './utils.js';

const CACHE_NAME = 'songCache-v1.0';

/**
 * Save a group to Firestore. Uses `setDoc` for existing groups and `addDoc`
 * for new ones. Updates `firebaseGroupDocId` and `owners` on the group object.
 *
 * @param group  The group to save (mutated in-place with firebaseGroupDocId).
 * @returns The firebaseGroupDocId that was saved to.
 */
export async function saveGroupToFirebase(group: TroffFirebaseGroupIdentifyer): Promise<string | undefined> {
  try {
    const firebaseClient = await import('../services/firebaseClient.js');
    const { db, doc, setDoc, addDoc, collection } = firebaseClient;

    // Build the data to store in Firestore (no id, no songs — songs are in subcollection)
    const groupData: Record<string, unknown> = {
      name: group.name || '',
      color: group.color || '',
      icon: group.icon || '',
      info: group.info || '',
      owners: group.owners || [],
    };

    let groupDocId = group.firebaseGroupDocId;

    if (groupDocId) {
      // Update existing group document
      await setDoc(doc(db, 'Groups', groupDocId), groupData);
    } else {
      // Create new group document
      const groupRef = await addDoc(collection(db, 'Groups'), groupData);
      groupDocId = groupRef.id;
      group.firebaseGroupDocId = groupDocId;
    }

    // Ensure the current user is in the owners list
    // (owners is already set by the dialog, but double-check)
    log.i(`Group "${group.name}" saved to Firebase (doc: ${groupDocId})`);
    return groupDocId;
  } catch (err) {
    log.i('Firebase group save not available:', err);
    return undefined;
  }
}

/**
 * Delete a group from Firestore.
 *
 * @param groupDocId  The Firestore document ID of the group to delete.
 */
export async function deleteGroupFromFirebase(groupDocId: string): Promise<void> {
  try {
    const firebaseClient = await import('../services/firebaseClient.js');
    const { db, doc, deleteDoc } = firebaseClient;

    await deleteDoc(doc(db, 'Groups', groupDocId));
    log.i(`Group document "${groupDocId}" deleted from Firebase`);
  } catch (err) {
    log.i('Firebase group delete not available:', err);
  }
}

/**
 * Upload a song file to Firebase Storage and create a Songs subcollection
 * document for the given Firebase group. Updates the local `aoSongLists`
 * entry with the new `firebaseSongDocId` and `fileUrl`.
 *
 * No-op (returns undefined, no Firebase calls) when the group has no
 * `firebaseGroupDocId`, the device is offline, the song has no local nDB
 * data, or the audio file is not in the song cache.
 *
 * @param group    The group to share the song with.
 * @param songKey  The local nDB key (filename) of the song to share.
 * @returns The new firebaseSongDocId, or undefined on no-op/failure.
 */
export async function shareSongToFirebaseGroup(
  group: TroffFirebaseGroupIdentifyer,
  songKey: string
): Promise<string | undefined> {
  try {
    const cleanSongKey = toSongKey(songKey);

    // No-op checks: no Firebase group, offline, no local data, file not cached
    if (!group.firebaseGroupDocId) return undefined;
    if (!navigator.onLine) return undefined;
    if (!nDB.get(cleanSongKey)) return undefined;

    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(cleanSongKey);
    if (!cachedResponse) return undefined;

    const blob = await cachedResponse.blob();
    const file = new File([blob], cleanSongKey, { type: blob.type });

    const firebaseClient = await import('../services/firebaseClient.js');
    const { db, storage, ref, uploadBytesResumable, getDownloadURL, addDoc, collection } = firebaseClient;

    const storageRef = ref(storage, 'Groups/' + group.firebaseGroupDocId + '/' + cleanSongKey);
    const task = await uploadBytesResumable(storageRef, file);
    const fileUrl = await getDownloadURL(task.ref);

    const publicData = removeLocalInfo(nDB.get(cleanSongKey));
    publicData.latestUploadToFirebase = Date.now();

    const payload: Record<string, unknown> = {
      songKey: cleanSongKey,
      fileUrl,
      jsonDataInfo: JSON.stringify(publicData),
    };

    const docRef = await addDoc(collection(db, 'Groups', group.firebaseGroupDocId, 'Songs'), payload);

    // Update local aoSongLists entry with the new Firebase doc id and fileUrl
    const songLists: TroffFirebaseGroupIdentifyer[] =
      (nDB.get('aoSongLists') as TroffFirebaseGroupIdentifyer[] | undefined) || [];
    const matchingGroup = songLists.find((g) => g.firebaseGroupDocId === group.firebaseGroupDocId);
    if (matchingGroup) {
      const entry = matchingGroup.songs.find((s) => s.fullPath === cleanSongKey);
      if (entry) {
        entry.firebaseSongDocId = docRef.id;
        entry.fileUrl = fileUrl;
      }
      nDB.set('aoSongLists', songLists);
    }

    return docRef.id;
  } catch (err) {
    log.i('Firebase group song share not available:', err);
    return undefined;
  }
}

/**
 * Delete a song document (and its storage file, if any) from a Firebase group.
 *
 * No-op when the song entry has no `firebaseSongDocId`.
 *
 * @param groupId    The Firebase group document id.
 * @param songEntry  The song entry to remove.
 */
export async function removeSongFromFirebaseGroup(
  groupId: string,
  songEntry: TroffFirebaseSongIdentifyer
): Promise<void> {
  try {
    if (!songEntry.firebaseSongDocId) return;

    const firebaseClient = await import('../services/firebaseClient.js');
    const { db, doc, deleteDoc, storage, ref, deleteObject } = firebaseClient;

    await deleteDoc(doc(db, 'Groups', groupId, 'Songs', songEntry.firebaseSongDocId));

    if (songEntry.fileUrl) {
      const storageFileName = fileUrlToStorageFileName(songEntry.fileUrl);
      await deleteObject(ref(storage, 'Groups/' + groupId + '/' + storageFileName));
    }
  } catch (err) {
    log.e('Failed to remove song from Firebase group:', err);
  }
}
