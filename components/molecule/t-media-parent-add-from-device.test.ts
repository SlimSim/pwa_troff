// Regression tests: adding song(s) from the device.
//
// Feature spec: "When the user adds a song from the device, that song should
// be selected, and if a group is selected, the user should get a question to
// add the song to that group. (If more than one song is added, only one
// should become selected, but the user should be asked if all the songs
// should be added to the group)"
//
// These tests exercise the ACTUAL add-from-device flow
// (MediaParent._handleFilesSelected, reached via the hidden #fileInput) and
// assert the desired behaviour. They are expected to FAIL (RED) until the
// feature is implemented — see the failure output when running vitest.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from './t-media-parent.js';

// ---------------------------------------------------------------------------
// Mock nDB (in-memory) before importing the component under test.
// t-media-parent.ts statically imports nDB from db.js; vi.mock is hoisted so
// the mock applies to the component and its import graph. Cache Storage and
// song-entry creation are stubbed per-test (see beforeEach), and this
// component does not touch Firebase — so no real services are ever called.
// ---------------------------------------------------------------------------

const nDBStore = new Map<string, unknown>();

vi.mock('../../assets/internal/db.js', () => ({
  nDB: {
    get: vi.fn((key: string) => nDBStore.get(key) ?? null),
    set: vi.fn((key: string, value: unknown) => {
      nDBStore.set(key, value);
    }),
    setOnSong: vi.fn(),
    delete: vi.fn((key: string) => {
      nDBStore.delete(key);
    }),
  },
}));

/** Private surface of MediaParent exercised by these regression tests. */
interface AddFromDeviceHooks {
  _handleFilesSelected(event: Event): Promise<void>;
  _currentGroupKey: string;
  _contextType: string;
  _contextKey: string;
}

/** Stub signatures for the private methods neutralized in these tests. */
interface MediaParentPrivateStubs {
  _loadSongs(): Promise<void>;
  _saveFileToCache(file: File, songKey: string): Promise<void>;
  _createSongEntry(file: File, songKey: string): Promise<void>;
  _scrollActiveSongIntoView(): void;
}

interface GroupState {
  groups: Array<{ id: string; name: string }>;
}

interface MediaSelectedDetail {
  songKey: string;
}

function hooksOf(element: MediaParent): AddFromDeviceHooks {
  return element as unknown as AddFromDeviceHooks;
}

function stubsOf(
  target: typeof MediaParent.prototype
): MediaParentPrivateStubs {
  return target as unknown as MediaParentPrivateStubs;
}

