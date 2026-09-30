import { describe, it, expect } from 'vitest';
import { mergeSyncedSongData } from '../utils/merge-synced-song-data.js';

/**
 * Feature spec — remote song metadata + info propagation (receive side).
 *
 * `mergeSyncedSongData(localData, remoteData)` is a WHITELIST merge: it starts
 * from the local data and only overwrites whitelisted remote keys. The
 * whitelist now contains:
 *
 *   synced from remote:
 *     - markers
 *     - aStates
 *     - TROFF_VALUE_tapTempo (deliberate: tempo IS shared)
 *     - latestUploadToFirebase
 *     - top-level `info`
 *     - the 8 shared fileData metadata fields: customName, choreography,
 *       choreographer, title, artist, album, genre, tags
 *
 *   always local (never clobbered by remote):
 *     - every other TROFF_VALUE_* key (speedBar, volumeBar, pauseBeforeStart,
 *       waitBetweenLoops, startBefore, stopAfter, incrementUntilValue)
 *     - currentStartMarker, currentStopMarker, currentViewport
 *     - localInformation
 *     - every non-shared fileData field (albumArt is never uploaded,
 *       duration stays local, ...)
 *
 * The function must never mutate its input objects.
 */

/** The 8 fileData fields shared across clients (field-wise merge whitelist). */
const SHARED_FILE_DATA_FIELDS = [
  'customName',
  'choreography',
  'choreographer',
  'title',
  'artist',
  'album',
  'genre',
  'tags',
] as const;

type FileData = Record<string, unknown>;
type SongData = Record<string, unknown>;

/** Build a fileData object where every shared field holds `<prefix>-<field>`. */
function sharedFields(prefix: string): FileData {
  const fileData: FileData = {};
  for (const field of SHARED_FILE_DATA_FIELDS) {
    fileData[field] = `${prefix}-${field}`;
  }
  return fileData;
}

// ---------------------------------------------------------------------------
// Part 1a — top-level `info`
// ---------------------------------------------------------------------------

describe('mergeSyncedSongData — top-level info', () => {
  it('takes `info` from remote when the remote data has it', () => {
    const result = mergeSyncedSongData(
      { info: 'local note', markers: [{ id: 'm1' }] },
      { info: 'remote note' }
    );

    expect(result.info).toBe('remote note');
  });

  it('keeps the local `info` when the remote data has no `info`', () => {
    const result = mergeSyncedSongData(
      { info: 'local note', markers: [{ id: 'm1' }] },
      { markers: [{ id: 'm2' }], latestUploadToFirebase: 200 }
    );

    expect(result.info).toBe('local note');
    // the still-synced field must have arrived
    expect(result.markers).toEqual([{ id: 'm2' }]);
  });
});

// ---------------------------------------------------------------------------
// Part 1b — fileData field-wise merge of the 8 shared metadata fields
// ---------------------------------------------------------------------------

describe('mergeSyncedSongData — fileData shared metadata fields', () => {
  it('takes each of the 8 shared fields from remote when remote has it', () => {
    const result = mergeSyncedSongData(
      { fileData: sharedFields('local') },
      { fileData: sharedFields('remote') }
    );

    const fileData = result.fileData as FileData;
    for (const field of SHARED_FILE_DATA_FIELDS) {
      expect(fileData[field], `fileData.${field} must come from remote`).toBe(
        `remote-${field}`
      );
    }
  });

  it('keeps local values for shared fields the remote fileData does not have', () => {
    const result = mergeSyncedSongData(
      { fileData: sharedFields('local') },
      // remote only uploaded a title — everything else must stay local
      { fileData: { title: 'Remote Title' } }
    );

    const fileData = result.fileData as FileData;
    expect(fileData.title).toBe('Remote Title');
    for (const field of SHARED_FILE_DATA_FIELDS) {
      if (field === 'title') continue;
      expect(fileData[field], `fileData.${field} must stay local`).toBe(
        `local-${field}`
      );
    }
  });

  it('preserves local-only fileData fields (albumArt, duration) that are never uploaded', () => {
    const localFileData: FileData = {
      ...sharedFields('local'),
      albumArt: 'data:image/jpeg;base64,LOCAL_ART',
      duration: 120,
    };

    const result = mergeSyncedSongData(
      { fileData: localFileData },
      // remote fileData has no albumArt (stripped on upload) and no duration
      { fileData: { title: 'Remote Title', artist: 'Remote Artist' } }
    );

    const fileData = result.fileData as FileData;
    // shared fields: remote wins
    expect(fileData.title).toBe('Remote Title');
    expect(fileData.artist).toBe('Remote Artist');
    // local-only fields survive untouched
    expect(fileData.albumArt).toBe('data:image/jpeg;base64,LOCAL_ART');
    expect(fileData.duration).toBe(120);
  });

  it('leaves local fileData untouched when the remote data has no fileData', () => {
    const localFileData: FileData = {
      ...sharedFields('local'),
      albumArt: 'data:image/jpeg;base64,LOCAL_ART',
      duration: 120,
    };

    const result = mergeSyncedSongData(
      { fileData: localFileData, markers: [{ id: 'local' }] },
      { markers: [{ id: 'remote' }], latestUploadToFirebase: 200 }
    );

    expect(result.fileData).toEqual(localFileData);
    expect(result.markers).toEqual([{ id: 'remote' }]);
  });

  it('brings the shared fields over when local has no fileData at all', () => {
    const result = mergeSyncedSongData(
      { markers: [] },
      { fileData: { title: 'Remote Title', artist: 'Remote Artist' } }
    );

    const fileData = result.fileData as FileData | undefined;
    expect(fileData).toBeDefined();
    expect(fileData!.title).toBe('Remote Title');
    expect(fileData!.artist).toBe('Remote Artist');
  });

  it('merges into a NEW fileData object and mutates neither input', () => {
    const localFileData: FileData = { ...sharedFields('local'), albumArt: 'ART' };
    const remoteFileData: FileData = { title: 'Remote Title' };
    const local: SongData = { fileData: localFileData, markers: [{ id: 'local' }] };
    const remote: SongData = { fileData: remoteFileData, latestUploadToFirebase: 200 };

    const localSnapshot = JSON.stringify(local);
    const remoteSnapshot = JSON.stringify(remote);

    const result = mergeSyncedSongData(local, remote);

    // Deep-merge nuance: fileData on the result must be a NEW object.
    expect(result.fileData).not.toBe(localFileData);
    expect(result.fileData).not.toBe(remoteFileData);
    expect(result).not.toBe(local);

    // Inputs are untouched — a second merge must see the original values.
    expect(JSON.stringify(local)).toBe(localSnapshot);
    expect(JSON.stringify(remote)).toBe(remoteSnapshot);
    expect(localFileData.title).toBe('local-title');
    expect(remoteFileData.title).toBe('Remote Title');
  });
});

