import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type { TroffMarker, TroffFileData } from '../types/troff.d.js';
import {
  TROFF_SETTING_EXTENDED_MARKER_COLOR,
  TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR,
} from '../constants/constants.js';

// Mock nDB before importing the module under test
const nDBGetMock = vi.fn();
vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: nDBGetMock,
    set: vi.fn(),
    setOnSong: vi.fn(),
  },
}));

let getStartBefore: (songData: Record<string, unknown> | null | undefined) => number;
let getStopAfter: (songData: Record<string, unknown> | null | undefined) => number;
let getIncrementUntil: (songData: Record<string, unknown> | null | undefined) => number;

beforeAll(async () => {
  const mod = await import('../utils/troff-settings.js');
  getStartBefore = mod.getStartBefore;
  getStopAfter = mod.getStopAfter;
  getIncrementUntil = mod.getIncrementUntil;
});

describe('getStartBefore', () => {
  beforeEach(() => {
    nDBGetMock.mockReset();
  });

  it('should return the value from songData.TROFF_VALUE_startBefore when present', () => {
    const songData = { TROFF_VALUE_startBefore: 8 };
    expect(getStartBefore(songData)).toBe(8);
  });

  it('should convert string value from songData to number', () => {
    const songData = { TROFF_VALUE_startBefore: '5' };
    expect(getStartBefore(songData)).toBe(5);
  });

  it('should fall back to nDB default when songData has no startBefore', () => {
    nDBGetMock.mockReturnValue('6');
    expect(getStartBefore({})).toBe(6);
  });

  it('should return 4 when no value is found anywhere', () => {
    nDBGetMock.mockReturnValue(undefined);
    expect(getStartBefore({})).toBe(4);
  });

  it('should return 4 when songData is null', () => {
    nDBGetMock.mockReturnValue(undefined);
    expect(getStartBefore(null)).toBe(4);
  });

  it('should return 4 when songData is undefined', () => {
    nDBGetMock.mockReturnValue(undefined);
    expect(getStartBefore(undefined)).toBe(4);
  });
});

describe('getStopAfter', () => {
  beforeEach(() => {
    nDBGetMock.mockReset();
  });

  it('should return the value from songData.TROFF_VALUE_stopAfter when present', () => {
    const songData = { TROFF_VALUE_stopAfter: 3 };
    expect(getStopAfter(songData)).toBe(3);
  });

  it('should convert string value from songData to number', () => {
    const songData = { TROFF_VALUE_stopAfter: '7' };
    expect(getStopAfter(songData)).toBe(7);
  });

  it('should fall back to nDB default when songData has no stopAfter', () => {
    nDBGetMock.mockReturnValue('5');
    expect(getStopAfter({})).toBe(5);
  });

  it('should return 2 when no value is found anywhere', () => {
    nDBGetMock.mockReturnValue(undefined);
    expect(getStopAfter({})).toBe(2);
  });

  it('should return 2 when songData is null', () => {
    nDBGetMock.mockReturnValue(undefined);
    expect(getStopAfter(null)).toBe(2);
  });
});

describe('getIncrementUntil', () => {
  beforeEach(() => {
    nDBGetMock.mockReset();
  });

  it('should return the value from songData.TROFF_VALUE_incrementUntilValue when present', () => {
    const songData = { TROFF_VALUE_incrementUntilValue: 50 };
    expect(getIncrementUntil(songData)).toBe(50);
  });

  it('should convert string value from songData to number', () => {
    const songData = { TROFF_VALUE_incrementUntilValue: '75' };
    expect(getIncrementUntil(songData)).toBe(75);
  });

  it('should fall back to nDB default when songData has no incrementUntil value', () => {
    nDBGetMock.mockReturnValue('150');
    expect(getIncrementUntil({})).toBe(150);
  });

  it('should return 100 when no value is found anywhere', () => {
    nDBGetMock.mockReturnValue(undefined);
    expect(getIncrementUntil({})).toBe(100);
  });

  it('should return 100 when songData is null', () => {
    nDBGetMock.mockReturnValue(undefined);
    expect(getIncrementUntil(null)).toBe(100);
  });

  it('should return 100 when songData is undefined', () => {
    nDBGetMock.mockReturnValue(undefined);
    expect(getIncrementUntil(undefined)).toBe(100);
  });
});

