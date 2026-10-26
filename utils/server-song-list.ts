/**
 * Data layer for the merged local + server song search.
 *
 * - `refreshServerSongList()` lazily fetches the public TroffData collection
 *   (plus the docs the user has downloaded locally), merges them with the
 *   local download history and caches the result in nDB — a module-level
 *   session guard means it only ever hits Firebase once per session.
 * - `getCachedServerSongList()` reads that cache (always merged with the
 *   local history, so history-only songs/versions survive).
 * - `getCachedVersionInfo()` reads a module-level session cache of the
 *   full marker payloads + duration kept during the refresh (keyed by
 *   troffDataId, never persisted to nDB), so the "More about version" dialog
 *   needs no per-click Firestore fetch.
 * - The remaining exports are pure helpers (mirroring the historical find.ts
 *   behaviour, but implemented fresh — find.ts is legacy and never imported).
 *
 * services/firebaseClient.js is imported LAZILY inside the refresh: it pulls
 * Firebase CDN modules that only resolve in the browser, so a static import
 * here would break every test/entry that touches this module indirectly.
 */
import { nDB } from '../assets/internal/db.js';
import {
  TROFF_SERVER_SONG_LIST_FROM_SERVER,
  TROFF_TROFF_DATA_ID_AND_FILE_NAME,
} from '../constants/constants.js';
import { matchesServerSongSearch } from './find-search.js';
import { safeDecodeURIComponent } from './utils.js';
import type {
  ServerSong,
  TroffData,
  TroffDataIdObject,
  TroffFileData,
  TroffHistoryList,
  TroffMarker,
} from '../types/troff.d.js';

export type ServerSongTab = 'tracks' | 'groups' | 'artists' | 'genre';

/** Upload millis older than this are treated as "missing" (legacy find.ts rule). */
const UPLOAD_MILLIS_MIN = 162431283500;

/** Session guard: the one in-flight/resolved refresh shared by every caller. */
let refreshPromise: Promise<ServerSong[]> | null = null;

/** Session-memory version info cache (keyed by troffDataId) — never persisted to nDB. */
const versionInfoById = new Map<number, { markers: TroffMarker[]; duration: number; info: string }>();

export function resetServerSongListForTests(): void {
  refreshPromise = null;
  versionInfoById.clear();
}

export function getCachedVersionInfo(
  troffDataId: number
): { markers: TroffMarker[]; duration: number; info?: string } | null {
  return versionInfoById.get(troffDataId) ?? null;
}

export function refreshServerSongList(): Promise<ServerSong[]> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetchAndCacheServerSongList().catch((error: unknown) => {
    // Allow a retry after a failed fetch (concurrent callers still share one try).
    refreshPromise = null;
    throw error;
  });
  return refreshPromise;
}

async function fetchAndCacheServerSongList(): Promise<ServerSong[]> {
  const { db, collection, getDocs } = await import('../services/firebaseClient.js');
  const snapshot = await getDocs(collection(db, 'TroffData'));
  const history = getLocalHistory();

  const troffDataList: TroffData[] = [];
  for (const doc of snapshot.docs) {
    const troffData = doc.data() as TroffData;
    if (troffData.troffDataPublic === true || isInLocalHistory(troffData, history)) {
      troffDataList.push(troffData);
      const songJson = parseSongJson(troffData.markerJsonString);
      versionInfoById.set(troffData.id, {
        markers: songJson.markers,
        duration: Number(songJson.fileData?.duration) || 0,
        info: songJson.info || '',
      });
    }
  }

  const merged = mergeServerSongListWithHistory(
    troffDataListToServerSongList(troffDataList),
    history
  );
  nDB.set(TROFF_SERVER_SONG_LIST_FROM_SERVER, merged);
  return merged;
}

/** Keep non-public docs the user has downloaded locally (same file + version id). */
function isInLocalHistory(troffData: TroffData, history: TroffHistoryList[]): boolean {
  const fileNameUri = encodeURI(troffData.fileName);
  const historySong = history.find((entry) => entry.fileNameUri === fileNameUri);
  return (
    historySong?.troffDataIdObjectList.some((version) => version.troffDataId === troffData.id) ??
    false
  );
}

function getLocalHistory(): TroffHistoryList[] {
  const history: TroffHistoryList[] | null = nDB.get(TROFF_TROFF_DATA_ID_AND_FILE_NAME);
  return Array.isArray(history) ? history : [];
}

export function getCachedServerSongList(): ServerSong[] {
  const cached: ServerSong[] | null = nDB.get(TROFF_SERVER_SONG_LIST_FROM_SERVER);
  if (!Array.isArray(cached)) return [];
  return mergeServerSongListWithHistory(cached, getLocalHistory());
}

export function troffDataListToServerSongList(troffDataList: TroffData[]): ServerSong[] {
  const serverSongList: ServerSong[] = [];

  for (const troffData of troffDataList) {
    const fileNameUri = encodeURI(troffData.fileName);
    const currentServerSong = serverSongList.find((song) => song.fileNameUri === fileNameUri);

    if (currentServerSong === undefined) {
      serverSongList.push({
        deleted: troffData.deleted ?? false,
        fileNameUri,
        size: troffData.fileSize,
        troffDataIdObjectList: [troffDataToTroffDataIdObject(troffData)],
        type: troffData.fileType,
        uploaded: troffData.troffDataUploadedMillis,
      });
      continue;
    }

    if (troffData.deleted === true) {
      currentServerSong.deleted = true;
    }
    currentServerSong.uploaded = getEarliestValidTime(
      currentServerSong.uploaded,
      troffData.troffDataUploadedMillis
    );
    currentServerSong.troffDataIdObjectList.push(troffDataToTroffDataIdObject(troffData));
  }

  return serverSongList;
}

