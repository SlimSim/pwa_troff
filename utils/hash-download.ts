import { nDB } from '../assets/internal/db.js';
import { TROFF_TROFF_DATA_ID_AND_FILE_NAME } from '../constants/constants.js';
import log from './log.js';
import { getFirestore } from './firebase-getter.js';
import { safeDecodeURIComponent } from './utils.js';
import type { TroffData, TroffMarker, TroffHistoryList, TroffDataIdObject } from '../types/troff.d.js';

const CACHE_NAME = 'songCache-v1.0';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a URL hash in the format `#serverId&fileName`.
 * Returns `null` if the hash is missing, malformed, or empty.
 *
 * Examples:
 *   `#123&my-song.mp3` → `{ serverId: 123, fileName: 'my-song.mp3' }`
 *   `#abc&test.mp3` → `null` (serverId must be numeric)
 */
export function parseHash(hash: string): { serverId: number; fileName: string } | null {
  if (!hash || !hash.startsWith('#')) {
    return null;
  }
  const hashNoHashtag = hash.substring(1);
  const ampersandIndex = hashNoHashtag.indexOf('&');
  if (ampersandIndex === -1) {
    return null;
  }
  const serverIdStr = hashNoHashtag.substring(0, ampersandIndex);
  const fileName = safeDecodeURIComponent(hashNoHashtag.substring(ampersandIndex + 1));
  const serverId = Number(serverIdStr);
  if (!Number.isFinite(serverId) || !fileName) {
    return null;
  }
  return { serverId, fileName };
}

/**
 * Download a song from the server using a hash in the format `#serverId&fileName`.
 *
 * Flow:
 * 1. Parse the hash
 * 2. Check if the song already exists in local storage (skip if it does)
 * 3. Fetch TroffData from Firestore (via Firebase SDK loaded from CDN)
 * 4. Save download link history to nDB
 * 5. Parse markers and save to nDB
 * 6. Download audio file and cache it for offline playback
 *
 * @param hash      URL hash in `#serverId&fileName` format.
 * @param callbacks Optional callbacks for progress reporting.
 * @returns The file name on success, `null` if an error occurs.
 *          User-visible error messages are shown via `alert()`.
 */
export async function downloadSongFromHash(
  hash: string,
  callbacks?: {
    /** Called with (loadedBytes, totalBytes) during audio download. */
    onProgress?: (loaded: number, total: number) => void;
  }
): Promise<string | null> {
  const parsed = parseHash(hash);
  if (!parsed) {
    alert(
      'Invalid download link. A valid link looks like:\n' +
        '  https://troff.app/v2.html#123&filename.mp3'
    );
    return null;
  }
  const { serverId, fileName } = parsed;

  // If the song already exists in local storage, no need to download
  const existingData = nDB.get(fileName);
  if (existingData) {
    log.d(`Song "${fileName}" already exists in local storage`);
    return fileName;
  }

  log.i(`Downloading song "${fileName}" from server (id: ${serverId})`);

  // Fetch TroffData from Firestore
  let troffData: TroffData;
  try {
    const { db, doc, getDoc } = await getFirestore();
    const troffDocRef = doc(db, 'TroffData', String(serverId));
    const snapshot = await getDoc(troffDocRef);
    if (!snapshot.exists()) {
      alert(
        `Could not find the song "${fileName}" on the server.\n\n` +
          'The link may be wrong, or the song has been removed. ' +
          'Please check the link and try again.'
      );
      return null;
    }
    troffData = snapshot.data() as TroffData;
  } catch (error) {
    log.e('Error fetching troff data:', error);
    if (error instanceof Error && error.message.startsWith('No Firebase config')) {
      alert(error.message);
    } else {
      alert(
        'Could not download the song due to a network error.\n\n' +
          'Please check your internet connection and try again.'
      );
    }
    return null;
  }

  // Save download link history
  saveDownloadLinkHistory(serverId, fileName, troffData);

  // Parse markers from the JSON string
  const markers = JSON.parse(troffData.markerJsonString || '{}');
  markers.serverId = serverId;
  markers.fileUrl = troffData.fileUrl;

  // Download the audio file and save marker data in parallel
  try {
    await Promise.all([
      fetchAndCacheFile(troffData.fileUrl, troffData.fileName, callbacks?.onProgress),
      nDB.set(troffData.fileName, markers),
    ]);
  } catch (error) {
    log.e('Error saving song to cache:', error);
    alert(
      `Failed to save "${fileName}" for offline playback.\n\n` +
        'This could be a temporary issue. Please try again.'
    );
    return null;
  }

  log.i(`Successfully downloaded "${fileName}"`);
  return fileName;
}

