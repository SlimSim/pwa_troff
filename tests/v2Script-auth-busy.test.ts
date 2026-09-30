import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted spies so the firebaseClient mock factory (and the assertions) can
// reach the sign-in entry points v2Script's handleSignInRequest calls.
const authMocks = vi.hoisted(() => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

// Hoisted toast spy so assertions can reach v2Script's cancellation signal
// (pattern: tests/v2Script-share.test.ts line 11).
const showToastMock = vi.hoisted(() => vi.fn());

// Same firebaseClient mock pattern as tests/v2Script.test.ts /
// tests/v2Script-share.test.ts: the DOMContentLoaded boot flow dynamically
// imports it for onAuthStateChanged, and handleSignInRequest dynamically
// imports it for signInWithPopup/signOut (GoogleAuthProvider is constructed
// for the sign-in path).
vi.mock('../services/firebaseClient.js', () => ({
  auth: {},
  onAuthStateChanged: vi.fn(() => () => {}),
  GoogleAuthProvider: class GoogleAuthProvider {},
  signInWithPopup: authMocks.signInWithPopup,
  signOut: authMocks.signOut,
}));

/** The contract: hosts expose a public `authBusy` boolean. */
type AuthBusyHost = HTMLElement & { authBusy: boolean };

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
}

async function bootV2Script() {
  await import('../v2Script.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  // Let the boot auth-flow's dynamic imports resolve
  await new Promise((resolve) => setTimeout(resolve, 10));
}

const flush = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

function requestSignIn(target: HTMLElement) {
  target.dispatchEvent(
    new CustomEvent('sign-in-requested', {
      detail: { action: 'sign-in' },
      bubbles: true,
      composed: true,
    })
  );
}

/** Make signInWithPopup return a promise the test controls (stays pending). */
function deferSignIn() {
  let resolve!: () => void;
  const pending = new Promise<void>((r) => {
    resolve = r;
  });
  authMocks.signInWithPopup.mockImplementation(() => pending);
  return { resolve };
}

/**
 * Make signInWithPopup return a promise the test controls: it stays pending
 * until reject() is called, then rejects with `error` — e.g. Firebase's
 * `auth/popup-closed-by-user` when the user closes the Google popup.
 */
function rejectSignIn(error: unknown) {
  let reject!: (reason?: unknown) => void;
  const pending = new Promise<void>((_resolve, rej) => {
    reject = rej;
  });
  authMocks.signInWithPopup.mockImplementation(() => pending);
  return { reject: () => reject(error) };
}

describe('v2Script handleSignInRequest authBusy guard', () => {
  // Track this test's DOMContentLoaded listeners so stale module instances
  // (from vi.resetModules + re-import) cannot re-run their boot and attach a
  // second sign-in handler to the current settings panel. Without this, each
  // previous test's v2Script instance would also react to the event and the
  // signInWithPopup call count would depend on how many tests ran before.
  let dclListeners: EventListenerOrEventListenerObject[];

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    authMocks.signInWithPopup.mockReset();
    authMocks.signOut.mockReset();
    showToastMock.mockClear();

    dclListeners = [];
    const origAdd = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
        if (type === 'DOMContentLoaded' && listener) {
          dclListeners.push(listener);
        }
        if (listener) {
          origAdd(type, listener, options);
        }
      }
    );

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

    // Common module mocks — same set as tests/v2Script-share.test.ts.
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
    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: vi.fn(),
      setCurrentSong: vi.fn(),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
      getCurrentSongKey: vi.fn(() => null),
      updateFooterWithCurrentSong: vi.fn(),
    }));
  });

  afterEach(() => {
    for (const listener of dclListeners) {
      document.removeEventListener('DOMContentLoaded', listener);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('sets authBusy=true on the settings panel and song list while sign-in is pending, then clears it in finally', async () => {
    appendRequiredDom();
    const { resolve } = deferSignIn();

    await bootV2Script();

    const settingsPanel = document.getElementById('settingsPanel') as AuthBusyHost;
    const songList = document.getElementById('songList') as AuthBusyHost;

    requestSignIn(settingsPanel);
    await flush();

    expect(settingsPanel.authBusy).toBe(true);
    expect(songList.authBusy).toBe(true);
    expect(authMocks.signInWithPopup).toHaveBeenCalledTimes(1);

    resolve();
    await flush();

    expect(settingsPanel.authBusy).toBe(false);
    expect(songList.authBusy).toBe(false);
  }, 30000);

  it('ignores a second sign-in-requested while the first signInWithPopup is still pending', async () => {
    appendRequiredDom();
    deferSignIn();

    await bootV2Script();

    const settingsPanel = document.getElementById('settingsPanel') as AuthBusyHost;

    requestSignIn(settingsPanel);
    await flush();
    requestSignIn(settingsPanel);
    await flush();

    expect(authMocks.signInWithPopup).toHaveBeenCalledTimes(1);
  }, 30000);

  it('clears authBusy when signInWithPopup rejects with auth/popup-closed-by-user', async () => {
    appendRequiredDom();
    const { reject } = rejectSignIn(
      Object.assign(new Error('Popup closed by user'), {
        code: 'auth/popup-closed-by-user',
      })
    );

    await bootV2Script();

    const settingsPanel = document.getElementById('settingsPanel') as AuthBusyHost;
    const songList = document.getElementById('songList') as AuthBusyHost;

    requestSignIn(settingsPanel);
    await flush();

    // While the popup promise is still pending the busy UI stays up.
    expect(settingsPanel.authBusy).toBe(true);
    expect(songList.authBusy).toBe(true);
    expect(authMocks.signInWithPopup).toHaveBeenCalledTimes(1);

    // User closes the popup → signInWithPopup rejects → handler settles.
    reject();
    await flush();

    // Explicit abort detection: closing the Google popup must surface a
    // user-visible cancelled signal (toast), not clear busy silently.
    expect(showToastMock).toHaveBeenCalled();
    const cancelToast = showToastMock.mock.calls.find(
      ([message]) => typeof message === 'string' && /cancel|abort/i.test(message)
    );
    expect(cancelToast).toBeTruthy();

    // Busy is still cleared on both hosts (Sign in button returns).
    expect(settingsPanel.authBusy).toBe(false);
    expect(songList.authBusy).toBe(false);
    expect(authMocks.signInWithPopup).toHaveBeenCalledTimes(1);
  }, 30000);

  it('clears authBusy when signInWithPopup rejects with a generic error', async () => {
    appendRequiredDom();
    // Immediate rejection (not deferred): the whole handler must still settle
    // with busy cleared on both hosts.
    authMocks.signInWithPopup.mockImplementation(() =>
      Promise.reject(new Error('network-error'))
    );

    await bootV2Script();

    const settingsPanel = document.getElementById('settingsPanel') as AuthBusyHost;
    const songList = document.getElementById('songList') as AuthBusyHost;

    requestSignIn(settingsPanel);
    // busy is set synchronously before the first await in the handler.
    expect(settingsPanel.authBusy).toBe(true);
    expect(songList.authBusy).toBe(true);

    await flush(50);

    expect(settingsPanel.authBusy).toBe(false);
    expect(songList.authBusy).toBe(false);
    expect(authMocks.signInWithPopup).toHaveBeenCalledTimes(1);
  }, 30000);
});
