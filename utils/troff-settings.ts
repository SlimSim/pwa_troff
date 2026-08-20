import { nDB } from '../assets/internal/db.js';
import { MarkerSlider } from '../components/organisms/t-marker-slider.js';
import type { TroffMarker } from '../types/troff.d.js';
import {
  TROFF_SETTING_EXTENDED_MARKER_COLOR,
  TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR,
  TROFF_SETTING_SONG_DEFAULT_START_BEFORE_ON,
  TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_ON,
} from '../constants/constants.js';

export function getStartBefore(songData: any): number {
  const startBeforeValue = songData?.TROFF_VALUE_startBefore;
  if (startBeforeValue !== undefined) {
    return Number(startBeforeValue);
  }
  const defaultSavedValue = nDB.get(
    'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_START_BEFORE_VALUE'
  );
  return Number(defaultSavedValue) || 4;
}

export function getStopAfter(songData: any): number {
  const stopAfterValue = songData?.TROFF_VALUE_stopAfter;
  if (stopAfterValue !== undefined) {
    return Number(stopAfterValue);
  }
  const defaultSavedValue = nDB.get('TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_VALUE');
  return Number(defaultSavedValue) || 2;
}

export function getIncrementUntil(songData: Record<string, unknown> | null | undefined): number {
  const incrementUntilValue = songData?.TROFF_VALUE_incrementUntilValue;
  if (incrementUntilValue !== undefined) {
    return Number(incrementUntilValue);
  }
  const defaultSavedValue = nDB.get(
    'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_VALUE'
  );
  return Number(defaultSavedValue) || 100;
}

/**
 * Check whether startBefore is disabled for a given song.
 * Returns `true` when the dial is toggled off (disabled), so the region should NOT extend.
 */
function isStartBeforeDisabled(songData: any): boolean {
  if (songData?.TROFF_CLASS_TO_TOGGLE_buttStartBefore === undefined) {
    const globalOn = nDB.get(TROFF_SETTING_SONG_DEFAULT_START_BEFORE_ON) ?? false;
    return !globalOn;
  }
  return songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore === false;
}

/**
 * Check whether stopAfter is disabled for a given song.
 */
function isStopAfterDisabled(songData: any): boolean {
  if (songData?.TROFF_CLASS_TO_TOGGLE_buttStopAfter === undefined) {
    const globalOn = nDB.get(TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_ON) ?? false;
    return !globalOn;
  }
  return songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter === false;
}

export function configureMarkerSlider(markerSlider: MarkerSlider, songData: any) {
  markerSlider.startMarkerId = songData?.currentStartMarker || '';
  markerSlider.stopMarkerId = songData?.currentStopMarker || '';
  markerSlider.startBefore = isStartBeforeDisabled(songData) ? 0 : getStartBefore(songData);
  markerSlider.stopAfter = isStopAfterDisabled(songData) ? 0 : getStopAfter(songData);

  const extraExtendedSetting = nDB.get(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR);
  const extendedSetting = nDB.get(TROFF_SETTING_EXTENDED_MARKER_COLOR);
  const bothUnset = extraExtendedSetting === null && extendedSetting === null;
  const isExtraExtended = bothUnset || extraExtendedSetting === true;
  const isExtended = extendedSetting === true;

  if (isExtraExtended) {
    markerSlider.fillColor = 'through';
  } else if (isExtended) {
    markerSlider.fillColor = 'marker';
  } else {
    markerSlider.fillColor = '';
  }
}

/**
 * Create default Start/End markers on a song if it has no markers and song duration > 0.
 * Modifies songData.markers in place.
 * @returns The markers array (either existing or newly created defaults).
 */
export function ensureDefaultMarkers(
  songData: Record<string, unknown> | null | undefined,
  songDuration: number
): TroffMarker[] {
  if (!songData || songDuration <= 0) {
    return [];
  }
  const markers = Array.isArray(songData.markers) ? (songData.markers as TroffMarker[]) : [];
  if (markers.length > 0) {
    return markers;
  }

  const defaultMarkers: TroffMarker[] = [
    { name: 'Start', time: 0, info: '', color: 'None', id: 'markerNr0' },
    { name: 'End', time: songDuration, info: '', color: 'None', id: 'markerNr1' },
  ];
  songData.markers = defaultMarkers;
  return defaultMarkers;
}
 
function _syncsafeToInt(b: Uint8Array, o: number): number {
  return ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
}

function _resolveGenre(raw: string): string {
  if (!raw) return '';
  let g = raw.replace(/\0/g, '').trim();
  const match = g.match(/^\(?\s*(\d{1,3})\s*\)?\s*(.*)$/);
  if (match) {
    const code = parseInt(match[1], 10);
    const rest = (match[2] || '').trim();
    if (code === 116) return 'Ballad';
    if (rest) return rest;
    return g;
  }
  return g;
}