/**
 * Fetch TroffData from Firestore for a given serverId/fileName pair.
 * Returns the parsed marker data including markers, states, and info.
 * Used by the import/merge dialog when a hash link points to an existing song.
 */
export async function fetchServerTroffData(
  serverId: string | number,
  _fileName: string
): Promise<{ markers: TroffMarker[]; states: string[]; info: string; serverId: number; fileUrl: string } | null> {
  try {
    const { db, doc, getDoc } = await getFirestore();
    const troffDocRef = doc(db, 'TroffData', String(serverId));
    const snapshot = await getDoc(troffDocRef);
    if (!snapshot.exists()) {
      alert(`Could not find the song data on the server. The link may be outdated.`);
      return null;
    }
    const troffData = snapshot.data() as TroffData;
    const markerObject = JSON.parse(troffData.markerJsonString || '{}');
    return {
      markers: markerObject.markers || [],
      states: markerObject.aStates || [],
      info: markerObject.info || '',
      serverId: Number(serverId),
      fileUrl: troffData.fileUrl || '',
    };
  } catch (error) {
    log.e('Error fetching server troff data:', error);
    if (error instanceof Error && error.message.startsWith('No Firebase config')) {
      alert(error.message);
    } else {
      alert('Could not fetch the song data from the server due to a network error.');
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a file from a remote URL and store it in the cache for offline playback.
 *
 * When an `onProgress` callback is provided and the server sends a
 * `Content-Length` header, the download stream is intercepted to call the
 * callback with (loadedBytes, totalBytes) for every chunk received.
 */
async function fetchAndCacheFile(
  fileUrl: string,
  songKey: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Fetch failed for ${songKey}: ${response.statusText}`);
  }

  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? Number(contentLength) : 0;

  const cache = await caches.open(CACHE_NAME);
  const headers = new Headers(response.headers);

  if (onProgress && total > 0 && response.body) {
    // Intercept the response stream to measure progress
    let loaded = 0;
    const reader = response.body.getReader();
    const stream = new ReadableStream({
      async start(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          loaded += value.length;
          onProgress(loaded, total);
          controller.enqueue(value);
        }
        controller.close();
      },
    });

    const cachedResponse = new Response(stream, {
      status: 200,
      statusText: 'OK',
      headers,
    });
    await cache.put(songKey, cachedResponse);
  } else {
    const cachedResponse = new Response(response.body, {
      status: 200,
      statusText: 'OK',
      headers,
    });
    await cache.put(songKey, cachedResponse);
  }
}

/**
 * Save the download link history to nDB for tracking.
 * Mirrors the v1 `saveDownloadLinkHistory` method in `scriptTroffClass.ts`.
 */
function saveDownloadLinkHistory(
  serverTroffDataId: number,
  fileName: string,
  troffData: { markerJsonString: string }
): void {
  const fileNameUri = encodeURI(fileName);
  const markerObject = JSON.parse(troffData.markerJsonString || '{}');
  const fileData = markerObject.fileData;

  const displayName =
    fileData?.customName || fileData?.choreography || fileData?.title || fileName;
  const nrMarkers = Array.isArray(markerObject.markers) ? markerObject.markers.length : 0;
  const nrStates = Array.isArray(markerObject.aStates) ? markerObject.aStates.length : 0;
  const info = (markerObject.info || '').substring(0, 99);
  const genre = fileData?.genre || '';
  const tags = fileData?.tags || '';

  const serverSongs: TroffHistoryList[] = nDB.get(TROFF_TROFF_DATA_ID_AND_FILE_NAME) || [];

  const newEntry: TroffDataIdObject = {
    troffDataId: serverTroffDataId,
    firstTimeLoaded: new Date().getTime(),
    displayName,
    nrMarkers,
    nrStates,
    infoBeginning: info,
    genre,
    tags,
  };

  const existing = serverSongs.find((ss) => ss.fileNameUri === fileNameUri);
  if (existing) {
    const alreadyHas = existing.troffDataIdObjectList.some(
      (td) => td.troffDataId === serverTroffDataId
    );
    if (!alreadyHas) {
      existing.troffDataIdObjectList.push(newEntry);
    }
  } else {
    serverSongs.push({
      fileNameUri,
      troffDataIdObjectList: [newEntry],
    });
  }

  nDB.set(TROFF_TROFF_DATA_ID_AND_FILE_NAME, serverSongs);
}
