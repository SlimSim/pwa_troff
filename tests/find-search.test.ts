// Regression tests for find.html server-song search (see find.ts
// `repopulateFileListDivs` / `includesSearch` / `getSearchableFields`).
// Imports the ACTUAL pure module — never a re-implementation.
import { describe, it, expect } from 'vitest';
import {
  matchesServerSongSearch,
  includesSearch,
  getSearchableFields,
} from '../utils/find-search.js';

// ---- 1. filename match must be OR-ed, even when displayName is 'Unknown' ----
describe('filename match (Boilermaker case)', () => {
  it('"swing" in fileName + displayName Unknown, empty genre/tags → matches', () => {
    const ok = matchesServerSongSearch(
      'swing',
      'Boilermaker Jazz Band - Minor Swing.mp3',
      { displayName: 'Unknown', genre: '', tags: '' }
    );
    expect(ok).toBe(true);
  });

  it('filename match is case-insensitive', () => {
    const ok = matchesServerSongSearch(
      'SWING',
      'Boilermaker Jazz Band - Minor Swing.mp3',
      { displayName: 'Unknown', genre: '', tags: '' }
    );
    expect(ok).toBe(true);
  });
});

// ---- 2. metadata match (Johnny Hodges case) ----
describe('metadata match', () => {
  it('"swing" in genre (not in fileName) → matches', () => {
    const ok = matchesServerSongSearch('swing', 'Johnny Hodges - Hodge Podge.mp3', {
      displayName: 'Hodge Podge',
      genre: 'Swing',
      tags: '',
    });
    expect(ok).toBe(true);
  });

  it('"swing" in tags (not in fileName) → matches', () => {
    const ok = matchesServerSongSearch('swing', 'plain-file-name.mp3', {
      displayName: 'Plain Song',
      genre: '',
      tags: 'swing dance',
    });
    expect(ok).toBe(true);
  });

  it('"swing" in displayName → matches', () => {
    const ok = matchesServerSongSearch('swing', 'plain-file-name.mp3', {
      displayName: 'Swing Out Vol 1',
      genre: '',
      tags: '',
    });
    expect(ok).toBe(true);
  });
});

// ---- 3. full song info (beyond first 99 chars) ----
describe('full song info', () => {
  it('"swing" beyond the first 99 chars of info → matches', () => {
    const fullInfo = 'a'.repeat(120) + 'swing' + 'b'.repeat(50);
    const ok = matchesServerSongSearch('swing', 'plain-file-name.mp3', {
      displayName: 'Plain Song',
      genre: '',
      tags: '',
      info: fullInfo,
      infoBeginning: fullInfo.substring(0, 99),
    });
    expect(ok).toBe(true);
  });
});

// ---- 4. extended metadata fields ----
describe('extended metadata fields', () => {
  const baseFileName = 'plain-file-name.mp3';

  it('"swing" in customName → matches', () => {
    expect(
      matchesServerSongSearch('swing', baseFileName, {
        displayName: 'Plain Song',
        genre: '',
        tags: '',
        customName: 'My Swing Custom',
      })
    ).toBe(true);
  });

  it('"swing" in choreography → matches', () => {
    expect(
      matchesServerSongSearch('swing', baseFileName, {
        displayName: 'Plain Song',
        genre: '',
        tags: '',
        choreography: 'Lindy Swing Routine',
      })
    ).toBe(true);
  });

  it('"swing" in title → matches', () => {
    expect(
      matchesServerSongSearch('swing', baseFileName, {
        displayName: 'Plain Song',
        genre: '',
        tags: '',
        title: 'Swing Era Classic',
      })
    ).toBe(true);
  });

  it('"swing" in artist → matches', () => {
    expect(
      matchesServerSongSearch('swing', baseFileName, {
        displayName: 'Plain Song',
        genre: '',
        tags: '',
        artist: 'Swing Kings',
      })
    ).toBe(true);
  });

  it('"swing" in album → matches', () => {
    expect(
      matchesServerSongSearch('swing', baseFileName, {
        displayName: 'Plain Song',
        genre: '',
        tags: '',
        album: 'Best of Swing',
      })
    ).toBe(true);
  });

  it('"swing" in choreographer → matches', () => {
    expect(
      matchesServerSongSearch('swing', baseFileName, {
        displayName: 'Plain Song',
        genre: '',
        tags: '',
        choreographer: 'Swing Master',
      })
    ).toBe(true);
  });
});

// ---- 5. no match anywhere ----
describe('no match', () => {
  it('query absent from every field → does NOT match', () => {
    const ok = matchesServerSongSearch('swing', 'plain-file-name.mp3', {
      displayName: 'Plain Song',
      genre: 'Waltz',
      tags: 'ballroom',
      customName: 'Custom',
      choreography: 'Routine',
      title: 'Title',
      artist: 'Artist',
      album: 'Album',
      choreographer: 'Choreo',
      info: 'some info text',
      infoBeginning: 'some info',
    });
    expect(ok).toBe(false);
  });
});

// ---- 6. empty query matches all ----
describe('empty query', () => {
  it('empty query matches everything', () => {
    expect(
      matchesServerSongSearch('', 'anything.mp3', {
        displayName: 'Unknown',
        genre: '',
        tags: '',
      })
    ).toBe(true);
  });

  it('whitespace-only query matches everything (trimmed → empty)', () => {
    expect(
      matchesServerSongSearch('   ', 'anything.mp3', {
        displayName: 'Unknown',
        genre: '',
        tags: '',
      })
    ).toBe(true);
  });
});

// ---- 7. displayName 'Unknown' is treated as empty ----
describe("displayName 'Unknown'", () => {
  it('query "unknown" does NOT match a lone displayName of Unknown', () => {
    const ok = matchesServerSongSearch('unknown', 'plain-file-name.mp3', {
      displayName: 'Unknown',
      genre: '',
      tags: '',
    });
    expect(ok).toBe(false);
  });

  it('displayName Unknown does NOT block a filename match', () => {
    const fields = getSearchableFields({ displayName: 'Unknown', genre: '', tags: '' });
    // filename matched (defaultValue=true) but metadata has no hit:
    // buggy includesSearch ignores defaultValue here → false.
    expect(includesSearch('swing', { displayName: 'Unknown', genre: '', tags: '' }, true)).toBe(
      true
    );
    expect(fields).toBeDefined();
  });
});