function _parseId3(bytes: Uint8Array): { title: string; artist: string; album: string; genre: string; info: string; albumArt?: string } {
  const m: { title: string; artist: string; album: string; genre: string; info: string; albumArt?: string } = { title: '', artist: '', album: '', genre: '', info: '' };
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return m;
  const ver = bytes[3];
  if (ver !== 3 && ver !== 4) return m;
  const tagSize = _syncsafeToInt(bytes, 6);
  let p = 10;
  const e = Math.min(10 + tagSize, bytes.length);
  while (p + 10 <= e) {
    const id = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);
    if (id.charCodeAt(0) === 0) break;
    let sz = _syncsafeToInt(bytes, p + 4);
    if (ver === 3) sz = (bytes[p + 4] << 24) | (bytes[p + 5] << 16) | (bytes[p + 6] << 8) | bytes[p + 7];
    p += 10;
    if (sz <= 0 || p + sz > e) break;
    const d = bytes.subarray(p, p + sz);
    if ((id === 'TIT2' || id === 'TPE1' || id === 'TALB' || id === 'TCON') && d.length > 0) {
      const enc = d[0];
      let t = '';
      const tb = d.subarray(1);
      if (enc === 0 || enc === 3) {
        let l = tb.length;
        while (l > 0 && tb[l - 1] === 0) l--;
        t = enc === 0 ? Array.from(tb.subarray(0, l)).map((c) => String.fromCharCode(c)).join('') : new TextDecoder().decode(tb.subarray(0, l));
      } else if (enc === 1) {
        const le = tb.length > 1 && tb[0] === 0xff && tb[1] === 0xfe;
        try {
          t = new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(tb.subarray(2));
        } catch { /* ignore */ }
      }
      t = t.replace(/\0/g, '').trim();
      if (id === 'TIT2') m.title = t;
      else if (id === 'TPE1') m.artist = t;
      else if (id === 'TALB') m.album = t;
      else if (id === 'TCON') m.genre = _resolveGenre(t);
    } else if (id === 'COMM' && d.length > 4) {
      const enc = d[0];
      let start = 4; // after enc + 3-byte lang
      if (enc === 0 || enc === 3) {
        while (start < d.length && d[start] !== 0) start++;
        start++;
        const tb = d.subarray(start);
        let l = tb.length;
        while (l > 0 && tb[l - 1] === 0) l--;
        let t = Array.from(tb.subarray(0, l)).map((c) => String.fromCharCode(c)).join('');
        m.info = t.replace(/\0/g, '').trim();
      } else if (enc === 1) {
        while (start + 1 < d.length && !(d[start] === 0 && d[start + 1] === 0)) start += 2;
        start += 2;
        if (start < d.length) {
          const hasBom = start + 1 < d.length && (d[start] === 0xff || d[start] === 0xfe);
          const le = hasBom && d[start] === 0xff && d[start + 1] === 0xfe;
          const textStart = hasBom ? start + 2 : start;
          try {
            const dec = new TextDecoder(le ? 'utf-16le' : 'utf-16be');
            let t = dec.decode(d.subarray(textStart));
            m.info = t.replace(/\0/g, '').trim();
          } catch { /* ignore */ }
        }
      }
    } else if (id === 'APIC' && d.length > 0) {
      let start = -1;
      let mtype = 'image/jpeg';
      for (let k = 0; k < d.length - 3; k++) {
        if (d[k] === 0xff && d[k + 1] === 0xd8) {
          start = k;
          mtype = 'image/jpeg';
          break;
        }
        if (d[k] === 0x89 && d[k + 1] === 0x50 && d[k + 2] === 0x4e && d[k + 3] === 0x47) {
          start = k;
          mtype = 'image/png';
          break;
        }
      }
      if (start >= 0) {
        const picData = d.subarray(start);
        if (picData.length > 0) {
          try {
            let binary = '';
            const len = picData.length;
            for (let j = 0; j < len; j++) binary += String.fromCharCode(picData[j]);
            const b64 = btoa(binary);
            m.albumArt = `data:${mtype};base64,${b64}`;
          } catch { void 0; }
        }
      }
    }
    p += sz;
  }
  return m;
}

async function _readId3FromFile(f: File | { name: string; lastModified: number; size: number }): Promise<{ title: string; artist: string; album: string; genre: string; info: string; albumArt?: string }> {
  const hasArrayBuffer = f && typeof (f as { arrayBuffer?: unknown }).arrayBuffer === 'function';
  if (!hasArrayBuffer) return { title: '', artist: '', album: '', genre: '', info: '' };
  try {
    const buf = await (f as File).arrayBuffer();
    return _parseId3(new Uint8Array(buf));
  } catch {
    return { title: '', artist: '', album: '', genre: '', info: '' };
  }
}

/**
 * Build the nDB song entry for a brand-new locally added file.
 *
 * The entry is created WITH default markers so the legacy DB cleanup can never
 * inject a stale number as the End marker time. The End marker uses the 'max'
 * sentinel (resolved to the actual timeline end once the song loads) instead
 * of a concrete value, because at creation time the real duration is unknown
 * and the current timeline length belongs to the previously loaded song.
 */
export async function createNewSongEntry(
  file: File | { name: string; lastModified: number; size: number },
  songKey: string
): Promise<Record<string, unknown>> {
  const meta = await _readId3FromFile(file);
  const hasArrayBuffer = file && typeof (file as { arrayBuffer?: unknown }).arrayBuffer === 'function';
  const baseFileData = {
    album: meta.album,
    artist: meta.artist,
    duration: 0,
    genre: meta.genre,
    title: meta.title,
    lastModified: file.lastModified,
    size: file.size,
    ...(meta.albumArt ? { albumArt: meta.albumArt } : {}),
  };
  const fileData = hasArrayBuffer
    ? baseFileData
    : {
        ...baseFileData,
        choreographer: '',
        choreography: '',
        customName: songKey,
        tags: '',
      };
  return {
    fileData,
    localInformation: {
      addedFromThisDevice: true,
    },
    markers: [
      { name: 'Start', time: 0, info: '', color: 'None', id: 'markerNr0' },
      { name: 'End', time: 'max', info: '', color: 'None', id: 'markerNr1' },
    ],
    currentStartMarker: 'markerNr0',
    currentStopMarker: 'markerNr1S',
    info: meta.info || '',
  };
}

