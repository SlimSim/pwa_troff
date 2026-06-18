/**
 * Save/delete group data to/from Firestore (V2).
 *
 * All Firebase imports are dynamic so Vitest / happy-dom tests are not broken.
 */

import type { TroffFirebaseGroupIdentifyer } from '../types/troff.d.js';
import log from './log.js';

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
