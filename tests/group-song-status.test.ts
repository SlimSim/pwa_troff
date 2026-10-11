import { describe, it, expect } from 'vitest';
import {
  GROUP_SONG_STATUS_LABELS,
  GROUP_SONG_STATUS_ORDER,
  getGroupSongStatusCountText,
  groupSongsByStatus,
  isGroupSongStatusCollapsed,
  normalizeGroupSongStatus,
} from '../utils/group-song-status.js';
import { mergeSyncedSongData } from '../utils/merge-synced-song-data.js';
import type {
  GroupSongStatus,
  TroffFirebaseSongIdentifyer,
} from '../types/troff.d.js';

/**
 * Regression tests for group song status tags (per-group, shared to members).
 *
 * Spec:
 * - GroupSongStatus = 'prio' | 'active' | 'standard' | 'archived' in types/troff.d.ts,
 *   optional `status?: GroupSongStatus` on TroffFirebaseSongIdentifyer
 *   (absent = 'standard' for backwards compat).
 * - utils/group-song-status.ts pure helpers (see imports above).
 * - utils/merge-synced-song-data.ts must whitelist `status` (like `info`).
 * - utils/firebase-group-sync.ts share payload must include `status`
 *   (network — deliberately NOT covered here, pure logic only).
 */

type Track = { songKey: string; title: string };

// ---------------------------------------------------------------------------
// Type-level backwards-compat guard (fails to compile when the type/field
// does not exist yet). Runtime assertions below cover the pure helpers.
// ---------------------------------------------------------------------------

describe('GroupSongStatus type + TroffFirebaseSongIdentifyer.status', () => {
  it('accepts all four statuses on the optional identifyer field', () => {
    const statuses: GroupSongStatus[] = ['prio', 'active', 'standard', 'archived'];
    for (const status of statuses) {
      const entry: TroffFirebaseSongIdentifyer = {
        fullPath: 'track.mp3',
        galleryId: 'pwa-galleryId',
        status,
      };
      expect(entry.status).toBe(status);
    }
  });

  it('allows the status field to be absent (backwards compat = standard)', () => {
    const entry: TroffFirebaseSongIdentifyer = {
      fullPath: 'track.mp3',
      galleryId: 'pwa-galleryId',
    };
    expect(entry.status).toBeUndefined();
    expect(normalizeGroupSongStatus(entry.status)).toBe('standard');
  });
});

// ---------------------------------------------------------------------------
// GROUP_SONG_STATUS_ORDER
// ---------------------------------------------------------------------------

