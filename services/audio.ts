const audio = new Audio();

export { audio };

export const MAX_VOLUME_PERCENT = 420;

/**
 * Detects whether HTMLMediaElement.volume writes actually stick.
 * On iOS Safari the volume setter silently ignores (or throws on) writes, so
 * the in-app slider does nothing — in that case we route the full 0-420%
 * range through the GainNode instead. Probe with a throwaway Audio element
 * (create, write, read back, discard); anything that throws → false.
 */
function detectElementVolumeWorks(): boolean {
  try {
    const probe = new Audio();
    probe.volume = 0.5;
    return probe.volume === 0.5;
  } catch {
    return false;
  }
}

/**
 * iOS-family UA check: the read-back probe sticks on newer iOS while changing
 * nothing audible, so the probe alone cannot detect broken element volume.
 */
function isIOSFamily(): boolean {
  try {
    const scope = globalThis as unknown as {
      navigator?: { userAgent?: unknown; maxTouchPoints?: unknown };
    };
    const nav = scope.navigator;
    if (!nav || typeof nav.userAgent !== 'string') {
      return false;
    }
    const ua = nav.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) {
      return true;
    }
    if (
      /Macintosh/.test(ua) &&
      typeof nav.maxTouchPoints === 'number' &&
      nav.maxTouchPoints > 1
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const elementVolumeWorks = detectElementVolumeWorks() && !isIOSFamily();

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
  if (elementVolumeWorks && n <= 100) {
    /* element volume handles attenuation — keep the GainNode at unity */
    return 1;
  }
  /* element volume is broken (or percent > 100): map through the gain */
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

/**
 * When element volume is broken (iOS), the GainNode is the ONLY way to change
 * loudness, so the AudioContext must be running whenever audio plays.
 * Attach once at boost AudioContext creation; every resume is best-effort and
 * must never throw or leave an unhandled rejection.
 */
function attachResumeHooks(context: AudioContext): void {
  try {
    audio.addEventListener('play', () => {
      try {
        void context.resume?.().catch(() => {
          /* resume requires user gesture — ignore */
        });
      } catch {
        /* best-effort resume — ignore */
      }
    });
    context.addEventListener('statechange', () => {
      try {
        if (context.state !== 'running') {
          void context.resume?.().catch(() => {
            /* resume requires user gesture — ignore */
          });
        }
      } catch {
        /* best-effort resume — ignore */
      }
    });
  } catch {
    /* event listeners unavailable — ignore */
  }
}

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
      if (!elementVolumeWorks) {
        attachResumeHooks(boostContext);
      }
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
    /* Broken mode: pin element to unity — WebKit plumbs element.volume into
       MediaElementAudioSource input, so the gain node is the single source
       of truth (avoids double-attenuation). */
    const elementVolume = elementVolumeWorks ? volumePercentToElementVolume(percent) : 1;
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
    if (gainValue > 1 || !elementVolumeWorks) {
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
