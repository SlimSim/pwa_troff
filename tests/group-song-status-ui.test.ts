import { describe, it, expect } from 'vitest';
import {
  GROUP_SONG_STATUS_LABELS,
  GROUP_SONG_STATUS_ORDER,
  getGroupSongStatusCountText,
} from '../utils/group-song-status.js';
import {
  GROUP_SONG_STATUS_CHANGED_EVENT,
  applyGroupSongStatusChange,
  buildGroupSongStatusChangedDetail,
  buildGroupSongStatusChangedEvent,
  getGroupSongStatusSections,
} from '../utils/group-song-status-ui.js';
import type {
  GroupSongStatus,
  TroffFirebaseSongIdentifyer,
} from '../types/troff.d.js';

/**
 * Regression tests for the group song STATUS UI (terminology: "status",
 * never "tag").
 *
 * Future source: utils/group-song-status-ui.ts (pure, DOM-free,
 * happy-dom safe). Nothing here touches Firebase, the network, or the DOM
 * beyond constructing a CustomEvent via a pure helper.
 *
 * Anchor (already implemented, passes today): utils/group-song-status.ts
 * Test target (missing exports — this file is RED until implemented):
 *   utils/group-song-status-ui.ts
 */

type Track = { songKey: string; title: string };

// ---------------------------------------------------------------------------
// Anchor: existing helpers from utils/group-song-status.ts
// ---------------------------------------------------------------------------

