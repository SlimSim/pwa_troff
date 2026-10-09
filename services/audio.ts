const audio = new Audio();

export { audio };

export const MAX_VOLUME_PERCENT = 420;

export function volumePercentToElementVolume(percent: number): number {
  const n = Number(percent);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(1, n / 100));
}

export function volumePercentToGain(percent: number): number {
  const n = Number(percent);
  if (!Number.isFinite(n)) {
    return 1;
  }
  if (n <= 100) {
    return 1;
  }
  return Math.max(0, Math.min(4.2, n / 100));
}

export interface VolumeElementTarget {
  volume: number;
}

export interface VolumeGainTarget {
  gain: { value: number };
}

export interface VolumeTargets {
  element?: VolumeElementTarget;
  gainNode?: VolumeGainTarget;
}

let boostContext: AudioContext | null = null;
let boostGainNode: GainNode | null = null;
let boostSourceCreated = false;

function getBoostGain(): GainNode | null {
  try {
    if (boostGainNode) {
      return boostGainNode;
    }
    const scope = globalThis as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    if (!boostContext) {
      boostContext = new Ctor();
    }
    try {
      void boostContext.resume?.();
    } catch {
      /* resume requires user gesture — ignore */
    }
    if (!boostSourceCreated) {
      try {
        const source = boostContext.createMediaElementSource(audio);
        const gain = boostContext.createGain();
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(boostContext.destination);
        boostGainNode = gain;
        boostSourceCreated = true;
        return boostGainNode;
      } catch {
        return boostGainNode;
      }
    }
    return boostGainNode;
  } catch {
    return null;
  }
}

export function setVolumePercent(percent: number, targets?: VolumeTargets): void {
  try {
    const elementVolume = volumePercentToElementVolume(percent);
    const gainValue = volumePercentToGain(percent);
    if (targets !== undefined && targets !== null && typeof targets === 'object') {
      const maybe = targets as Partial<VolumeTargets>;
      try {
        if (maybe.element && typeof maybe.element.volume === 'number') {
          maybe.element.volume = elementVolume;
        }
      } catch {
        /* ignore injectable element failure */
      }
      try {
        if (
          maybe.gainNode &&
          maybe.gainNode.gain &&
          typeof maybe.gainNode.gain.value === 'number'
        ) {
          maybe.gainNode.gain.value = gainValue;
        }
      } catch {
        /* ignore injectable gain failure */
      }
    }
    try {
      audio.volume = elementVolume;
    } catch {
      /* media unavailable in some test envs — ignore */
    }
    try {
      if (boostGainNode) {
        boostGainNode.gain.value = gainValue;
      }
    } catch {
      /* ignore gain update failure */
    }
    if (gainValue > 1) {
      try {
        const liveGain = getBoostGain();
        if (liveGain) {
          liveGain.gain.value = gainValue;
        }
      } catch {
        /* AudioContext unavailable — element volume already applied */
      }
    }
  } catch {
    /* never throw (happy-dom has no AudioContext) */
  }
}

export function applyVolumeBoost(percent: number, targets?: VolumeTargets): void {
  setVolumePercent(percent, targets);
}

export async function loadSong(songKey: string): Promise<{ url: string; isVideo: boolean } | null> {
  try {
    audio.pause();
    const cache = await caches.open('songCache-v1.0');
    const response = await cache.match(songKey);
    if (!response) {
      throw new Error(`Song ${songKey} not found in cache`);
    }
    const blob = await response.blob();
    return { url: URL.createObjectURL(blob), isVideo: blob.type.startsWith('video/') };
  } catch (error) {
    console.error('Error loading song:', error);
    return null;
  }
}
