import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

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

  it('should return 0 when songData has no incrementUntil value', () => {
    expect(getIncrementUntil({})).toBe(0);
  });

  it('should return 0 when songData is null', () => {
    expect(getIncrementUntil(null)).toBe(0);
  });

  it('should return 0 when songData is undefined', () => {
    expect(getIncrementUntil(undefined)).toBe(0);
  });
});
