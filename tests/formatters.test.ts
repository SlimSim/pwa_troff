// Tests for formatSongForUI (utils/formatters.ts)
// This function converts TroffObjectLocal data into a UI-friendly shape.

import { describe, it, expect } from 'vitest';
import { formatSongForUI } from '../utils/formatters.js';
import type { TroffLocalInformation } from '../types/troff.d.js';

// ---- Fixtures ---------------------------------------------------------------

const baseFileData = {
  album: 'Test Album',
  artist: 'Test Artist',
  choreographer: '',
  choreography: '',
  customName: '',
  duration: 125,
  genre: 'Test Genre',
  tags: '',
  title: 'Test Song',
};

const songKey = 'test-song-key';

// A songData WITHOUT localInformation
const songDataNoLocalInfo = {
  TROFF_CLASS_TO_TOGGLE_buttStartBefore: false,
  TROFF_CLASS_TO_TOGGLE_buttStopAfter: false,
  TROFF_CLASS_TO_TOGGLE_buttWaitBetweenLoops: false,
  TROFF_CLASS_TO_TOGGLE_buttIncrementUntil: false,
  TROFF_VALUE_incrementUntilValue: 0,
  TROFF_VALUE_pauseBeforeStart: 0,
  TROFF_VALUE_speedBar: 1,
  TROFF_VALUE_startBefore: 0,
  TROFF_VALUE_stopAfter: 0,
  TROFF_VALUE_tapTempo: 0,
  TROFF_VALUE_volumeBar: 100,
  TROFF_VALUE_waitBetweenLoops: false,
  aStates: [],
  abAreas: [],
  currentStartMarker: '',
  currentStopMarker: '',
  fileData: baseFileData,
  info: '',
  latestUploadToFirebase: 0,
  localInformation: undefined as unknown as TroffLocalInformation,
  loopTimes: 0,
  markers: [],
  zoomEndTime: 0,
  zoomStartTime: 0,
};

// A songData WITH localInformation including nrTimesLoaded
const songDataWithPlayCount = {
  ...songDataNoLocalInfo,
  localInformation: {
    nrTimesLoaded: 42,
    addedFromThisDevice: true,
  },
};

// A songData WITH localInformation but nrTimesLoaded is undefined
const songDataWithEmptyPlayCount = {
  ...songDataNoLocalInfo,
  localInformation: {
    addedFromThisDevice: false,
  },
};

// ---- formatSongForUI --------------------------------------------------------

describe('formatSongForUI', () => {
  it('includes playsTotal defaulting to 0 when localInformation is undefined', () => {
    const result = formatSongForUI(songKey, songDataNoLocalInfo);
    expect(result).toHaveProperty('playsTotal');
    expect(result.playsTotal).toBe(0);
  });

  it('includes playsTotal from localInformation.nrTimesLoaded', () => {
    const result = formatSongForUI(songKey, songDataWithPlayCount);
    expect(result).toHaveProperty('playsTotal');
    expect(result.playsTotal).toBe(42);
  });

  it('defaults playsTotal to 0 when localInformation.nrTimesLoaded is undefined', () => {
    const result = formatSongForUI(songKey, songDataWithEmptyPlayCount);
    expect(result).toHaveProperty('playsTotal');
    expect(result.playsTotal).toBe(0);
  });

  it('includes the existing fields (songKey, title, artist, album, genre, duration)', () => {
    const result = formatSongForUI(songKey, songDataWithPlayCount);
    expect(result.songKey).toBe(songKey);
    expect(result.title).toBe('Test Song');
    expect(result.artist).toBe('Test Artist');
    expect(result.album).toBe('Test Album');
    expect(result.genre).toBe('Test Genre');
    expect(result.duration).toBe('2:05');
  });
});
