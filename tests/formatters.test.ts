// Tests for formatSongForUI (utils/formatters.ts)
// This function converts TroffObjectLocal data into a UI-friendly shape.

import { describe, it, expect } from 'vitest';
import { formatSongForUI } from '../utils/formatters.js';
import type { TroffLocalInformation } from '../types/troff.js';

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

// Timestamp helper: one day in ms
const DAY_MS = 24 * 60 * 60 * 1000;

// A songData with songStartsLastMonth containing recent entries (within 30 days) and old entries (outside 30 days)
const songDataWithMixedStarts = {
  ...songDataNoLocalInfo,
  localInformation: {
    nrTimesLoaded: 10,
    addedFromThisDevice: true,
    songStartsLastMonth: [
      Date.now() - 2 * DAY_MS,    // 2 days ago (within 30)
      Date.now() - 10 * DAY_MS,   // 10 days ago (within 30)
      Date.now() - 40 * DAY_MS,   // 40 days ago (outside 30)
      Date.now() - 60 * DAY_MS,   // 60 days ago (outside 30)
      Date.now() - 1 * DAY_MS,    // 1 day ago (within 30)
    ],
  },
};

// A songData with songStartsLastMonth containing ONLY recent entries
const songDataWithAllRecentStarts = {
  ...songDataNoLocalInfo,
  localInformation: {
    addedFromThisDevice: true,
    songStartsLastMonth: [
      Date.now() - 1 * DAY_MS,
      Date.now() - 5 * DAY_MS,
      Date.now() - 29 * DAY_MS,   // 29 days ago (still within 30)
    ],
  },
};

// A songData where songStartsLastMonth is undefined
const songDataNoStarts = {
  ...songDataNoLocalInfo,
  localInformation: {
    addedFromThisDevice: true,
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

  it('includes playsMonth defaulting to 0 when songStartsLastMonth is undefined', () => {
    const result = formatSongForUI(songKey, songDataNoStarts);
    expect(result).toHaveProperty('playsMonth');
    expect(result.playsMonth).toBe(0);
  });

  it('counts playsMonth from songStartsLastMonth entries within the last 30 days', () => {
    const result = formatSongForUI(songKey, songDataWithMixedStarts);
    // 3 entries within 30 days, 2 entries older than 30 days
    expect(result.playsMonth).toBe(3);
  });

  it('excludes entries older than 30 days from playsMonth', () => {
    const result = formatSongForUI(songKey, songDataWithAllRecentStarts);
    // All 3 entries are within 30 days
    expect(result.playsMonth).toBe(3);
  });

  it('includes playsMonth alongside existing fields', () => {
    const result = formatSongForUI(songKey, songDataWithPlayCount);
    expect(result).toHaveProperty('playsMonth');
    expect(result).toHaveProperty('playsTotal');
    expect(result).toHaveProperty('songKey');
    expect(result.songKey).toBe(songKey);
  });
});