describe('anchor: existing group-song-status helpers', () => {
  it('orders statuses prio, active, standard, archived', () => {
    expect([...GROUP_SONG_STATUS_ORDER]).toEqual(['prio', 'active', 'standard', 'archived']);
  });

  it('renders the archived expander text via getGroupSongStatusCountText', () => {
    expect(getGroupSongStatusCountText('archived', 3)).toBe('Show 3 archived songs');
  });

  it('renders "<Label> (N)" for non-collapsed statuses', () => {
    const nonCollapsed: GroupSongStatus[] = ['prio', 'active', 'standard'];
    for (const status of nonCollapsed) {
      expect(getGroupSongStatusCountText(status, 2)).toBe(
        `${GROUP_SONG_STATUS_LABELS[status]} (2)`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 1. Group detail sections (pure helper)
// ---------------------------------------------------------------------------

describe('getGroupSongStatusSections', () => {
  const tracks: Track[] = [
    { songKey: 'a.mp3', title: 'A' },
    { songKey: 'b.mp3', title: 'B' },
    { songKey: 'c.mp3', title: 'C' },
    { songKey: 'd.mp3', title: 'D' },
  ];

  it('returns sections in ORDER prio, active, standard, archived', () => {
    const sections = getGroupSongStatusSections(tracks, {
      'a.mp3': 'archived',
      'b.mp3': 'prio',
      'c.mp3': 'active',
    });
    expect(sections.map((s) => s.status)).toEqual(['prio', 'active', 'standard', 'archived']);
  });

  it('buckets tracks by statusByKey with missing status falling back to standard', () => {
    const sections = getGroupSongStatusSections(tracks, {
      'a.mp3': 'prio',
      'b.mp3': 'active',
      'c.mp3': 'archived',
      // d.mp3 missing -> standard
    });
    const byStatus: Record<string, string[]> = {};
    for (const s of sections) {
      byStatus[s.status] = s.tracks.map((t) => t.songKey);
    }
    expect(byStatus['prio']).toEqual(['a.mp3']);
    expect(byStatus['active']).toEqual(['b.mp3']);
    expect(byStatus['standard']).toEqual(['d.mp3']);
    expect(byStatus['archived']).toEqual(['c.mp3']);
  });

  it('normalizes unknown status values to standard', () => {
    const sectionTracks: Track[] = [
      { songKey: 'x.mp3', title: 'X' },
      { songKey: 'y.mp3', title: 'Y' },
    ];
    const sections = getGroupSongStatusSections(sectionTracks, {
      'x.mp3': 'bogus-value',
      'y.mp3': undefined,
    });
    const standard = sections.find((s) => s.status === 'standard');
    expect(standard?.tracks.map((t) => t.songKey)).toEqual(['x.mp3', 'y.mp3']);
  });

  it('marks only the archived section collapsed', () => {
    const sections = getGroupSongStatusSections(tracks, {});
    for (const s of sections) {
      expect(s.collapsed).toBe(s.status === 'archived');
    }
  });

  it('uses getGroupSongStatusCountText for the archived expander text', () => {
    const sectionTracks: Track[] = [
      { songKey: 'a.mp3', title: 'A' },
      { songKey: 'b.mp3', title: 'B' },
      { songKey: 'c.mp3', title: 'C' },
    ];
    const sections = getGroupSongStatusSections(sectionTracks, {
      'a.mp3': 'archived',
      'b.mp3': 'archived',
      'c.mp3': 'archived',
    });
    const archived = sections.find((s) => s.status === 'archived');
    expect(archived?.tracks).toHaveLength(3);
    expect(archived?.expanderText).toBe(getGroupSongStatusCountText('archived', 3));
    expect(archived?.expanderText).toBe('Show 3 archived songs');
  });

  it('returns all four sections with empty tracks for empty input', () => {
    const sections = getGroupSongStatusSections([], {});
    expect(sections.map((s) => s.status)).toEqual(['prio', 'active', 'standard', 'archived']);
    for (const s of sections) {
      expect(s.tracks).toEqual([]);
    }
  });

  it('preserves input order within each section', () => {
    const ordered: Track[] = [
      { songKey: '1.mp3', title: 'One' },
      { songKey: '2.mp3', title: 'Two' },
      { songKey: '3.mp3', title: 'Three' },
    ];
    const sections = getGroupSongStatusSections(ordered, {
      '1.mp3': 'prio',
      '2.mp3': 'prio',
      '3.mp3': 'prio',
    });
    const prio = sections.find((s) => s.status === 'prio');
    expect(prio?.tracks.map((t) => t.songKey)).toEqual(['1.mp3', '2.mp3', '3.mp3']);
  });

  it('does not mutate the input tracks or statusByKey', () => {
    const input: Track[] = [{ songKey: 'a.mp3', title: 'A' }];
    const statusByKey: Record<string, unknown> = { 'a.mp3': 'prio' };
    const tracksSnapshot = JSON.stringify(input);
    const statusSnapshot = JSON.stringify(statusByKey);
    getGroupSongStatusSections(input, statusByKey);
    expect(JSON.stringify(input)).toBe(tracksSnapshot);
    expect(JSON.stringify(statusByKey)).toBe(statusSnapshot);
  });
});

// ---------------------------------------------------------------------------
// 3. Status changer event (pure helper, no DOM/firebase)
// ---------------------------------------------------------------------------

describe('group-song-status-changed event helpers', () => {
  it('exposes the event name as group-song-status-changed', () => {
    expect(GROUP_SONG_STATUS_CHANGED_EVENT).toBe('group-song-status-changed');
  });

  it('builds detail with {songKey, status, groupKey} shape', () => {
    const detail = buildGroupSongStatusChangedDetail('songs/a.mp3', 'prio', 'group-1');
    expect(detail).toEqual({ songKey: 'songs/a.mp3', status: 'prio', groupKey: 'group-1' });
  });

  it('normalizes an invalid status to standard in the detail', () => {
    const detail = buildGroupSongStatusChangedDetail('songs/a.mp3', 'bogus', 'group-1');
    expect(detail.status).toBe('standard');
  });

  it('builds a CustomEvent with the right name, detail, bubbles and composed', () => {
    const event = buildGroupSongStatusChangedEvent('songs/a.mp3', 'active', 'group-1');
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe('group-song-status-changed');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.detail).toEqual({ songKey: 'songs/a.mp3', status: 'active', groupKey: 'group-1' });
  });

  it('normalizes an invalid status to standard in the event detail', () => {
    const event = buildGroupSongStatusChangedEvent('songs/a.mp3', undefined, 'group-1');
    expect(event.detail.status).toBe('standard');
  });
});

// ---------------------------------------------------------------------------
// 4. Persistence mapping (pure, no mutation)
// ---------------------------------------------------------------------------

describe('applyGroupSongStatusChange', () => {
  function makeEntries(): TroffFirebaseSongIdentifyer[] {
    return [
      { fullPath: 'songs/a.mp3', galleryId: 'pwa-galleryId' },
      {
        fullPath: 'songs/b.mp3',
        galleryId: 'pwa-galleryId',
        status: 'standard',
        firebaseSongDocId: 'doc-b',
      },
    ];
  }

  it('sets the normalized status on the entry matching fullPath===songKey', () => {
    const result = applyGroupSongStatusChange(makeEntries(), 'songs/a.mp3', 'prio');
    expect(result.find((e) => e.fullPath === 'songs/a.mp3')?.status).toBe('prio');
    expect(result.find((e) => e.fullPath === 'songs/b.mp3')?.status).toBe('standard');
  });

  it('normalizes unknown status values to standard', () => {
    const result = applyGroupSongStatusChange(makeEntries(), 'songs/b.mp3', 'bogus');
    expect(result.find((e) => e.fullPath === 'songs/b.mp3')?.status).toBe('standard');
  });

  it('does not mutate the input array or its entries', () => {
    const entries = makeEntries();
    const snapshot = JSON.stringify(entries);
    const result = applyGroupSongStatusChange(entries, 'songs/a.mp3', 'archived');
    expect(JSON.stringify(entries)).toBe(snapshot);
    expect(result).not.toBe(entries);
    expect(result.find((e) => e.fullPath === 'songs/a.mp3')?.status).toBe('archived');
    expect(entries.find((e) => e.fullPath === 'songs/a.mp3')?.status).toBeUndefined();
  });

  it('preserves all other fields on the updated entry', () => {
    const result = applyGroupSongStatusChange(makeEntries(), 'songs/b.mp3', 'archived');
    expect(result.find((e) => e.fullPath === 'songs/b.mp3')).toEqual({
      fullPath: 'songs/b.mp3',
      galleryId: 'pwa-galleryId',
      status: 'archived',
      firebaseSongDocId: 'doc-b',
    });
  });

  it('leaves entries unchanged when songKey matches nothing', () => {
    const entries = makeEntries();
    const result = applyGroupSongStatusChange(entries, 'songs/missing.mp3', 'prio');
    expect(result).toEqual(entries);
    expect(result).not.toBe(entries);
  });
});
