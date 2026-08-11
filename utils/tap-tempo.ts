export interface TapTempoState {
  previousTime: number | null;
  startTime: number | null;
  nrTaps: number;
}

export function createTapTempoState(): TapTempoState {
  return { previousTime: null, startTime: null, nrTaps: 0 };
}

export function calculateTapTempo(state: TapTempoState, nowMs: number): number | null {
  if (state.previousTime === null || nowMs - state.previousTime > 3000) {
    state.startTime = nowMs;
    state.previousTime = nowMs;
    state.nrTaps = 0;
    return null;
  }

  state.nrTaps += 1;
  state.previousTime = nowMs;
  const elapsedSeconds = state.startTime === null ? 0 : (nowMs - state.startTime) / 1000;
  const bpm = Math.round((state.nrTaps * 60) / elapsedSeconds);
  return Number.isFinite(bpm) && bpm > 0 ? bpm : null;
}