export function troffDataToTroffDataIdObject(troffData: TroffData): TroffDataIdObject {
  const songJson = parseSongJson(troffData.markerJsonString);
  const fileData = songJson.fileData;
  const info = songJson.info;

  const firstTimeLoaded = isValidUploadMillis(troffData.troffDataUploadedMillis)
    ? troffData.troffDataUploadedMillis
    : fileData?.lastModified !== undefined && fileData.lastModified > 0
      ? fileData.lastModified
      : 0;

  return {
    troffDataId: troffData.id,
    displayName: fileData?.customName || fileData?.choreography || fileData?.title || 'Unknown',
    firstTimeLoaded,
    genre: fileData?.genre || '',
    info,
    infoBeginning: info.substring(0, 99),
    nrMarkers: songJson.markers.length,
    nrStates: songJson.aStates.length,
    tags: fileData?.tags || '',
    customName: fileData?.customName,
    choreography: fileData?.choreography,
    title: fileData?.title,
    artist: fileData?.artist,
    album: fileData?.album,
    choreographer: fileData?.choreographer,
  };
}

export function mergeServerSongListWithHistory(
  serverSongs: ServerSong[],
  history: TroffHistoryList[]
): ServerSong[] {
  const merged: ServerSong[] = serverSongs.map((song) => ({
    ...song,
    troffDataIdObjectList: [...song.troffDataIdObjectList],
  }));
  const songsByUri = new Map(merged.map((song) => [song.fileNameUri, song]));

  for (const historySong of history) {
    const existing = songsByUri.get(historySong.fileNameUri);

    if (existing) {
      const knownIds = new Set(
        existing.troffDataIdObjectList.map((version) => version.troffDataId)
      );
      for (const version of historySong.troffDataIdObjectList) {
        if (!knownIds.has(version.troffDataId)) {
          existing.troffDataIdObjectList.push(version);
          knownIds.add(version.troffDataId);
        }
      }
      continue;
    }

    const song: ServerSong = {
      deleted: false,
      fileNameUri: historySong.fileNameUri,
      size: 0,
      troffDataIdObjectList: [...historySong.troffDataIdObjectList],
      type: '',
      uploaded: 0,
    };
    merged.push(song);
    songsByUri.set(song.fileNameUri, song);
  }

  return merged;
}

export function filterServerSongs(
  songs: ServerSong[],
  query: string,
  tab: ServerSongTab
): ServerSong[] {
  // Mirror utils/media-search.ts: an empty/whitespace query returns the
  // input array unchanged (same reference).
  if (query.trim() === '') return songs;
  const needle = query.trim().toLowerCase();

  // Version-level filtering: each song is replaced by a shallow copy holding
  // only its matching versions; songs left with no matching version are dropped.
  return songs
    .map((song) => {
      const fileName = safeDecodeURIComponent(song.fileNameUri);

      const matchingVersions = song.troffDataIdObjectList.filter((version) => {
        if (tab === 'artists') {
          return (version.artist ?? '').toLowerCase().includes(needle);
        }
        if (tab === 'genre') {
          return (version.genre ?? '').toLowerCase().includes(needle);
        }
        return matchesServerSongSearch(query, fileName, version);
      });

      if (matchingVersions.length === 0) return undefined;
      return { ...song, troffDataIdObjectList: matchingVersions };
    })
    .filter((song): song is ServerSong => song !== undefined);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ParsedSongJson {
  markers: TroffMarker[];
  aStates: unknown[];
  info: string;
  fileData: TroffFileData | undefined;
}

function parseSongJson(markerJsonString: string): ParsedSongJson {
  try {
    const parsed = JSON.parse(markerJsonString || '{}') as {
      markers?: TroffMarker[];
      aStates?: unknown[];
      info?: string;
      fileData?: TroffFileData;
    };
    return {
      markers: Array.isArray(parsed.markers) ? parsed.markers : [],
      aStates: Array.isArray(parsed.aStates) ? parsed.aStates : [],
      info: typeof parsed.info === 'string' ? parsed.info : '',
      fileData: parsed.fileData,
    };
  } catch {
    return { markers: [], aStates: [], info: '', fileData: undefined };
  }
}

function isValidUploadMillis(millis: number): boolean {
  return Number.isFinite(millis) && millis >= UPLOAD_MILLIS_MIN;
}

/** Earliest upload time, ignoring missing/legacy millis (find.ts behaviour). */
function getEarliestValidTime(m1: number, m2: number): number {
  const m1Valid = isValidUploadMillis(m1);
  const m2Valid = isValidUploadMillis(m2);
  if (m1Valid && m2Valid) return Math.min(m1, m2);
  if (m1Valid) return m1;
  if (m2Valid) return m2;
  return 0;
}
