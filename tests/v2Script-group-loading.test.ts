import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Same firebaseClient mock as tests/v2Script.test.ts: the DOMContentLoaded
// boot flow dynamically imports it and registers onAuthStateChanged.
vi.mock('../services/firebaseClient.js', () => ({
  auth: {},
  onAuthStateChanged: vi.fn(() => () => {}),
}));

// Captured mocks so assertions can inspect what v2Script's group save/delete
// listeners call (pattern: tests/v2Script-share.test.ts line 11).
const mocks = vi.hoisted(() => {
  const loadingController = {
    update: vi.fn(),
    done: vi.fn(),
    fail: vi.fn(),
  };
  return {
    loadingController,
    showLoading: vi.fn(() => loadingController),
    showToast: vi.fn(),
    saveGroupToFirebase: vi.fn(),
    deleteGroupFromFirebase: vi.fn(),
  };
});

interface GroupPayload {
  id?: number | string;
  firebaseGroupDocId?: string;
  name?: string;
}

function appendRequiredDom() {
  const header = document.createElement('div');
  header.id = 'header';
  document.body.appendChild(header);

  const songList = document.createElement('div');
  songList.id = 'songList';
  document.body.appendChild(songList);

  const footer = document.createElement('div');
  footer.id = 'footer';
  document.body.appendChild(footer);

  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'settingsPanel';
  document.body.appendChild(settingsPanel);

  const markerSlider = document.createElement('div');
  markerSlider.id = 'markerSlider';
  (markerSlider as unknown as { getPlaybackStart: () => number }).getPlaybackStart = vi.fn(
    () => 0
  );
  document.body.appendChild(markerSlider);

  const currentSongControls = document.createElement('div');
  currentSongControls.id = 'currentSongControls';
  document.body.appendChild(currentSongControls);
}

