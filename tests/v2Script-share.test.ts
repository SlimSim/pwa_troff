import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Same firebaseClient mock as tests/v2Script.test.ts: the DOMContentLoaded
// boot flow dynamically imports it and registers onAuthStateChanged.
vi.mock('../services/firebaseClient.js', () => ({
  auth: {},
  onAuthStateChanged: vi.fn(() => () => {}),
}));

// Captured mocks so assertions can inspect what v2Script's share flow calls.
const showToastMock = vi.hoisted(() => vi.fn());
const uploadSongToServerMock = vi.hoisted(() => vi.fn());

interface ShareSongDialogElement extends HTMLElement {
  open: boolean;
  songName: string;
  shareUrl: string;
  alreadyUploaded: boolean;
  state: 'confirm' | 'uploading' | 'done';
  progress: number;
  updateComplete: Promise<unknown>;
}

interface MarkerSliderElement extends HTMLElement {
  getPlaybackStart: () => number;
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
  (markerSlider as unknown as MarkerSliderElement).getPlaybackStart = vi.fn(() => 0);
  document.body.appendChild(markerSlider);

  return { header, songList, footer, settingsPanel, markerSlider };
}

async function bootV2Script() {
  await import('../v2Script.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  // Let the boot auth-flow's dynamic imports resolve
  await new Promise((resolve) => setTimeout(resolve, 10));
}

function triggerShareSongAction() {
  const settingsPanel = document.getElementById('settingsPanel')!;
  settingsPanel.dispatchEvent(
    new CustomEvent('song-action-requested', {
      detail: { action: 'shareSong' },
      bubbles: true,
      composed: true,
    })
  );
}

function mockCurrentSong(key: string | null) {
  vi.doMock('../utils/current-song.js', () => ({
    updateHeaderWithCurrentSong: vi.fn(),
    setCurrentSong: vi.fn(),
    getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
    getCurrentSongKey: vi.fn(() => key),
    updateFooterWithCurrentSong: vi.fn(),
  }));
}

describe('v2Script share song flow', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    showToastMock.mockClear();
    uploadSongToServerMock.mockClear();

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

    // Common module mocks (current-song and upload-song are per-test).
    vi.doMock('../utils/notification.js', () => ({
      showToast: showToastMock,
      showDownloadProgress: vi.fn(),
      hideDownloadProgress: vi.fn(),
    }));
    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: vi.fn(() => ({ markers: [{ id: 'm1' }] })),
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('shows a toast and does not create a dialog when there is no current song', async () => {
    appendRequiredDom();
    mockCurrentSong(null);

    await bootV2Script();
    triggerShareSongAction();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(showToastMock).toHaveBeenCalledWith(
      'You do not have a song to upload yet. Add a song to Troff and then try again!',
      'error'
    );
    expect(document.body.querySelector('t-share-song-dialog')).toBeNull();
  });

  it('shows an offline toast and does not create a dialog when offline', async () => {
    appendRequiredDom();
    mockCurrentSong('track.mp3');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    await bootV2Script();
    triggerShareSongAction();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(showToastMock).toHaveBeenCalledWith(
      'You appear to be offline, please wait until you have an internet connection and try again then.',
      'error'
    );
    expect(document.body.querySelector('t-share-song-dialog')).toBeNull();
  });

  it('opens the dialog in done state when the song was already uploaded (hash present)', async () => {
    appendRequiredDom();
    mockCurrentSong('track.mp3');
    window.location.hash = '#123&track.mp3';

    await bootV2Script();
    triggerShareSongAction();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const dialog = document.body.querySelector(
      't-share-song-dialog'
    ) as ShareSongDialogElement | null;
    expect(dialog).toBeTruthy();
    expect(dialog!.songName).toBe('track.mp3');
    expect(dialog!.alreadyUploaded).toBe(true);
    expect(dialog!.shareUrl).toBe(window.location.href);
    expect(dialog!.state).toBe('done');
    expect(dialog!.open).toBe(true);
  });

  it('opens in confirm state, uploads on share-confirmed, and shows the shareable URL when done', async () => {
    appendRequiredDom();
    mockCurrentSong('track.mp3');
    vi.doMock('../utils/upload-song.js', () => ({
      crc32Hash: vi.fn(),
      uploadSongToServer: uploadSongToServerMock,
      buildShareUrl: vi.fn(() => 'https://origin/#42&track.mp3'),
    }));
    uploadSongToServerMock.mockResolvedValue({
      id: 42,
      fileUrl: 'https://x/file',
      fileName: 'track.mp3',
    });

    await bootV2Script();
    triggerShareSongAction();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const dialog = document.body.querySelector(
      't-share-song-dialog'
    ) as ShareSongDialogElement | null;
    expect(dialog).toBeTruthy();
    expect(dialog!.songName).toBe('track.mp3');
    expect(dialog!.alreadyUploaded).toBe(false);
    expect(dialog!.state).toBe('confirm');
    expect(dialog!.open).toBe(true);

    // User confirms: the dialog fires share-confirmed and the upload starts
    dialog!.dispatchEvent(new CustomEvent('share-confirmed', { bubbles: true, composed: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(uploadSongToServerMock).toHaveBeenCalledWith('track.mp3', expect.any(Function));
    expect(window.location.hash.startsWith('#42&')).toBe(true);
    expect(dialog!.shareUrl).toBe('https://origin/#42&track.mp3');
    expect(dialog!.state).toBe('done');
    expect(dialog!.open).toBe(true);
  });

  it('passes an onProgress callback that updates the dialog progress during upload', async () => {
    appendRequiredDom();
    mockCurrentSong('track.mp3');
    let capturedOnProgress: ((percent: number) => void) | undefined;
    vi.doMock('../utils/upload-song.js', () => ({
      crc32Hash: vi.fn(),
      uploadSongToServer: vi.fn(
        async (_songKey: string, onProgress?: (percent: number) => void) => {
          capturedOnProgress = onProgress;
          return { id: 42, fileUrl: 'https://x/file', fileName: 'track.mp3' };
        }
      ),
      buildShareUrl: vi.fn(() => 'https://origin/#42&track.mp3'),
    }));

    await bootV2Script();
    triggerShareSongAction();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const dialog = document.body.querySelector(
      't-share-song-dialog'
    ) as ShareSongDialogElement | null;
    expect(dialog).toBeTruthy();

    // User confirms: the upload should receive a progress callback as the
    // 2nd argument (currently v2Script calls uploadSongToServer(songKey) with
    // only one argument, so this assertion is RED today).
    dialog!.dispatchEvent(new CustomEvent('share-confirmed', { bubbles: true, composed: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(capturedOnProgress).toBeTypeOf('function');

    // A progress report from the upload task must update the dialog's progress
    capturedOnProgress!(55);
    await dialog!.updateComplete;
    expect(dialog!.progress).toBe(55);
  });
});