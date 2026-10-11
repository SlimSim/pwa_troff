import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroupList } from './t-group-list.js';
import {
  GROUP_SONG_STATUS_CHANGED_EVENT,
  buildGroupSongStatusChangedEvent,
} from '../../utils/group-song-status-ui.js';
import { normalizeGroupSongStatus } from '../../utils/group-song-status.js';
import type { GroupSongStatus } from '../../types/troff.d.js';

/**
 * FEATURE SPEC (UI redesign): t-group-list status popover wiring.
 *
 * - `_renderGroupTrack` passes `.showStatusButton=${true}` to its t-media
 *   rows (group detail rows); the add-songs rows must NOT get it.
 * - t-group-list listens for `'song-status-changed'` on t-media and forwards
 *   it by dispatching `buildGroupSongStatusChangedEvent(songKey, status,
 *   this._selectedGroupKey)` — same event name/detail as before
 *   (`{ songKey, status, groupKey }`, bubbles + composed) — and stops
 *   propagation of the incoming event.
 * - The old native `<select class="track-status-select">` is gone from
 *   `render()`.
 *
 * These tests import the ACTUAL component and ACTUAL helpers (never
 * re-implementations), so they FAIL (RED) until the feature exists. Existing
 * t-group-list tests are left untouched.
 */

interface StatusChangedDetail {
  songKey: string;
  status: GroupSongStatus;
  groupKey: string;
}

/** Test-only view onto private GroupList state (no `any`). */
interface GroupListPrivateState {
  _selectedGroupKey: string;
  _songManagementOpen: boolean;
  tracks: GroupList['tracks'];
  groups: GroupList['groups'];
}

function groupState(el: GroupList): GroupListPrivateState {
  return el as unknown as GroupListPrivateState;
}

/** Test-only view onto the not-yet-existing `showStatusButton` property. */
interface TMediaWithStatusButton {
  showStatusButton?: boolean;
}

function statusButtonFlag(row: Element): boolean | undefined {
  return (row as unknown as TMediaWithStatusButton).showStatusButton;
}

interface TrackFixture {
  songKey: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
  comment: string;
  duration: string;
  rating: number;
  tempo: string;
  albumArt: string;
  isVideo: boolean;
  playsMonth: number;
  playsTotal: number;
}

function makeTrack(songKey: string, title: string): TrackFixture {
  return {
    songKey,
    title,
    artist: 'Artist',
    album: 'Album',
    genre: 'Tango',
    year: '2024',
    comment: '',
    duration: '3:00',
    rating: 0,
    tempo: '',
    albumArt: '',
    isVideo: false,
    playsMonth: 0,
    playsTotal: 0,
  };
}

describe('t-group-list status popover wiring', () => {
  let element: GroupList;

  beforeEach(() => {
    element = new GroupList();
    document.body.appendChild(element);

    // Same detail-view setup as t-group-list.test.ts: one group whose key
    // (String(id) = '1') matches _selectedGroupKey.
    groupState(element).groups = [
      {
        id: 1,
        name: 'Test Group',
        songs: [],
        tracks: [makeTrack('song-a', 'Alpha Song')],
      },
    ] as unknown as GroupList['groups'];
    groupState(element).tracks = [
      makeTrack('song-x', 'Library Song'),
    ] as unknown as GroupList['tracks'];
    groupState(element)._selectedGroupKey = '1';
    groupState(element)._songManagementOpen = false;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  function detailRows(): Element[] {
    return Array.from(element.shadowRoot?.querySelectorAll('t-media') ?? []);
  }

  function addSongsRows(): Element[] {
    const list = element.shadowRoot?.querySelector('.add-songs-list');
    return Array.from(list?.querySelectorAll('t-media') ?? []);
  }

  describe('showStatusButton flag', () => {
    it('passes showStatusButton=true to the group detail track rows', async () => {
      await element.updateComplete;

      const rows = detailRows();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(statusButtonFlag(row)).toBe(true);
      }
    });

    it('does NOT enable showStatusButton on the add-songs rows', async () => {
      groupState(element)._songManagementOpen = true;
      await element.updateComplete;

      const rows = addSongsRows();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(statusButtonFlag(row)).not.toBe(true);
      }

      // The detail rows in the same render still get the popover.
      const detail = Array.from(
        element.shadowRoot?.querySelectorAll('.manage-tracks t-media') ?? []
      );
      expect(detail.length).toBeGreaterThan(0);
      for (const row of detail) {
        expect(statusButtonFlag(row)).toBe(true);
      }
    });
  });

  describe("forwards t-media 'song-status-changed'", () => {
    function dispatchIncoming(songKey: string, status: string) {
      const row = element.shadowRoot?.querySelector('t-media');
      expect(row).toBeTruthy();
      row?.dispatchEvent(
        new CustomEvent('song-status-changed', {
          detail: { songKey, status },
          bubbles: true,
          composed: true,
        })
      );
    }

    it('re-dispatches the group status-changed event with songKey, status and groupKey', async () => {
      await element.updateComplete;

      const forwardSpy = vi.fn();
      element.addEventListener(GROUP_SONG_STATUS_CHANGED_EVENT, forwardSpy);

      dispatchIncoming('song-a', 'prio');
      await element.updateComplete;

      expect(forwardSpy).toHaveBeenCalledTimes(1);
      const event = forwardSpy.mock.calls[0][0] as CustomEvent<StatusChangedDetail>;
      expect(event).toBeInstanceOf(CustomEvent);
      expect(event.type).toBe(GROUP_SONG_STATUS_CHANGED_EVENT);
      expect(event.type).toBe('group-song-status-changed');
      expect(event.detail).toEqual({
        songKey: 'song-a',
        status: 'prio',
        groupKey: '1',
      });
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);

      // Same shape as the helper the old select used.
      expect(event.detail).toEqual(buildGroupSongStatusChangedEvent('song-a', 'prio', '1').detail);
    });

    it('normalizes the forwarded status via normalizeGroupSongStatus', async () => {
      await element.updateComplete;

      const forwardSpy = vi.fn();
      element.addEventListener(GROUP_SONG_STATUS_CHANGED_EVENT, forwardSpy);

      dispatchIncoming('song-a', 'bogus-status');
      await element.updateComplete;

      expect(forwardSpy).toHaveBeenCalledTimes(1);
      const event = forwardSpy.mock.calls[0][0] as CustomEvent<StatusChangedDetail>;
      expect(event.detail.status).toBe(normalizeGroupSongStatus('bogus-status'));
      expect(event.detail.status).toBe('standard');
    });

    it('stops propagation of the incoming song-status-changed event', async () => {
      await element.updateComplete;

      const documentSpy = vi.fn();
      document.addEventListener('song-status-changed', documentSpy);
      try {
        dispatchIncoming('song-a', 'archived');
        await element.updateComplete;

        expect(documentSpy).not.toHaveBeenCalled();
      } finally {
        document.removeEventListener('song-status-changed', documentSpy);
      }
    });
  });

  describe('old native status select removal', () => {
    it('renders no <select> and no .track-status-select in the group detail', async () => {
      await element.updateComplete;

      expect(element.shadowRoot?.querySelector('select')).toBeNull();
      expect(element.shadowRoot?.querySelector('.track-status-select')).toBeNull();

      const html = element.shadowRoot?.innerHTML ?? '';
      expect(html).not.toContain('<select');
      expect(html).not.toContain('track-status-select');
    });
  });
});
