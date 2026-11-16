// Pure helpers for resilient playback of corrupt MP3s (notably iOS WebKit
// decoder skips: currentTime jumps forward, ended fires early, seeks past the
// corrupt tail fail). No DOM, no PII — safe to unit-test in isolation.

/** Numeric-only playback snapshot for silent Sentry capture. No song keys, names, URLs. */
export interface PlaybackErrorContextInput {
  duration: number;
  currentTime: number;
  seekableEnd: number;
  playbackStart: number;
  playbackStop: number;
  loopTimesLeft: number;
  fileSize: number;
  readyState: number;
  networkState: number;
  errorCode: number;
}

export type PlaybackErrorContext = PlaybackErrorContextInput;

const roundTime = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;

const safeCount = (value: number): number => (Number.isFinite(value) ? value : 0);

/** Clamp a seek request into [0, min(duration, seekableEnd)]. Returns 0 for non-finite input. */
export function clampSeekTime(
  requested: number,
  duration: number,
  seekableEnd: number
): number {
  if (!Number.isFinite(requested) || !Number.isFinite(duration) || !Number.isFinite(seekableEnd)) {
    return 0;
  }
  const upper = Math.max(0, Math.min(duration, seekableEnd));
  return Math.min(Math.max(0, requested), upper);
}

/** True for a forward jump larger than threshold (decoder skipped corrupt frames). */
export function isDiscontinuity(prevTime: number, currTime: number, threshold = 2): boolean {
  return currTime - prevTime > threshold;
}

/** True when ended fired while content remains (corrupt tail skipped). */
export function shouldTreatEndedAsGap(
  currentTime: number,
  duration: number,
  threshold = 2
): boolean {
  return duration - currentTime > threshold;
}

/** Build a numeric-only, PII-free context (time fields rounded to 0.1s). Extra fields are dropped. */
export function buildPlaybackErrorContext(
  input: PlaybackErrorContextInput
): PlaybackErrorContext {
  return {
    duration: roundTime(input.duration),
    currentTime: roundTime(input.currentTime),
    seekableEnd: roundTime(input.seekableEnd),
    playbackStart: roundTime(input.playbackStart),
    playbackStop: roundTime(input.playbackStop),
    loopTimesLeft: safeCount(input.loopTimesLeft),
    fileSize: safeCount(input.fileSize),
    readyState: safeCount(input.readyState),
    networkState: safeCount(input.networkState),
    errorCode: safeCount(input.errorCode),
  };
}

export interface PlaybackSkipInput {
  previousTime: number;
  currentTime: number;
  wallClockDeltaMs: number;
  playbackRate: number;
  thresholdSeconds?: number;
}

export interface PlaybackSkipResult {
  skipped: boolean;
  forwardSkipSeconds: number;
  expectedAdvanceSeconds: number;
  wallClockDeltaMs: number;
}

export interface PlaybackSkipContextInput {
  duration: number;
  currentTime: number;
  previousTime: number;
  seekableEnd: number;
  playbackStart: number;
  playbackStop: number;
  markerSliderMax: number;
  loopTimesLeft: number;
  fileSize: number;
  readyState: number;
  networkState: number;
  errorCode: number;
  wallClockDeltaMs: number;
  forwardSkipSeconds: number;
  volumePercent: number;
  gainValue: number;
  elementVolumeWorks: boolean;
  audioGraphEnabled: boolean;
  audioGraphCreated: boolean;
  audioContextState: 'none' | 'running' | 'suspended' | 'closed' | 'interrupted';
  audioContextSampleRate: number;
  waveformEnabled: boolean;
  waveformInProgress: boolean;
  waveformLastDurationMs: number;
  mediaKind: 'audio' | 'video';
  playbackRate: number;
  preservesPitch: boolean;
}

export type PlaybackSkipContext = PlaybackSkipContextInput;

const ZEROED_SKIP_RESULT: PlaybackSkipResult = {
  skipped: false,
  forwardSkipSeconds: 0,
  expectedAdvanceSeconds: 0,
  wallClockDeltaMs: 0,
};

/**
 * Compare the media clock against the wall clock to spot decoder skips
 * (iOS WebKit jumps currentTime forward over corrupt frames). Invalid or
 * stale samples (non-finite values, long gaps, bad rate) are never reported.
 */