describe('t-media-parent: add song(s) from device', () => {
  let element: MediaParent;
  let confirmMock: ReturnType<typeof vi.fn<(message?: string) => boolean>>;

  beforeEach(async () => {
    nDBStore.clear();

    // Never touch Cache Storage / nDB entries / scroll timers: the tests
    // focus on selection + group-question behaviour, while the real
    // _handleFilesSelected flow (file filtering, addedKeys, reload) still runs.
    vi.spyOn(stubsOf(MediaParent.prototype), '_loadSongs').mockResolvedValue(
      undefined
    );
    vi.spyOn(stubsOf(MediaParent.prototype), '_saveFileToCache').mockResolvedValue(
      undefined
    );
    vi.spyOn(stubsOf(MediaParent.prototype), '_createSongEntry').mockResolvedValue(
      undefined
    );
    vi.spyOn(
      stubsOf(MediaParent.prototype),
      '_scrollActiveSongIntoView'
    ).mockImplementation(() => {});

    // Observe the "question" to the user however it is asked: either via
    // window.confirm or via a group prompt event.
    confirmMock = vi.fn<(message?: string) => boolean>(() => true);
    window.confirm = confirmMock;

    element = new MediaParent();
    document.body.appendChild(element);
    await element.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  /**
   * Simulate picking files in the hidden file input and running the ACTUAL
   * change handler. The real #fileInput element is used (files are defined
   * on it) and the real _handleFilesSelected method processes them.
   */
  async function pickFilesFromDevice(files: File[]): Promise<void> {
    await element.updateComplete;
    const input = element.shadowRoot?.getElementById('fileInput') as HTMLInputElement | null;
    if (!input) {
      throw new Error('Expected hidden #fileInput in t-media-parent shadow root');
    }
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    await hooksOf(element)._handleFilesSelected({ target: input } as unknown as Event);
    await element.updateComplete;
  }

  function listenForSelections(): MediaSelectedDetail[] {
    const selected: MediaSelectedDetail[] = [];
    element.addEventListener('media-selected', (event: Event) => {
      selected.push((event as CustomEvent<MediaSelectedDetail>).detail);
    });
    return selected;
  }

  function listenForGroupPrompts(): CustomEvent[] {
    const prompts: CustomEvent[] = [];
    for (const name of [
      'group-add-songs-prompt',
      'group-add-songs-question',
      'group-song-added',
    ]) {
      element.addEventListener(name, (event: Event) => {
        prompts.push(event as CustomEvent);
      });
    }
    return prompts;
  }

  /** Mark a group as selected/open WITHOUT using the group-add entry point. */
  function selectGroup(groupKey: string): void {
    (element as unknown as GroupState).groups = [{ id: groupKey, name: 'Test Group' }];
    const hooks = hooksOf(element);
    hooks._currentGroupKey = groupKey;
    hooks._contextType = 'group';
    hooks._contextKey = groupKey;
  }

  function userWasAsked(prompts: CustomEvent[]): boolean {
    return confirmMock.mock.calls.length > 0 || prompts.length > 0;
  }

  it('selects the song added from the device', async () => {
    const file = new File(['audio-bytes'], 'new-song.mp3', { type: 'audio/mpeg' });
    const selected = listenForSelections();

    await pickFilesFromDevice([file]);

    // Desired: the newly added song becomes the current/selected song, i.e.
    // a media-selected event for it is dispatched (v2Script loads the song
    // from that event) and currentSongKey reflects it.
    expect(selected.map((s) => s.songKey)).toEqual(['new-song.mp3']);
    expect(element.currentSongKey).toBe('new-song.mp3');
  });

  it('asks to add the new song to the selected group', async () => {
    // A group is selected (open), but the add was triggered from the generic
    // "+" button — _pendingGroupKey is NOT set, so the current auto-add path
    // (group-song-added via _pendingGroupKey) does not apply. The user must
    // instead get a question whether to add the song to the selected group.
    selectGroup('group-1');
    const prompts = listenForGroupPrompts();
    const selected = listenForSelections();
    const file = new File(['audio-bytes'], 'new-song.mp3', { type: 'audio/mpeg' });

    await pickFilesFromDevice([file]);

    expect(selected.map((s) => s.songKey)).toEqual(['new-song.mp3']);
    expect(userWasAsked(prompts)).toBe(true);
  });

  it('selects only one song but asks about ALL songs when several are added with a group selected', async () => {
    selectGroup('group-1');
    const prompts = listenForGroupPrompts();
    const selected = listenForSelections();
    const files = [
      new File(['audio-bytes-1'], 'first.mp3', { type: 'audio/mpeg' }),
      new File(['audio-bytes-2'], 'second.mp3', { type: 'audio/mpeg' }),
    ];

    await pickFilesFromDevice(files);

    // Only one song becomes selected ...
    expect(selected.length).toBe(1);
    expect(selected.map((s) => s.songKey)).toEqual(['first.mp3']);
    expect(element.currentSongKey).toBe('first.mp3');

    // ... but the question to add to the group must cover ALL added songs.
    expect(userWasAsked(prompts)).toBe(true);
    const promptCoversAll = prompts.some((event) => {
      const haystack = JSON.stringify(event.detail ?? {});
      return haystack.includes('first.mp3') && haystack.includes('second.mp3');
    });
    const confirmCoversAll = confirmMock.mock.calls.some((args) => {
      const message = String(args[0] ?? '');
      return (
        (message.includes('first.mp3') && message.includes('second.mp3')) ||
        message.includes('2 songs') ||
        message.includes('2 song')
      );
    });
    expect(promptCoversAll || confirmCoversAll).toBe(true);
  });
});