// ---------------------------------------------------------------------------
// Part 1c — regression guards for the pre-existing whitelist behavior
// ---------------------------------------------------------------------------

describe('mergeSyncedSongData — regression guards (unchanged behavior)', () => {
  it('syncs markers, aStates and TROFF_VALUE_tapTempo from remote', () => {
    const result = mergeSyncedSongData(
      {
        markers: [{ id: 'local' }],
        aStates: ['{"name":"local"}'],
        TROFF_VALUE_tapTempo: 90,
        latestUploadToFirebase: 100,
      },
      {
        markers: [{ id: 'remote' }],
        aStates: ['{"name":"remote"}'],
        TROFF_VALUE_tapTempo: 120,
        latestUploadToFirebase: 200,
      }
    );

    expect(result.markers).toEqual([{ id: 'remote' }]);
    expect(result.aStates).toEqual(['{"name":"remote"}']);
    expect(result.TROFF_VALUE_tapTempo).toBe(120);
    expect(result.latestUploadToFirebase).toBe(200);
  });

  it('keeps every other TROFF_VALUE_* setting local', () => {
    const local: SongData = {
      TROFF_VALUE_speedBar: 75,
      TROFF_VALUE_volumeBar: 85,
      TROFF_VALUE_pauseBeforeStart: 1,
      TROFF_VALUE_waitBetweenLoops: 2,
      TROFF_VALUE_startBefore: 3,
      TROFF_VALUE_stopAfter: 4,
      TROFF_VALUE_incrementUntilValue: 5,
      TROFF_VALUE_tapTempo: 90,
      latestUploadToFirebase: 100,
    };
    const remote: SongData = {
      TROFF_VALUE_speedBar: 999,
      TROFF_VALUE_volumeBar: 998,
      TROFF_VALUE_pauseBeforeStart: 997,
      TROFF_VALUE_waitBetweenLoops: 996,
      TROFF_VALUE_startBefore: 995,
      TROFF_VALUE_stopAfter: 994,
      TROFF_VALUE_incrementUntilValue: 993,
      TROFF_VALUE_tapTempo: 120,
      latestUploadToFirebase: 200,
    };

    const result = mergeSyncedSongData(local, remote);

    expect(result.TROFF_VALUE_speedBar).toBe(75);
    expect(result.TROFF_VALUE_volumeBar).toBe(85);
    expect(result.TROFF_VALUE_pauseBeforeStart).toBe(1);
    expect(result.TROFF_VALUE_waitBetweenLoops).toBe(2);
    expect(result.TROFF_VALUE_startBefore).toBe(3);
    expect(result.TROFF_VALUE_stopAfter).toBe(4);
    expect(result.TROFF_VALUE_incrementUntilValue).toBe(5);
    // tapTempo is deliberately synced across users
    expect(result.TROFF_VALUE_tapTempo).toBe(120);
  });

  it('keeps currentStartMarker, currentStopMarker and currentViewport local', () => {
    const result = mergeSyncedSongData(
      {
        currentStartMarker: 'markerNr0',
        currentStopMarker: 'markerNr1S',
        currentViewport: { x: 10, y: 20 },
        latestUploadToFirebase: 100,
      },
      {
        currentStartMarker: 'remoteStart',
        currentStopMarker: 'remoteStop',
        currentViewport: { x: 999, y: 999 },
        latestUploadToFirebase: 200,
      }
    );

    expect(result.currentStartMarker).toBe('markerNr0');
    expect(result.currentStopMarker).toBe('markerNr1S');
    expect(result.currentViewport).toEqual({ x: 10, y: 20 });
  });

  it('always takes localInformation from local, even when remote sends one', () => {
    const result = mergeSyncedSongData(
      { localInformation: { nrTimesLoaded: 5 }, markers: [{ id: 'local' }] },
      { localInformation: { nrTimesLoaded: 999 }, markers: [{ id: 'remote' }] }
    );

    expect(result.localInformation).toEqual({ nrTimesLoaded: 5 });
    expect(result.markers).toEqual([{ id: 'remote' }]);
  });

  it('still applies remote-synced fields when localData is null', () => {
    const result = mergeSyncedSongData(null, {
      markers: [{ id: 'remote' }],
      info: 'remote note',
      fileData: { title: 'Remote Title' },
      latestUploadToFirebase: 200,
    });

    expect(result.markers).toEqual([{ id: 'remote' }]);
    expect(result.latestUploadToFirebase).toBe(200);
    // no local data to preserve — the remote metadata must arrive
    expect(result.info).toBe('remote note');
    expect((result.fileData as FileData).title).toBe('Remote Title');
    expect(result.localInformation).toBeUndefined();
  });
});