export function detectPlaybackSkip(input: PlaybackSkipInput): PlaybackSkipResult {
  const { previousTime, currentTime, wallClockDeltaMs, playbackRate } = input;
  if (
    !Number.isFinite(previousTime) ||
    !Number.isFinite(currentTime) ||
    !Number.isFinite(wallClockDeltaMs) ||
    !Number.isFinite(playbackRate) ||
    wallClockDeltaMs <= 0 ||
    wallClockDeltaMs > 5000 ||
    playbackRate <= 0
  ) {
    return { ...ZEROED_SKIP_RESULT };
  }

  const thresholdInput = Number(input.thresholdSeconds);
  const thresholdSeconds =
    Number.isFinite(thresholdInput) && thresholdInput > 0 ? thresholdInput : 0.3;
  const expectedAdvanceSeconds = (wallClockDeltaMs / 1000) * playbackRate;
  const actualAdvanceSeconds = currentTime - previousTime;
  const forwardSkipSeconds = actualAdvanceSeconds - expectedAdvanceSeconds;

  return {
    skipped: forwardSkipSeconds > thresholdSeconds + 1e-9,
    forwardSkipSeconds: roundTime(forwardSkipSeconds),
    expectedAdvanceSeconds: roundTime(expectedAdvanceSeconds),
    wallClockDeltaMs: Math.round(wallClockDeltaMs),
  };
}

const roundInteger = (value: number): number => (Number.isFinite(value) ? Math.round(value) : 0);

const roundTwoDecimals = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

const AUDIO_CONTEXT_STATES: ReadonlyArray<PlaybackSkipContextInput['audioContextState']> = [
  'none',
  'running',
  'suspended',
  'closed',
  'interrupted',
];

/** Build a numeric-only, PII-free snapshot of a detected playback skip. */
export function buildPlaybackSkipContext(input: PlaybackSkipContextInput): PlaybackSkipContext {
  return {
    duration: roundTime(input.duration),
    currentTime: roundTime(input.currentTime),
    previousTime: roundTime(input.previousTime),
    seekableEnd: roundTime(input.seekableEnd),
    playbackStart: roundTime(input.playbackStart),
    playbackStop: roundTime(input.playbackStop),
    markerSliderMax: roundTime(input.markerSliderMax),
    loopTimesLeft: safeCount(input.loopTimesLeft),
    fileSize: safeCount(input.fileSize),
    readyState: safeCount(input.readyState),
    networkState: safeCount(input.networkState),
    errorCode: safeCount(input.errorCode),
    wallClockDeltaMs: roundInteger(input.wallClockDeltaMs),
    forwardSkipSeconds: roundTime(input.forwardSkipSeconds),
    volumePercent: roundInteger(input.volumePercent),
    gainValue: roundTwoDecimals(input.gainValue),
    elementVolumeWorks: Boolean(input.elementVolumeWorks),
    audioGraphEnabled: Boolean(input.audioGraphEnabled),
    audioGraphCreated: Boolean(input.audioGraphCreated),
    audioContextState: AUDIO_CONTEXT_STATES.includes(input.audioContextState)
      ? input.audioContextState
      : 'none',
    audioContextSampleRate: Number.isFinite(input.audioContextSampleRate)
      ? input.audioContextSampleRate
      : 0,
    waveformEnabled: Boolean(input.waveformEnabled),
    waveformInProgress: Boolean(input.waveformInProgress),
    waveformLastDurationMs: roundInteger(input.waveformLastDurationMs),
    mediaKind: input.mediaKind === 'video' ? 'video' : 'audio',
    playbackRate: roundTwoDecimals(input.playbackRate),
    preservesPitch: Boolean(input.preservesPitch),
  };
}

const BENIGN_PLAY_MESSAGE_FRAGMENTS = [
  'the operation was aborted',
  'play() request was interrupted',
  'interrupted by a call to pause',
];

/** Triage play() rejections: true for benign browser noise (aborts, autoplay blocks). */
export function isBenignPlayError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const name = (error as { name?: unknown }).name;
  if (name === 'AbortError' || name === 'NotAllowedError') {
    return true;
  }
  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') {
    return false;
  }
  const lower = message.toLowerCase();
  return BENIGN_PLAY_MESSAGE_FRAGMENTS.some((fragment) => lower.includes(fragment));
}
