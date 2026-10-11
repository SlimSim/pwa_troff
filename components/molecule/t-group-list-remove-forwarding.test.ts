import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroupList } from './t-group-list.js';

/**
 * FEATURE SPEC (dropdown polish): the status dropdown now contains a
 * "Remove from group" button that makes t-media dispatch
 * 'song-remove-requested' ({ songKey }, bubbles + composed). t-group-list
 * must forward it as the existing 'group-song-removed' event
 * ({ groupKey, songKey }, bubbles + composed) — the shape v2Script.ts already
 * listens for — by reusing `_handleRemoveSong`, and stop the incoming event.
 *
 * These tests import the ACTUAL component (never re-implementations), so they
 * FAIL (RED) until the forwarding listener exists on the detail-row t-media.
 */

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

interface GroupRemovedDetail {
  groupKey: string;
  songKey: string;
}

describe('t-group-list remove-from-group forwarding', () => {
  let element: GroupList;

  beforeEach(async () => {
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
    await element.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  function detailRow(): Element {
    const row = element.shadowRoot?.querySelector('t-media');
    expect(row).toBeTruthy();
    return row as Element;
  }

  function dispatchIncoming(songKey: string) {
    detailRow().dispatchEvent(
      new CustomEvent('song-remove-requested', {
        detail: { songKey },
        bubbles: true,
        composed: true,
      })
    );
  }

  it("forwards t-media 'song-remove-requested' as document-level 'group-song-removed' with {groupKey, songKey}", async () => {
    const forwardSpy = vi.fn();
    document.addEventListener('group-song-removed', forwardSpy);
    try {
      dispatchIncoming('song-a');
      await element.updateComplete;

      expect(forwardSpy).toHaveBeenCalledTimes(1);
      const event = forwardSpy.mock.calls[0][0] as CustomEvent<GroupRemovedDetail>;
      expect(event).toBeInstanceOf(CustomEvent);
      expect(event.type).toBe('group-song-removed');
      expect(event.detail).toEqual({ groupKey: '1', songKey: 'song-a' });
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
      expect(event.target).toBe(element);
    } finally {
      document.removeEventListener('group-song-removed', forwardSpy);
    }
  });

  it("stops propagation of the incoming 'song-remove-requested' event", async () => {
    const documentSpy = vi.fn();
    document.addEventListener('song-remove-requested', documentSpy);
    try {
      dispatchIncoming('song-a');
      await element.updateComplete;

      expect(documentSpy).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('song-remove-requested', documentSpy);
    }
  });
});
