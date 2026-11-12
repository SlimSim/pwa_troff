// Regression tests: the "Add song from device" item in the DETAIL-view "more"
// menu must dispatch the event t-media-parent already listens for:
//
//   - t-group-list  -> 'group-add-song-requested' (detail: { groupKey })
//   - t-artist-list -> 'add-song-requested'
//   - t-genre-list  -> 'add-song-requested'
//
// instead of the dead 'add-click' event — no code anywhere in the repo
// listens for 'add-click', so the click did nothing (no file picker opened).
// (Compare the sibling menu item "Download songs online", which dispatches
// 'add-online-requested' and IS handled by t-media-parent.)
//
// Regression tests for the fix: the buttons must dispatch the events listed
// above — never the dead 'add-click', which nobody listens for. The assertions
// are on the observable event contract only — no private implementation details.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroupList } from './t-group-list.js';
import { ArtistList } from './t-artist-list.js';
import { GenreList } from './t-genre-list.js';

/** Find the "Add song from device" t-butt inside a detail header's more menu. */
function addFromDeviceButton(root: ShadowRoot): HTMLElement {
  const buttons = Array.from(
    root.querySelectorAll('t-header-actions div[slot="more"] t-butt')
  ) as HTMLElement[];
  const btn = buttons.find((b) => (b.textContent || '').includes('Add song from device'));
  if (!btn) {
    throw new Error('Expected an "Add song from device" t-butt in the detail more menu');
  }
  return btn;
}

describe('t-group-list detail "Add song from device"', () => {
  let element: GroupList;

  beforeEach(() => {
    element = new GroupList();
    document.body.appendChild(element);

    // Same detail-view setup as t-group-list-manage-mode.test.ts:
    // one group whose key is String(id) = '42'.
    element.groups = [
      {
        id: 42,
        name: 'Jazz',
        icon: 'users',
        info: 'info text',
        owners: ['a@x.se'],
        songs: [],
        tracks: [],
      },
    ];
    element.tracks = [];
    element.openGroup('42');
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('dispatches group-add-song-requested with the open group key instead of add-click', async () => {
    await element.updateComplete;

    const groupAddSpy = vi.fn();
    const addClickSpy = vi.fn();
    element.addEventListener('group-add-song-requested', groupAddSpy);
    element.addEventListener('add-click', addClickSpy);

    const btn = addFromDeviceButton(element.shadowRoot!);
    btn.click();
    await element.updateComplete;

    // The event t-media-parent already listens for (opens the file picker and
    // records the group so chosen songs are added to THAT group):
    expect(groupAddSpy).toHaveBeenCalledTimes(1);
    const event = groupAddSpy.mock.calls[0][0] as CustomEvent<{ groupKey: string }>;
    expect(event.detail).toEqual({ groupKey: '42' });
    // Must cross the shadow boundary up to t-media-parent:
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);

    // ...and the dead event must be gone (nobody listens for it):
    expect(addClickSpy).not.toHaveBeenCalled();
  });
});

describe('t-artist-list detail "Add song from device"', () => {
  let element: ArtistList;

  beforeEach(() => {
    element = new ArtistList();
    document.body.appendChild(element);

    // Same detail-view setup as t-artist-list.test.ts.
    element.artists = [{ name: 'Alpha', tracks: [{ title: 'Tango', songKey: 'a' }] }];
    element.tracks = [];
    element.openArtist('Alpha');
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('dispatches add-song-requested instead of add-click', async () => {
    await element.updateComplete;

    const addSongSpy = vi.fn();
    const addClickSpy = vi.fn();
    element.addEventListener('add-song-requested', addSongSpy);
    element.addEventListener('add-click', addClickSpy);

    const btn = addFromDeviceButton(element.shadowRoot!);
    btn.click();
    await element.updateComplete;

    // The event t-media-parent already listens for (opens the file picker):
    expect(addSongSpy).toHaveBeenCalledTimes(1);
    const event = addSongSpy.mock.calls[0][0] as CustomEvent;
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);

    // ...and the dead event must be gone (nobody listens for it):
    expect(addClickSpy).not.toHaveBeenCalled();
  });
});

describe('t-genre-list detail "Add song from device"', () => {
  let element: GenreList;

  beforeEach(() => {
    element = new GenreList();
    document.body.appendChild(element);

    // Same detail-view setup as t-genre-list.test.ts.
    element.genres = [{ name: 'Jazz', tracks: [{ title: 'Tango', songKey: 'a' }] }];
    element.tracks = [];
    element.openGenre('Jazz');
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('dispatches add-song-requested instead of add-click', async () => {
    await element.updateComplete;

    const addSongSpy = vi.fn();
    const addClickSpy = vi.fn();
    element.addEventListener('add-song-requested', addSongSpy);
    element.addEventListener('add-click', addClickSpy);

    const btn = addFromDeviceButton(element.shadowRoot!);
    btn.click();
    await element.updateComplete;

    // The event t-media-parent already listens for (opens the file picker):
    expect(addSongSpy).toHaveBeenCalledTimes(1);
    const event = addSongSpy.mock.calls[0][0] as CustomEvent;
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);

    // ...and the dead event must be gone (nobody listens for it):
    expect(addClickSpy).not.toHaveBeenCalled();
  });
});