describe('configureMarkerSlider', () => {
  let configureMarkerSlider: (markerSlider: any, songData: any) => void;

  beforeAll(async () => {
    const mod = await import('../utils/troff-settings.js');
    configureMarkerSlider = mod.configureMarkerSlider;
  });

  beforeEach(() => {
    nDBGetMock.mockReset();
  });

  it('should set fillColor to "through" when both settings are unset (null)', () => {
    nDBGetMock.mockReturnValue(null);
    const slider = { fillColor: '' };
    configureMarkerSlider(slider, {});
    expect(slider.fillColor).toBe('through');
  });

  it('should set fillColor to "through" when extraExtended is true', () => {
    nDBGetMock.mockImplementation((key: string) => {
      if (key === TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR) return true;
      if (key === TROFF_SETTING_EXTENDED_MARKER_COLOR) return false;
      return null;
    });
    const slider = { fillColor: '' };
    configureMarkerSlider(slider, {});
    expect(slider.fillColor).toBe('through');
  });

  it('should set fillColor to "marker" when extended is true and extraExtended is false', () => {
    nDBGetMock.mockImplementation((key: string) => {
      if (key === TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR) return false;
      if (key === TROFF_SETTING_EXTENDED_MARKER_COLOR) return true;
      return null;
    });
    const slider = { fillColor: '' };
    configureMarkerSlider(slider, {});
    expect(slider.fillColor).toBe('marker');
  });

  it('should set fillColor to "" when both are false', () => {
    nDBGetMock.mockImplementation((key: string) => {
      if (key === TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR) return false;
      if (key === TROFF_SETTING_EXTENDED_MARKER_COLOR) return false;
      return null;
    });
    const slider = { fillColor: '' };
    configureMarkerSlider(slider, {});
    expect(slider.fillColor).toBe('');
  });

  it('should NOT default to "through" when only extraExtended is unset but extended is set', () => {
    nDBGetMock.mockImplementation((key: string) => {
      if (key === TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR) return null;
      if (key === TROFF_SETTING_EXTENDED_MARKER_COLOR) return false;
      return null;
    });
    const slider = { fillColor: '' };
    configureMarkerSlider(slider, {});
    expect(slider.fillColor).toBe('');
  });

  it('should NOT default to "through" when only extended is unset but extraExtended is set', () => {
    nDBGetMock.mockImplementation((key: string) => {
      if (key === TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR) return true;
      if (key === TROFF_SETTING_EXTENDED_MARKER_COLOR) return null;
      return null;
    });
    const slider = { fillColor: '' };
    configureMarkerSlider(slider, {});
    expect(slider.fillColor).toBe('through');
  });

  it('should handle null songData gracefully', () => {
    nDBGetMock.mockReturnValue(null);
    const slider = { fillColor: '' };
    expect(() => configureMarkerSlider(slider, null)).not.toThrow();
    expect(slider.fillColor).toBe('through');
  });
});

