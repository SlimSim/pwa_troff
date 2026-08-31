import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock nDB before any imports of modules that may depend on it
const nDBGetMock = vi.fn();
vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: nDBGetMock,
    set: vi.fn(),
    setOnSong: vi.fn(),
  },
}));

// Type for the module under test (loaded dynamically after mocks/reset)
type PhoneUtilsModule = {
  getKeepScreenOn: () => boolean;
  requestWakeLock: () => Promise<unknown>;
  releaseWakeLock: () => Promise<void>;
  updateWakeLockForPlayback: (isPlaying: boolean, isStartingPlayback: boolean) => Promise<void>;
};

describe('phoneUtils wake lock functions', () => {
  let mod: PhoneUtilsModule;
  let wakeLockRequestMock: ReturnType<typeof vi.fn>;
  let sentinelReleaseMock: ReturnType<typeof vi.fn>;
  let mockSentinel: { release: ReturnType<typeof vi.fn> };
  let addedVisibilityListeners: Array<(e?: Event) => void> = [];

  beforeEach(async () => {
    vi.resetModules();
    nDBGetMock.mockReset();
    vi.restoreAllMocks();

    // Setup mock for Wake Lock API before importing the module
    sentinelReleaseMock = vi.fn().mockResolvedValue(undefined);
    mockSentinel = { release: sentinelReleaseMock };
    wakeLockRequestMock = vi.fn().mockResolvedValue(mockSentinel);

    vi.stubGlobal('navigator', {
      wakeLock: {
        request: wakeLockRequestMock,
      },
    });

    // Ensure visibilityState is configurable for tests
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });

    // Track visibilitychange listeners added by module so we can remove them in afterEach.
    // This prevents stale listeners (with different lastIs* closures) from previous module instances
    // polluting later tests when we dispatchEvent.
    addedVisibilityListeners = [];
    const realAddEventListener = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((type: string, listener: any, options?: any) => {
      if (type === 'visibilitychange' && typeof listener === 'function') {
        addedVisibilityListeners.push(listener);
      }
      return realAddEventListener(type, listener, options);
    });

    // Dynamic import AFTER mocks (follows project pattern, never reimplement)
    mod = (await import('../utils/phoneUtils.js')) as PhoneUtilsModule;
  });

  afterEach(() => {
    // Cleanup listeners added by the (reloaded) module instance. Must happen before restoreAllMocks
    // so that removeEventListener works and we prevent listener accumulation / stale closures across tests.
    addedVisibilityListeners.forEach((listener) => {
      try {
        document.removeEventListener('visibilitychange', listener);
      } catch { /* ignore */ }
    });
    addedVisibilityListeners = [];

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // restore document prop if needed
    try {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
        writable: true,
      });
    } catch { /* ignore */ }
  });

  describe('TROFF_SETTING_KEEP_SCREEN_ON constant (imported from source)', () => {
    it('should import the real constant from constants', async () => {
      const constants = await import('../constants/constants.js');
      expect(constants.TROFF_SETTING_KEEP_SCREEN_ON).toBe('TROFF_SETTING_KEEP_SCREEN_ON');
    });
  });

  describe('getKeepScreenOn (default value true, reads nDB)', () => {
    it('should return true when nDB returns null (default)', () => {
      nDBGetMock.mockReturnValue(null);
      expect(mod.getKeepScreenOn()).toBe(true);
    });

    it('should return true when nDB returns undefined (default)', () => {
      nDBGetMock.mockReturnValue(undefined);
      expect(mod.getKeepScreenOn()).toBe(true);
    });

    it('should return true when nDB returns true', () => {
      nDBGetMock.mockReturnValue(true);
      expect(mod.getKeepScreenOn()).toBe(true);
    });

    it('should return false when nDB explicitly set to false', () => {
      nDBGetMock.mockReturnValue(false);
      expect(mod.getKeepScreenOn()).toBe(false);
    });
  });

  describe('requestWakeLock', () => {
    it('should call navigator.wakeLock.request with "screen"', async () => {
      const result = await mod.requestWakeLock();
      expect(wakeLockRequestMock).toHaveBeenCalledWith('screen');
      expect(result).toBe(mockSentinel);
    });

    it('should return null and not throw when wakeLock is unsupported', async () => {
      vi.stubGlobal('navigator', {} as Navigator);
      const result = await mod.requestWakeLock();
      expect(result).toBeNull();
    });
  });

  describe('releaseWakeLock', () => {
    it('should release active sentinel when present', async () => {
      await mod.requestWakeLock(); // acquire one
      await mod.releaseWakeLock();
      expect(sentinelReleaseMock).toHaveBeenCalled();
    });

    it('should be safe to call when no active lock', async () => {
      await expect(mod.releaseWakeLock()).resolves.toBeUndefined();
    });
  });

  describe('updateWakeLockForPlayback (respects keepScreenOn setting + page visible, independent of playback state)', () => {
    it('should request wake lock when isPlaying is true and keep screen on is true', async () => {
      nDBGetMock.mockReturnValue(true);
      wakeLockRequestMock.mockClear();
      await mod.updateWakeLockForPlayback(true, false);
      expect(wakeLockRequestMock).toHaveBeenCalledWith('screen');
    });

    it('should request wake lock when isStartingPlayback is true and keep screen on is true', async () => {
      nDBGetMock.mockReturnValue(true);
      wakeLockRequestMock.mockClear();
      await mod.updateWakeLockForPlayback(false, true);
      expect(wakeLockRequestMock).toHaveBeenCalledWith('screen');
    });

    it('should request wake lock when neither playing nor starting if keepScreenOn true and visible (new behavior: keep on for idle/paused, ready for next user tap)', async () => {
      nDBGetMock.mockReturnValue(true);
      wakeLockRequestMock.mockClear();
      await mod.updateWakeLockForPlayback(false, false);
      expect(wakeLockRequestMock).toHaveBeenCalledWith('screen');
    });

    it('should NOT request when keep screen on setting is false, even during playback', async () => {
      nDBGetMock.mockReturnValue(false);
      wakeLockRequestMock.mockClear();
      await mod.updateWakeLockForPlayback(true, false);
      expect(wakeLockRequestMock).not.toHaveBeenCalled();
    });

    it('should NOT release when playback stops (false, false) if keepScreenOn true (new: screen stays on while idle/paused)', async () => {
      nDBGetMock.mockReturnValue(true);
      await mod.requestWakeLock(); // ensure one is active
      sentinelReleaseMock.mockClear();
      await mod.updateWakeLockForPlayback(false, false);
      expect(sentinelReleaseMock).not.toHaveBeenCalled();
    });

    it('should release wake lock when keepScreenOn setting becomes false', async () => {
      nDBGetMock.mockReturnValue(true);
      await mod.requestWakeLock();
      sentinelReleaseMock.mockClear();
      nDBGetMock.mockReturnValue(false);
      await mod.updateWakeLockForPlayback(false, false);
      expect(sentinelReleaseMock).toHaveBeenCalled();
    });
  });

  describe('re-acquire wake lock on visibilitychange if keepScreenOn and visible (independent of last playback state)', () => {
    it('should re-request wake lock when visibility becomes visible with keepScreenOn true, even if not playing (new behavior for idle cases)', async () => {
      nDBGetMock.mockReturnValue(true);
      // intentionally do not call update with playing=true; last* remain false, test new indep logic in listener
      wakeLockRequestMock.mockClear();

      // Simulate visibility change to visible
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      // Allow any async listener to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(wakeLockRequestMock).toHaveBeenCalledWith('screen');
    });

    it('should not re-request on visibilitychange if setting is off', async () => {
      nDBGetMock.mockReturnValue(false);
      await mod.updateWakeLockForPlayback(true, false);
      wakeLockRequestMock.mockClear();

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(wakeLockRequestMock).not.toHaveBeenCalled();
    });
  });
});
