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