describe('ensureDefaultMarkers', () => {
  let ensureDefaultMarkers: (
    songData: Record<string, unknown> | null | undefined,
    songDuration: number
  ) => TroffMarker[];

  beforeAll(async () => {
    const mod = await import('../utils/troff-settings.js');
    ensureDefaultMarkers = mod.ensureDefaultMarkers;
  });

  it('should create Start and End markers when songData has no markers and duration > 0', () => {
    const songData: Record<string, unknown> = {};
    const markers = ensureDefaultMarkers(songData, 120);

    expect(markers).toHaveLength(2);
    expect(markers[0].name).toBe('Start');
    expect(markers[0].time).toBe(0);
    expect(markers[0].id).toBe('markerNr0');
    expect(markers[1].name).toBe('End');
    expect(markers[1].time).toBe(120);
    expect(markers[1].id).toBe('markerNr1');
  });

  it('should modify songData.markers in place', () => {
    const songData: Record<string, unknown> = {};
    ensureDefaultMarkers(songData, 120);

    expect(Array.isArray(songData.markers)).toBe(true);
    const markers = songData.markers as Array<{ name: string; time: number }>;
    expect(markers).toHaveLength(2);
    expect(markers[0].name).toBe('Start');
    expect(markers[1].name).toBe('End');
  });

  it('should return empty array when songData is null', () => {
    const markers = ensureDefaultMarkers(null, 120);
    expect(markers).toEqual([]);
  });

  it('should return empty array when songData is undefined', () => {
    const markers = ensureDefaultMarkers(undefined, 120);
    expect(markers).toEqual([]);
  });

  it('should return empty array when songDuration is 0', () => {
    const songData: Record<string, unknown> = {};
    const markers = ensureDefaultMarkers(songData, 0);
    expect(markers).toEqual([]);
  });

  it('should return existing markers instead of creating defaults', () => {
    const existingMarkers = [{ name: 'Custom', time: 10, info: '', color: 'None', id: 'custom1' }];
    const songData: Record<string, unknown> = { markers: existingMarkers };
    const result = ensureDefaultMarkers(songData, 120);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Custom');
    // songData.markers should not have been overwritten
    expect(songData.markers).toBe(existingMarkers);
  });

  it('should set End marker time to the song duration', () => {
    const songData: Record<string, unknown> = {};
    const markers = ensureDefaultMarkers(songData, 300);

    expect(markers[1].time).toBe(300);
  });

  it('should handle fractional song duration', () => {
    const songData: Record<string, unknown> = {};
    const markers = ensureDefaultMarkers(songData, 124.5);

    expect(markers[1].time).toBe(124.5);
  });
});

