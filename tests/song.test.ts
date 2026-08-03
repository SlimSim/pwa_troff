// Tests for getSongDisplayName and getSongMetadata (utils/song.ts)
// Issue #24: display names must be URL-decoded everywhere (e.g. "My%20Song.mp3"
// should display as "My Song.mp3").

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock nDB before importing the module under test.
// utils/song.ts statically imports nDB from db.js; vi.mock is hoisted.
// The module under test is imported dynamically (in beforeAll) so the mock
// factory's reference to nDBGetMock is initialized by the time it runs.
// ---------------------------------------------------------------------------

const nDBGetMock = vi.fn();
vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: nDBGetMock,
    set: vi.fn(),
    setOnSong: vi.fn(),
  },
}));

interface FileData {
  customName?: string;
  choreography?: string;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  duration?: number;
}

interface SongMetadata {
  title: string;
  artist: string;
  duration: number;
}

let getSongDisplayName: (fileData: FileData, defaultValue: string) => string;
let getSongMetadata: (songKey: string) => SongMetadata | null;

beforeAll(async () => {
  const mod = await import('../utils/song.js');
  getSongDisplayName = mod.getSongDisplayName;
  getSongMetadata = mod.getSongMetadata;
});

// ---- getSongDisplayName ----------------------------------------------------

describe('getSongDisplayName', () => {
  it('decodes percent-encoded customName', () => {
    expect(getSongDisplayName({ customName: 'My%20Song.mp3' }, 'default.mp3')).toBe(
      'My Song.mp3'
    );
  });

  it('decodes percent-encoded choreography when customName is empty', () => {
    expect(getSongDisplayName({ customName: '', choreography: 'Choreo%20Name' }, 'default.mp3')).toBe(
      'Choreo Name'
    );
  });

  it('decodes percent-encoded title when customName and choreography are empty', () => {
    expect(
      getSongDisplayName({ customName: '', choreography: '', title: 'Tit%20Le' }, 'default.mp3')
    ).toBe('Tit Le');
  });

  it('decodes percent-encoded defaultValue when all display fields are empty', () => {
    expect(getSongDisplayName({ customName: '', choreography: '', title: '' }, 'Fall%20Back')).toBe(
      'Fall Back'
    );
  });

  it('leaves plain names without percent-encoding unchanged', () => {
    expect(getSongDisplayName({ customName: 'Plain Name.mp3' }, 'default.mp3')).toBe(
      'Plain Name.mp3'
    );
  });

  it('keeps invalid percent-encoding unchanged (safe fallback)', () => {
    expect(getSongDisplayName({ customName: '100% Pure.mp3' }, 'default.mp3')).toBe(
      '100% Pure.mp3'
    );
  });
});

// ---- getSongMetadata -------------------------------------------------------

describe('getSongMetadata', () => {
  beforeEach(() => {
    nDBGetMock.mockReset();
  });

  it('returns null for an empty songKey', () => {
    expect(getSongMetadata('')).toBeNull();
  });

  it('decodes the fallback title derived from songKey when nDB has no data', () => {
    nDBGetMock.mockReturnValue(undefined);
    expect(getSongMetadata('folder/My%20Song.mp3')).toEqual({
      title: 'My Song.mp3',
      artist: 'Unknown Artist',
      duration: 0,
    });
  });

  it('decodes title (from songKey default) and artist when fileData has no display name', () => {
    nDBGetMock.mockReturnValue({
      fileData: { artist: 'John%20Doe', duration: 90 },
    });
    expect(getSongMetadata('My%20Song.mp3')).toEqual({
      title: 'My Song.mp3',
      artist: 'John Doe',
      duration: 90,
    });
  });

  it('decodes title from customName and passes plain artist through', () => {
    nDBGetMock.mockReturnValue({
      fileData: { customName: 'Real%20Name', artist: 'Artist', duration: 10 },
    });
    expect(getSongMetadata('some-key.mp3')).toEqual({
      title: 'Real Name',
      artist: 'Artist',
      duration: 10,
    });
  });
});
