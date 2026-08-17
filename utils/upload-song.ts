// Upload the current song + markers to the backend so it can be shared via link.
// Firebase imports are dynamic so Vitest / happy-dom tests are not broken
// (same pattern as utils/firebase-group-sync.ts).

import { nDB } from '../assets/internal/db.js';
import { removeLocalInfo } from './utils.js';
import { saveDownloadLinkHistory } from './hash-download.js';
import log from './log.js';
import type { TroffData } from '../types/troff.d.js';

export function crc32Hash(r: string): number {
  // exact v1 algorithm (services/file.ts): table-based CRC-32, returns (-1 ^ n) >>> 0
  const table: number[] = [];
  for (let c = 0; c < 256; c++) {
    let a = c;
    for (let f = 0; f < 8; f++) a = 1 & a ? 3988292384 ^ (a >>> 1) : a >>> 1;
    table[c] = a;
  }
  let n = -1;
  for (let t = 0; t < r.length; t++) n = (n >>> 8) ^ table[255 & (n ^ r.charCodeAt(t))];
  return (-1 ^ n) >>> 0;
}

export function buildShareUrl(serverId: string | number, fileName: string): string {
  return window.location.origin + '#' + serverId + '&' + encodeURI(fileName);
}

/**
 * sha-256 hex of the file content (mirrors v1 hashFile: FileReader.readAsBinaryString
 * then crypto.subtle.digest over JSON.stringify of the result, hex-encoded).
 */
async function hashFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!event?.target?.result) return resolve('');
        const data = event.target.result;
        const msgUint8 = new TextEncoder().encode(JSON.stringify(data));
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        resolve(hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export async function uploadSongToServer(
  songKey: string
): Promise<{ id: number; fileUrl: string; fileName: string } | null> {
  try {
    const markerObject = nDB.get(songKey);
    if (!markerObject) return null;

    const cachedResponse = await caches.match(songKey); // global caches API
    if (!cachedResponse) return null;

    const blob = await cachedResponse.blob();
    const file = new File([blob], songKey, { type: blob.type });

    const fileHash = await hashFile(file);

    const firebaseClient = await import('../services/firebaseClient.js');
    const { storage, ref, uploadBytesResumable, getDownloadURL, db, doc, setDoc } = firebaseClient;

    const fileRef = ref(storage, 'TroffFiles/' + fileHash);
    let fileUrl: string;
    try {
      fileUrl = await getDownloadURL(fileRef);
    } catch {
      const task = await uploadBytesResumable(fileRef, file);
      fileUrl = await getDownloadURL(task.ref);
    }

    const publicData = removeLocalInfo(markerObject);
    const troffData: TroffData = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileUrl,
      troffDataPublic: true,
      troffDataUploadedMillis: new Date().getTime(),
      markerJsonString: JSON.stringify(publicData),
      id: 0, // placeholder, replaced below
    };
    // id is computed from the troffData object WITHOUT the id field (v1 semantics)
    const { id: _placeholder, ...troffDataWithoutId } = troffData;
    const id = crc32Hash(JSON.stringify(troffDataWithoutId));
    troffData.id = id;

    await setDoc(doc(db, 'TroffData', String(id)), troffData);

    nDB.setOnSong(songKey, 'serverId', id);
    nDB.setOnSong(songKey, 'fileUrl', fileUrl);

    // Mirrors v1 uploadSongToServer (scriptTroffClass.ts:298): record the upload
    // in the download-link history so it appears in find.html.
    saveDownloadLinkHistory(id, troffData.fileName, {
      markerJsonString: JSON.stringify(markerObject),
    });

    return { id, fileUrl, fileName: troffData.fileName };
  } catch (error) {
    log.e('uploadSongToServer failed:', error);
    return null;
  }
}