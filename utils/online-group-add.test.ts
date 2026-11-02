// Contract tests for utils/online-group-add.ts — the shared "active online
// group add" state used when a song is downloaded from the server while the
// user is in the online-add mode of t-media-parent with a group context.
//
// setActiveOnlineGroupAdd(groupKey) stores the target group (''/null = clear),
// getActiveOnlineGroupAdd() reads it back, and createGroupSongAddedEvent(songKey)
// builds the bubbling/composed 'group-song-added' CustomEvent — or null when no
// group is active or the songKey is empty.
//
// Real functions are imported (never re-implemented). beforeEach/afterEach
// reset the module state so tests are order-independent.
//
// RED pre-implementation: utils/online-group-add.ts does not exist yet.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setActiveOnlineGroupAdd,
  getActiveOnlineGroupAdd,
  createGroupSongAddedEvent,
} from './online-group-add.js';

describe('utils/online-group-add', () => {
  beforeEach(() => {
    setActiveOnlineGroupAdd(null);
  });

  afterEach(() => {
    setActiveOnlineGroupAdd(null);
  });

  it('getActiveOnlineGroupAdd() returns null by default', () => {
    expect(getActiveOnlineGroupAdd()).toBeNull();
  });

  it('setActiveOnlineGroupAdd stores the key; "" and null clear it back to null', () => {
    setActiveOnlineGroupAdd('g1');
    expect(getActiveOnlineGroupAdd()).toBe('g1');

    setActiveOnlineGroupAdd('');
    expect(getActiveOnlineGroupAdd()).toBeNull();

    setActiveOnlineGroupAdd('g2');
    expect(getActiveOnlineGroupAdd()).toBe('g2');

    setActiveOnlineGroupAdd(null);
    expect(getActiveOnlineGroupAdd()).toBeNull();
  });

  it('createGroupSongAddedEvent returns null when no group is stored', () => {
    expect(createGroupSongAddedEvent('songA')).toBeNull();
  });

  it('createGroupSongAddedEvent returns a bubbling composed CustomEvent with the group detail', () => {
    setActiveOnlineGroupAdd('g1');

    const evt = createGroupSongAddedEvent('songA');

    expect(evt).toBeInstanceOf(CustomEvent);
    expect(evt!.type).toBe('group-song-added');
    expect(evt!.bubbles).toBe(true);
    expect(evt!.composed).toBe(true);
    expect(evt!.detail).toEqual({
      groupKey: 'g1',
      songKey: 'songA',
      title: 'songA',
    });
  });

  it('createGroupSongAddedEvent("") returns null even when a group is set', () => {
    setActiveOnlineGroupAdd('g1');
    expect(createGroupSongAddedEvent('')).toBeNull();
  });
});
