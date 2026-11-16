/**
 * URL-controlled kill switches for the iOS audio-skipping diagnostics.
 * Flags are read live from window.location.search so a reload with a query
 * parameter changes behavior without touching stored settings.
 */
export interface DebugFlags {
  audioGraphEnabled: boolean;
  waveformEnabled: boolean;
}

const DEFAULT_FLAGS: DebugFlags = {
  audioGraphEnabled: true,
  waveformEnabled: true,
};

/**
 * Parse a location.search string (with or without the leading "?").
 * Only the literal value "off" (trimmed, case-insensitive) disables a flag;
 * missing/empty/on/0/false all keep it enabled.
 */
export function parseDebugFlags(search: string): DebugFlags {
  const flags: DebugFlags = { ...DEFAULT_FLAGS };
  if (typeof search !== 'string') {
    return flags;
  }
  try {
    const normalized = search.startsWith('?') ? search.slice(1) : search;
    const params = new URLSearchParams(normalized);
    for (const [key, value] of params.entries()) {
      const name = key.trim().toLowerCase();
      const disabled = value.trim().toLowerCase() === 'off';
      if (name === 'audiograph') {
        flags.audioGraphEnabled = !disabled;
      } else if (name === 'waveform') {
        flags.waveformEnabled = !disabled;
      }
    }
  } catch {
    return { ...DEFAULT_FLAGS };
  }
  return flags;
}

/** Read the debug flags from the live URL at call time (never cached). */
export function getDebugFlags(): DebugFlags {
  try {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_FLAGS };
    }
    return parseDebugFlags(window.location.search);
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

export function isAudioGraphEnabled(): boolean {
  return getDebugFlags().audioGraphEnabled;
}

export function isWaveformEnabled(): boolean {
  return getDebugFlags().waveformEnabled;
}
