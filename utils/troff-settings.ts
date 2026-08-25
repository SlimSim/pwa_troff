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
  const g = raw.replace(/\0/g, '').trim();
  const match = g.match(/^\(?\s*(\d{1,3})\s*\)?\s*(.*)$/);
  if (match) {
    const code = parseInt(match[1], 10);
    const rest = (match[2] || '').trim();
    if (rest) return rest;
    const GENRES: Record<number, string> = {0:'Blues',1:'Classic Rock',2:'Country',3:'Dance',4:'Disco',5:'Funk',6:'Grunge',7:'Hip-Hop',8:'Jazz',9:'Metal',10:'New Age',11:'Oldies',12:'Other',13:'Pop',14:'R&B',15:'Rap',16:'Reggae',17:'Rock',18:'Techno',19:'Industrial',20:'Alternative',21:'Ska',22:'Death Metal',23:'Pranks',24:'Soundtrack',25:'Euro-Techno',26:'Ambient',27:'Trip-Hop',28:'Vocal',29:'Jazz+Funk',30:'Fusion',31:'Trance',32:'Classical',33:'Instrumental',34:'Acid',35:'House',36:'Game',37:'Sound Clip',38:'Gospel',39:'Noise',40:'Alternative Rock',41:'Bass',42:'Soul',43:'Punk',44:'Space',45:'Meditative',46:'Instrumental Pop',47:'Instrumental Rock',48:'Ethnic',49:'Gothic',50:'Darkwave',51:'Techno-Industrial',52:'Electronic',53:'Pop-Folk',54:'Eurodance',55:'Dream',56:'Southern Rock',57:'Comedy',58:'Cult',59:'Gangsta',60:'Top 40',61:'Christian Rap',62:'Pop/Funk',63:'Jungle',64:'Native American',65:'Cabaret',66:'New Wave',67:'Psychedelic',68:'Rave',69:'Showtunes',70:'Trailer',71:'Lo-Fi',72:'Tribal',73:'Acid Punk',74:'Acid Jazz',75:'Polka',76:'Retro',77:'Musical',78:'Rock & Roll',79:'Hard Rock',116:'Ballad'};
    return GENRES[code] || g;
  }
  return g;
}

function _parseId3(bytes: Uint8Array): { title: string; artist: string; album: string; genre: string; info: string; bpm?: string; albumArt?: string } {
  const m: { title: string; artist: string; album: string; genre: string; info: string; bpm?: string; albumArt?: string } = { title: '', artist: '', album: '', genre: '', info: '', bpm: '' };
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
    if ((id === 'TIT2' || id === 'TPE1' || id === 'TALB' || id === 'TCON' || id === 'TBPM') && d.length > 0) {
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
      else if (id === 'TBPM') m.bpm = t;
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

async function _readId3FromFile(f: File | { name: string; lastModified: number; size: number }): Promise<{ title: string; artist: string; album: string; genre: string; info: string; bpm?: string; albumArt?: string }> {
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
  const songEntry: Record<string, unknown> = {
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
  if (meta.bpm) {
    const bpm = Number(meta.bpm.replace(/\0/g, '').trim());
    if (Number.isFinite(bpm) && bpm > 0) {
      songEntry.TROFF_VALUE_tapTempo = bpm;
    }
  }
  return songEntry;
}

