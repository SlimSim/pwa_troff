import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type { TroffMarker } from '../types/troff.d.js';
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
    const existingMarkers = [
      { name: 'Custom', time: 10, info: '', color: 'None', id: 'custom1' },
    ];
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