async function bootV2Script() {
  await import('../v2Script.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  // Let the boot auth-flow's dynamic imports resolve
  await new Promise((resolve) => setTimeout(resolve, 30));
}

const flush = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

function fireGroupSaved(detail: { group?: GroupPayload }) {
  document.dispatchEvent(new CustomEvent('group-saved', { detail }));
}

function fireGroupDeleted(detail: { groupId?: string; group?: GroupPayload }) {
  document.dispatchEvent(new CustomEvent('group-deleted', { detail }));
}

describe('v2Script group save/delete background sync toasts', () => {
  // Track boot-time document listeners so stale module instances (from
  // vi.resetModules + re-import) cannot react to this test's events.
  // Pattern: tests/v2Script-auth-busy.test.ts lines 104-124.
  let trackedListeners: Array<{
    type: string;
    listener: EventListenerOrEventListenerObject;
  }>;

  // Captured `group-sync-status` dispatches from the group-saved listener —
  // the new "syncing" badge signal that replaces the save toasts.
  let syncStatusEvents: Array<{ syncing?: boolean }> = [];
  let syncStatusListener: ((e: Event) => void) | null = null;

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';

    mocks.showLoading.mockClear();
    mocks.showToast.mockClear();
    mocks.loadingController.update.mockClear();
    mocks.loadingController.done.mockClear();
    mocks.loadingController.fail.mockClear();
    mocks.saveGroupToFirebase.mockReset();
    mocks.saveGroupToFirebase.mockResolvedValue('doc1');
    mocks.deleteGroupFromFirebase.mockReset();
    mocks.deleteGroupFromFirebase.mockResolvedValue(undefined);

    trackedListeners = [];
    const origAdd = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions
      ) => {
        if (
          listener &&
          (type === 'DOMContentLoaded' ||
            type === 'group-saved' ||
            type === 'group-deleted')
        ) {
          trackedListeners.push({ type, listener });
        }
        if (listener) {
          origAdd(type, listener, options);
        }
      }
    );

    // Capture every group-sync-status dispatch so assertions can verify the
    // syncing-badge signal sequence ({syncing:true} → {syncing:false}).
    syncStatusEvents = [];
    syncStatusListener = (e: Event) => {
      syncStatusEvents.push((e as CustomEvent<{ syncing?: boolean }>).detail ?? {});
    };
    document.addEventListener('group-sync-status', syncStatusListener);

    // Make requestAnimationFrame fire synchronously (happy-dom has no rAF).
    const raf = (cb: Function) => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf;

    // Ignore duplicate custom element registrations across re-imports.
    const registry = customElements;
    const originalDefine = registry.define.bind(registry);
    const patched = Object.create(registry);
    patched.define = (
      name: string,
      constructor: CustomElementConstructor,
      options?: ElementDefinitionOptions
    ) => {
      if (!registry.get(name)) {
        originalDefine(name, constructor, options);
      }
    };
    vi.stubGlobal('customElements', patched);

    // Default: online, no hash.
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    window.location.hash = '';

    // Common module mocks — same set as tests/v2Script-share.test.ts, plus
    // showLoading (the feature under test) and firebase-group-sync.
    vi.doMock('../utils/notification.js', () => ({
      showToast: mocks.showToast,
      showLoading: mocks.showLoading,
      showDownloadProgress: vi.fn(),
      hideDownloadProgress: vi.fn(),
    }));
    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: vi.fn((key: string) => {
          if (key === 'aoSongLists') return [];
          return { markers: [{ id: 'm1' }] };
        }),
        set: vi.fn(),
        setOnSong: vi.fn(),
      },
    }));
    vi.doMock('../services/audio.js', () => ({
      audio: {
        currentTime: 0,
        duration: 120,
        playbackRate: 1,
        volume: 1,
        paused: true,
        addEventListener: vi.fn(),
      },
      loadSong: vi.fn(),
    }));
    vi.doMock('../utils/firebase-sync.js', () => ({
      syncFirebaseGroups: vi.fn(async () => {}),
    }));
    vi.doMock('../utils/firebase-realtime.js', () => ({
      setupListeners: vi.fn(() => Promise.resolve()),
      setupGroupSongListeners: vi.fn(() => Promise.resolve()),
      teardownListeners: vi.fn(),
      saveSongData: vi.fn(() => Promise.resolve()),
      setLiveUpdateCallback: vi.fn(() => Promise.resolve()),
      setGroupUpdateCallback: vi.fn(),
    }));
    vi.doMock('../assets/internal/notify-js/notify.config.js', () => ({}));
    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: vi.fn(),
      setCurrentSong: vi.fn(),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
      getCurrentSongKey: vi.fn(() => null),
      updateFooterWithCurrentSong: vi.fn(),
    }));
    vi.doMock('../utils/firebase-group-sync.js', () => ({
      saveGroupToFirebase: mocks.saveGroupToFirebase,
      deleteGroupFromFirebase: mocks.deleteGroupFromFirebase,
    }));
    vi.doMock('../utils/log.js', () => ({
      default: {
        i: vi.fn(),
        w: vi.fn(),
        e: vi.fn(),
      },
    }));
  });

  afterEach(() => {
    for (const { type, listener } of trackedListeners) {
      document.removeEventListener(type, listener);
    }
    if (syncStatusListener) {
      document.removeEventListener('group-sync-status', syncStatusListener);
      syncStatusListener = null;
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('group-saved dispatches group-sync-status true→false and shows no save toast on success', async () => {
    appendRequiredDom();
    await bootV2Script();

    fireGroupSaved({ group: { id: 7, firebaseGroupDocId: 'doc1', name: 'Band' } });
    await flush();

    // Proves the real group-saved listener ran (it still does the work).
    expect(mocks.saveGroupToFirebase).toHaveBeenCalledTimes(1);
    // New contract: the header badge is driven by group-sync-status events
    // ({syncing:true} before the save, {syncing:false} once it settles).
    expect(syncStatusEvents).toEqual([{ syncing: true }, { syncing: false }]);
    // The save path no longer creates any loading/success toast.
    expect(mocks.showLoading).not.toHaveBeenCalled();
    expect(mocks.loadingController.done).not.toHaveBeenCalled();
    expect(mocks.loadingController.fail).not.toHaveBeenCalled();
    expect(mocks.showToast.mock.calls.map((call: unknown[]) => call[0])).not.toContain(
      'Group saved'
    );
  }, 30000);

  it('group-saved dispatches group-sync-status true→false and shows an error toast when saveGroupToFirebase rejects', async () => {
    appendRequiredDom();
    mocks.saveGroupToFirebase.mockRejectedValue(new Error('offline'));

    await bootV2Script();

    fireGroupSaved({ group: { id: 7, firebaseGroupDocId: 'doc1', name: 'Band' } });
    await flush();

    // Proves the real group-saved listener ran.
    expect(mocks.saveGroupToFirebase).toHaveBeenCalledTimes(1);
    // Badge must be turned off again even when the save fails…
    expect(syncStatusEvents).toEqual([{ syncing: true }, { syncing: false }]);
    // …and the failure surfaces as an error toast (not a loading toast).
    const errorToastCall = mocks.showToast.mock.calls.find(
      (call: unknown[]) => call[0] === 'Could not save group'
    );
    expect(errorToastCall, 'expected showToast("Could not save group", …)').toBeTruthy();
    expect(errorToastCall?.[1]).toBe('error');
    expect(mocks.showLoading).not.toHaveBeenCalled();
    expect(mocks.loadingController.fail).not.toHaveBeenCalled();
    expect(mocks.loadingController.done).not.toHaveBeenCalled();
  }, 30000);

  it('group-deleted shows a loading toast and calls done("Group deleted") on success', async () => {
    appendRequiredDom();
    await bootV2Script();

    fireGroupDeleted({
      groupId: 'doc1',
      group: { firebaseGroupDocId: 'doc1', name: 'Band' },
    });
    await flush();

    // Proves the real group-deleted listener ran (current code calls this).
    expect(mocks.deleteGroupFromFirebase).toHaveBeenCalledWith('doc1');
    // RED today: showLoading is never called by the handler.
    expect(mocks.showLoading).toHaveBeenCalledWith('Deleting group online…');
    expect(mocks.loadingController.done).toHaveBeenCalledWith('Group deleted');
    expect(mocks.loadingController.fail).not.toHaveBeenCalled();
  }, 30000);

  it('group-deleted calls fail("Could not delete group") when deleteGroupFromFirebase rejects', async () => {
    appendRequiredDom();
    mocks.deleteGroupFromFirebase.mockRejectedValue(new Error('offline'));

    await bootV2Script();

    fireGroupDeleted({
      groupId: 'doc1',
      group: { firebaseGroupDocId: 'doc1', name: 'Band' },
    });
    await flush();

    // Proves the real group-deleted listener ran.
    expect(mocks.deleteGroupFromFirebase).toHaveBeenCalledWith('doc1');
    // RED today: showLoading / fail are never called by the handler.
    expect(mocks.showLoading).toHaveBeenCalledWith('Deleting group online…');
    expect(mocks.loadingController.fail).toHaveBeenCalledWith('Could not delete group');
    expect(mocks.loadingController.done).not.toHaveBeenCalled();
  }, 30000);

  it('group-saved without a group dispatches no group-sync-status and does no work (orphan guard)', async () => {
    appendRequiredDom();
    await bootV2Script();

    // Missing-group event must early-return before any badge signal or save.
    fireGroupSaved({});
    await flush();
    expect(syncStatusEvents).toEqual([]);
    expect(mocks.saveGroupToFirebase).not.toHaveBeenCalled();

    // A valid event afterwards still runs the full flow.
    fireGroupSaved({ group: { id: 7, firebaseGroupDocId: 'doc1', name: 'Band' } });
    await flush();

    expect(mocks.saveGroupToFirebase).toHaveBeenCalledTimes(1);
    // Only the valid event produced badge signals: true → false, nothing more.
    expect(syncStatusEvents).toEqual([{ syncing: true }, { syncing: false }]);
    expect(mocks.showLoading).not.toHaveBeenCalled();
    expect(mocks.loadingController.done).not.toHaveBeenCalled();
  }, 30000);
});