describe('GROUP_SONG_STATUS_ORDER', () => {
  it('is prio, active, standard, archived in that exact order', () => {
    expect([...GROUP_SONG_STATUS_ORDER]).toEqual(['prio', 'active', 'standard', 'archived']);
  });

  it('contains exactly 4 entries', () => {
    expect(GROUP_SONG_STATUS_ORDER).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// GROUP_SONG_STATUS_LABELS
// ---------------------------------------------------------------------------

describe('GROUP_SONG_STATUS_LABELS', () => {
  it('has a non-empty label for every status', () => {
    const statuses: GroupSongStatus[] = ['prio', 'active', 'standard', 'archived'];
    for (const status of statuses) {
      const label: string = GROUP_SONG_STATUS_LABELS[status];
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// normalizeGroupSongStatus
// ---------------------------------------------------------------------------

describe('normalizeGroupSongStatus', () => {
  it('passes through each valid status unchanged', () => {
    expect(normalizeGroupSongStatus('prio')).toBe('prio');
    expect(normalizeGroupSongStatus('active')).toBe('active');
    expect(normalizeGroupSongStatus('standard')).toBe('standard');
    expect(normalizeGroupSongStatus('archived')).toBe('archived');
  });

  it('maps undefined / missing to standard (backwards compat)', () => {
    expect(normalizeGroupSongStatus(undefined)).toBe('standard');
  });

  it('maps null, unknown strings, wrong case and non-strings to standard', () => {
    const invalidInputs: unknown[] = [
      null,
      '',
      'PRIO',
      'Active',
      'foo',
      'archived ',
      123,
      0,
      true,
      {},
      [],
      ['prio'],
    ];
    for (const input of invalidInputs) {
      expect(normalizeGroupSongStatus(input), `input ${String(input)}`).toBe('standard');
    }
  });
});

// ---------------------------------------------------------------------------
// isGroupSongStatusCollapsed
// ---------------------------------------------------------------------------

describe('isGroupSongStatusCollapsed', () => {
  it('is true only for archived', () => {
    expect(isGroupSongStatusCollapsed('archived')).toBe(true);
    expect(isGroupSongStatusCollapsed('prio')).toBe(false);
    expect(isGroupSongStatusCollapsed('active')).toBe(false);
    expect(isGroupSongStatusCollapsed('standard')).toBe(false);
  });

  it('is false for a normalized invalid status', () => {
    expect(isGroupSongStatusCollapsed(normalizeGroupSongStatus('bogus'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// groupSongsByStatus
// ---------------------------------------------------------------------------

describe('groupSongsByStatus', () => {
  it('returns all 4 keys even when the input is empty', () => {
    const result = groupSongsByStatus([], {});
    expect(Object.keys(result).sort()).toEqual(['active', 'archived', 'prio', 'standard']);
    expect(result.prio).toEqual([]);
    expect(result.active).toEqual([]);
    expect(result.standard).toEqual([]);
    expect(result.archived).toEqual([]);
  });

  it('buckets tracks by normalized status and preserves input order within each bucket', () => {
    const tracks: Track[] = [
      { songKey: 'a.mp3', title: 'A' },
      { songKey: 'b.mp3', title: 'B' },
      { songKey: 'c.mp3', title: 'C' },
      { songKey: 'd.mp3', title: 'D' },
      { songKey: 'e.mp3', title: 'E' },
    ];
    const statusByKey: Record<string, unknown> = {
      'a.mp3': 'archived',
      'b.mp3': 'prio',
      'c.mp3': 'prio',
      // d.mp3 missing entirely -> standard
      'e.mp3': 'bogus-value',
    };

    const result = groupSongsByStatus(tracks, statusByKey);

    expect(result.prio.map((t) => t.songKey)).toEqual(['b.mp3', 'c.mp3']);
    expect(result.archived.map((t) => t.songKey)).toEqual(['a.mp3']);
    // missing + invalid both normalize to standard, in original order d then e
    expect(result.standard.map((t) => t.songKey)).toEqual(['d.mp3', 'e.mp3']);
    expect(result.active).toEqual([]);
  });

  it('treats undefined / null status values as standard', () => {
    const tracks: Track[] = [
      { songKey: 'a.mp3', title: 'A' },
      { songKey: 'b.mp3', title: 'B' },
    ];
    const result = groupSongsByStatus(tracks, { 'a.mp3': undefined, 'b.mp3': null });
    expect(result.standard.map((t) => t.songKey)).toEqual(['a.mp3', 'b.mp3']);
  });
});

// ---------------------------------------------------------------------------
// getGroupSongStatusCountText
// ---------------------------------------------------------------------------

describe('getGroupSongStatusCountText', () => {
  it('renders the collapsed archived expander text', () => {
    expect(getGroupSongStatusCountText('archived', 3)).toBe('Show 3 archived songs');
  });

  it('renders the collapsed text for other counts deterministically', () => {
    expect(getGroupSongStatusCountText('archived', 1)).toBe('Show 1 archived songs');
    expect(getGroupSongStatusCountText('archived', 0)).toBe('Show 0 archived songs');
  });

  it('renders "<Label> (N)" for non-collapsed statuses', () => {
    const nonCollapsed: GroupSongStatus[] = ['prio', 'active', 'standard'];
    for (const status of nonCollapsed) {
      expect(getGroupSongStatusCountText(status, 2)).toBe(`${GROUP_SONG_STATUS_LABELS[status]} (2)`);
    }
  });
});

// ---------------------------------------------------------------------------
// mergeSyncedSongData — status whitelist (like info)
// ---------------------------------------------------------------------------

describe('mergeSyncedSongData — group song status whitelist', () => {
  it('takes `status` from remote when the remote data has it', () => {
    const result = mergeSyncedSongData(
      { status: 'standard', markers: [{ id: 'm1' }] },
      { status: 'prio' }
    );
    expect(result.status).toBe('prio');
  });

  it('keeps the local `status` when the remote data has no `status`', () => {
    const result = mergeSyncedSongData(
      { status: 'active', markers: [{ id: 'm1' }] },
      { markers: [{ id: 'm2' }] }
    );
    expect(result.status).toBe('active');
    expect(result.markers).toEqual([{ id: 'm2' }]);
  });

  it('brings `status` over when local has none (fresh share)', () => {
    const result = mergeSyncedSongData({ markers: [] }, { status: 'archived' });
    expect(result.status).toBe('archived');
  });
});
