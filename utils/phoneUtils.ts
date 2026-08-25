import { nDB } from '../assets/internal/db.js';
import { TROFF_SETTING_KEEP_SCREEN_ON } from '../constants/constants.js';

export function isPhoneWidth(): boolean {
  return window.innerWidth < 576;
}

export function optimizeMobile() {
  const screenWidth = window.innerWidth;
  if (screenWidth < 576) {
    const valueInDB = nDB.get('TROFF_SETTING_SONG_LIST_DOCKED_EXIT_ON_SELECT');
    if (valueInDB == null) {
      $('#TROFF_SETTING_SONG_LIST_DOCKED_EXIT_ON_SELECT').addClass('active');
    }
  }
}

interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}

let wakeLockSentinel: WakeLockSentinelLike | null = null;
let lastIsPlaying = false;
let lastIsStartingPlayback = false;

export function getKeepScreenOn(): boolean {
  const val = nDB.get(TROFF_SETTING_KEEP_SCREEN_ON);
  return Boolean(val ?? true);
}

export async function requestWakeLock(): Promise<unknown> {
  const nav = navigator as unknown as {
    wakeLock?: { request: (type: string) => Promise<unknown> };
  };
  if (!nav.wakeLock || typeof nav.wakeLock.request !== 'function') {
    return null;
  }
  try {
    const sentinel = await nav.wakeLock.request('screen');
    wakeLockSentinel = sentinel as WakeLockSentinelLike;
    const handleRelease = () => {
      wakeLockSentinel = null;
    };
    if (wakeLockSentinel?.addEventListener) {
      wakeLockSentinel.addEventListener('release', handleRelease);
    }
    return sentinel;
  } catch {
    wakeLockSentinel = null;
    return null;
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch { /* ignore */ }
    wakeLockSentinel = null;
  }
}

export async function updateWakeLockForPlayback(
  isPlaying: boolean,
  isStartingPlayback: boolean
): Promise<void> {
  lastIsPlaying = isPlaying;
  lastIsStartingPlayback = isStartingPlayback;
  const shouldKeep = (isPlaying || isStartingPlayback) && getKeepScreenOn();
  if (shouldKeep) {
    await requestWakeLock();
  } else {
    await releaseWakeLock();
  }
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const shouldKeep =
        (lastIsPlaying || lastIsStartingPlayback) && getKeepScreenOn();
      if (shouldKeep) {
        void requestWakeLock();
      }
    }
  });
}