describe('createNewSongEntry', () => {
  let createNewSongEntry: (
    file: File | { name: string; lastModified: number; size: number },
    songKey: string
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;

  beforeAll(async () => {
    const mod = await import('../utils/troff-settings.js');
    createNewSongEntry = mod.createNewSongEntry;
  });

  const file = { name: 'song.mp3', lastModified: 1234, size: 5678 };

  it('creates an entry WITH default Start/End markers', async () => {
    const entry = await createNewSongEntry(file, 'song.mp3');

    const markers = entry.markers as TroffMarker[];
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({ name: 'Start', time: 0, id: 'markerNr0' });
    expect(markers[1]).toMatchObject({ name: 'End', id: 'markerNr1' });
  });

  it('uses the "max" sentinel (not a concrete number) as the default End marker time', async () => {
    const entry = await createNewSongEntry(file, 'song.mp3');

    const endMarker = (entry.markers as TroffMarker[])[1];
    // The End marker must be the 'max' sentinel — never a number copied from
    // the previously loaded song's timeline (that was the reported bug).
    expect(endMarker.time).toBe('max');
    expect(typeof endMarker.time).toBe('string');
  });

  it('defaults the current start/stop markers to the Start/End marker ids', async () => {
    const entry = await createNewSongEntry(file, 'song.mp3');

    expect(entry.currentStartMarker).toBe('markerNr0');
    expect(entry.currentStopMarker).toBe('markerNr1S');
  });

  it('stores the song key as customName and file info in fileData', async () => {
    const entry = await createNewSongEntry(file, 'song.mp3');

    expect(entry.fileData).toMatchObject({
      customName: 'song.mp3',
      duration: 0,
      lastModified: 1234,
      size: 5678,
    });
    expect(entry.localInformation).toEqual({ addedFromThisDevice: true });
  });

  const buildMinimalID3 = (
    title: string,
    artist: string,
    album: string,
    genre: string,
    comment = '',
    pic?: Uint8Array
  ) => {
    const enc = 0; // ISO-8859-1
    const term = 0;
    const makeTextFrame = (id: string, text: string) => {
      const textBytes = [...new TextEncoder().encode(text), term];
      const dataLen = 1 + textBytes.length; // encoding byte + text + terminator
      const sizeBytes = [0, 0, 0, dataLen]; // < 128 so syncsafe == big-endian
      return [
        ...id.split('').map((c) => c.charCodeAt(0)),
        ...sizeBytes,
        0,
        0, // flags
        enc,
        ...textBytes,
      ];
    };

    const makeCommentFrame = (text: string) => {
      const encC = 0;
      const lang = [101, 110, 103]; // 'eng'
      const desc = [0]; // empty short description + terminator
      const textBytes = [...new TextEncoder().encode(text), 0];
      const dataLen = 1 + 3 + 1 + textBytes.length; // enc + lang + desc + text+term
      const sizeBytes = [0, 0, 0, dataLen];
      return [
        ...'COMM'.split('').map((c) => c.charCodeAt(0)),
        ...sizeBytes,
        0,
        0, // flags
        encC,
        ...lang,
        ...desc,
        ...textBytes,
      ];
    };

    const makePicFrame = (data: Uint8Array) => {
      const mime = [...new TextEncoder().encode('image/png'), 0];
      const picType = [3];
      const desc = [0];
      const dataLen = 1 + mime.length + picType.length + desc.length + data.length;
      const sizeBytes = [0, 0, 0, dataLen];
      return [
        ...'APIC'.split('').map((c) => c.charCodeAt(0)),
        ...sizeBytes,
        0,
        0,
        enc,
        ...mime,
        ...picType,
        ...desc,
        ...Array.from(data),
      ];
    };

    const frames = [
      ...makeTextFrame('TIT2', title),
      ...makeTextFrame('TPE1', artist),
      ...makeTextFrame('TALB', album),
      ...makeTextFrame('TCON', genre),
      ...(comment ? makeCommentFrame(comment) : []),
      ...(pic ? makePicFrame(pic) : []),
    ];
    const tagSize = frames.length;
    const sizeSync = [0, 0, 0, tagSize];
    const header = [
      73,
      68,
      51, // 'ID3'
      3,
      0, // v2.3
      0, // flags
      ...sizeSync,
    ];
    return new Uint8Array([...header, ...frames]);
  };

  it('populates fileData.title/artist/album/genre from ID3 metadata when a real File containing tags is passed (regression for #40; follow-up: no customName/choreo forced, numeric genre, COMM to info)', async () => {
    const id3Bytes = buildMinimalID3(
      'My Test Title',
      'Test Artist',
      'Test Album',
      '(116)',
      'My comment here'
    );
    const fileWithMeta = new File([id3Bytes], 'song.mp3', {
      type: 'audio/mpeg',
      lastModified: 1720000000000,
    });

    // NOTE: we deliberately pass a *real* File (not the plain object used by other tests)
    // so the future implementation inside createNewSongEntry can read its .arrayBuffer()
    const entry = await createNewSongEntry(fileWithMeta, 'song.mp3');

    // the returned song entry has top-level `info` populated from COMM (e.g. "My comment here")
    expect(entry.info).toBe('My comment here');

    const fd = entry.fileData as TroffFileData;
    expect(fd.title).toBe('My Test Title');
    expect(fd.artist).toBe('Test Artist');
    expect(fd.album).toBe('Test Album');
    expect(fd.genre).toBe('Ballad'); // TCON numeric "(116)" -> "Ballad" (fix ID3 numeric genre codes)

    // fileData does NOT have customName set to filename (or the key is absent/''), and choreographer/choreography not set.
    // (I.e. on createNewSongEntry from real File import, do not force; leave unset so title from metadata is used for display name)
    expect(fd.customName).not.toBe('song.mp3');
    expect('customName' in fd).toBe(false);
    expect('choreographer' in fd).toBe(false);
    expect('choreography' in fd).toBe(false);

    // fileData only gets the usual 4 (title/artist/album/genre from meta) + usual file stats
    expect('tags' in fd).toBe(false);
    expect(fd.duration).toBe(0);
    expect(fd.lastModified).toBe(1720000000000);
    expect(fd.size).toBeGreaterThan(0);

    // existing other fields/behavior preserved
    const markers = entry.markers as TroffMarker[];
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({ name: 'Start', time: 0, id: 'markerNr0' });
    expect(markers[1]).toMatchObject({ name: 'End', id: 'markerNr1' });
    expect(entry.currentStartMarker).toBe('markerNr0');
    expect(entry.currentStopMarker).toBe('markerNr1S');
    expect(entry.localInformation).toEqual({ addedFromThisDevice: true });
  });

  it('resolves numeric genre code "116" (no parens) or "(116)" to "Ballad" (common ID3 TCON cases, support without new fields)', async () => {
    const bytes1 = buildMinimalID3('', '', '', '116');
    const f1 = new File([bytes1], 'g1.mp3', { type: 'audio/mpeg', lastModified: 100 });
    const e1 = await createNewSongEntry(f1, 'g1.mp3');
    expect((e1.fileData as TroffFileData).genre).toBe('Ballad');

    const bytes2 = buildMinimalID3('', '', '', '(116)');
    const f2 = new File([bytes2], 'g2.mp3', { type: 'audio/mpeg', lastModified: 101 });
    const e2 = await createNewSongEntry(f2, 'g2.mp3');
    expect((e2.fileData as TroffFileData).genre).toBe('Ballad');
  });

  it('extracts "Comments" (COMM frame) from metadata and puts into the existing top-level `info` field on the song entry (not on fileData); fileData only usual 4', async () => {
    const id3Bytes = buildMinimalID3('MetaTitle', 'MetaArtist', '', '(116)', 'My comment here');
    const fileWithMeta = new File([id3Bytes], 'comm.mp3', {
      type: 'audio/mpeg',
      lastModified: 200,
    });
    const entry = await createNewSongEntry(fileWithMeta, 'comm.mp3');

    expect(entry.info).toBe('My comment here');
    const fd = entry.fileData as TroffFileData;
    expect(fd.title).toBe('MetaTitle');
    expect(fd.artist).toBe('MetaArtist');
    expect(fd.genre).toBe('Ballad');
    expect(fd.album).toBe('');
    // info goes to top level song entry, not fileData
    expect((fd as any).info).toBeUndefined();
    // and not the customName etc
    expect('customName' in fd).toBe(false);
    expect('choreographer' in fd).toBe(false);
    expect('choreography' in fd).toBe(false);
  });

  it("fileData does NOT have customName set to filename (or absent/''), choreographer/choreography not set (from real File import, for #40 follow-up)", async () => {
    const id3Bytes = buildMinimalID3('OnlyTitle', '', '', '');
    const fileWithMeta = new File([id3Bytes], 'onlytitle.mp3', {
      type: 'audio/mpeg',
      lastModified: 300,
    });
    const entry = await createNewSongEntry(fileWithMeta, 'onlytitle.mp3');

    const fd = entry.fileData as TroffFileData;
    expect(fd.title).toBe('OnlyTitle'); // title from meta present for display
    expect(fd.customName).not.toBe('onlytitle.mp3');
    expect('customName' in fd).toBe(false);
    expect('choreographer' in fd).toBe(false);
    expect('choreography' in fd).toBe(false);
    // existing behavior preserved
    expect(Array.isArray(entry.markers)).toBe(true);
    expect(entry.currentStartMarker).toBe('markerNr0');
  });

  // for a future feature:
  // it('extracts albumArt as data URL from APIC frame', async () => {
  //   const tinyPng = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,15,0,0,1,1,0,5,254,241,106,0,0,0,0,73,69,78,68,174,66,96,130]);
  //   const id3Bytes = buildMinimalID3('ArtTitle', '', '', '', '', tinyPng);
  //   const fileWithMeta = new File([id3Bytes], 'art.mp3', { type: 'audio/mpeg', lastModified: 400 });
  //   const entry = await createNewSongEntry(fileWithMeta, 'art.mp3');
  //   const fd = entry.fileData as TroffFileData;
  //   expect(typeof fd.albumArt).toBe('string');
  //   expect(fd.albumArt).toMatch(/^data:image\/png;base64,/);
  //   expect(fd.albumArt!.length).toBeGreaterThan(100);
  //   expect(fd.title).toBe('ArtTitle');
  // });
});
