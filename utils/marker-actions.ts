// utils/marker-actions.ts
// Pure marker operations (copy / move / delete / stretch), ported from the v1 app
// (scriptTroffClass.ts). No DOM access — operate on plain TroffMarker arrays.
import type { TroffMarker } from '../types/troff.d.ts';

/**
 * Markers whose numeric times are within this many seconds of each other are
 * considered "at the same time" and are merged. Ported from v1's addMarker
 * (scriptTroffClass.ts:2310 / marker-import.ts).
 */
export const MERGE_TIME_THRESHOLD = 0.001;

/** Epsilon to absorb floating-point error at the 0.001 s merge boundary. */
const MERGE_TIME_EPSILON = 1e-9;

/** True when two numeric times are within MERGE_TIME_THRESHOLD of each other. */
const isWithinMergeThreshold = (a: number, b: number): boolean =>
  Math.abs(a - b) < MERGE_TIME_THRESHOLD - MERGE_TIME_EPSILON;

/** Sentinel meaning "no colour set". */
export const NO_COLOR = 'None';

/** Returns true when `color` is a real colour (not undefined, '', or 'None'). */
export const hasColor = (color: string | undefined): boolean =>
  color !== undefined && color !== '' && color !== NO_COLOR;

/**
 * Merges `source` into `target` in place. `target` survives (keeps its id and
 * time, absorbs source's name/info/color). Name joined with ', ' (only when
 * different), info joined with '\n\n' (only when different).
 */
export function mergeMarkerInto(target: TroffMarker, source: TroffMarker): void {
  if (target.name !== source.name) {
    target.name = target.name + ', ' + source.name;
  }
  if (target.info !== source.info) {
    target.info = target.info + '\n\n' + source.info;
  }
  // Color: only one coloured → that colour; both coloured → source; both none → 'None'
  if (!hasColor(target.color)) {
    target.color = hasColor(source.color) ? source.color : NO_COLOR;
  } else if (hasColor(source.color)) {
    target.color = source.color;
  }
}

/**
 * General-purpose merge: returns a new marker array where any markers whose
 * numeric times are within MERGE_TIME_THRESHOLD of each other are merged. The
 * first marker encountered at a given time survives; later nearby markers are
 * merged into it via `mergeMarkerInto`. Does NOT normalize 'max' sentinels or
 * clamp times — callers must normalise beforehand. Does not mutate the input.
 */
export function mergeNearbyMarkers(markers: TroffMarker[]): TroffMarker[] {
  const result: TroffMarker[] = [];
  for (const marker of markers) {
    const markerTime = Number(marker.time);
    const existing = result.find(
      (m) => isWithinMergeThreshold(Number(m.time), markerTime)
    );
    if (existing) {
      mergeMarkerInto(existing, { ...marker });
    } else {
      result.push({ ...marker });
    }
  }
  return result;
}

/** Clamps a time in seconds to [0, maxTime]. */
export const clampTime = (time: number, maxTime: number): number =>
  Math.max(0, Math.min(maxTime, time));

/**
 * Normalizes a marker time (`number`, a numeric string, or the 'max' end-of-song
 * sentinel) to a finite number of seconds and clamps it to [0, maxTime].
 * Non-finite values become 0.
 */
export function normalizeMarkerTime(time: number | string, maxTime: number): number {
  const value = time === 'max' ? maxTime : Number(time);
  return clampTime(Number.isFinite(value) ? value : 0, maxTime);
}

/**
 * Returns the half-open range [startNr, endNr) of the selected markers.
 * startNr = index of the marker with id === startMarkerId, 0 if not found.
 * endNr = index of the marker with id + 'S' === stopMarkerId, plus 1
 * (the stop marker itself is included), markers.length if not found.
 * In v2 the stop marker id is stored with an 'S' suffix (e.g. 'markerNr0S').
 */
export function getSelectedMarkerRange(
  markers: TroffMarker[],
  startMarkerId: string,
  stopMarkerId: string
): [number, number] {
  let startNr = 0;
  let endNr = markers.length;
  for (let k = 0; k < markers.length; k++) {
    if (markers[k].id === startMarkerId) startNr = k;
    if (markers[k].id + 'S' === stopMarkerId) endNr = k + 1;
  }
  return [startNr, endNr];
}

/**
 * Returns `count` new marker ids of the form 'markerNrN' (N >= 0) that are
 * not in existingIds and unique among themselves. Ids not in markerNrN format
 * are ignored (v1 only collided on the DOM ids it knew about).
 */
export function getNewMarkerIds(count: number, existingIds: string[]): string[] {
  const used = new Set<number>();
  for (const id of existingIds) {
    const match = /^markerNr(\d+)$/.exec(id);
    if (match) used.add(Number(match[1]));
  }
  const result: string[] = [];
  let nr = 0;
  while (result.length < count) {
    if (!used.has(nr)) {
      used.add(nr);
      result.push('markerNr' + nr);
    }
    nr += 1;
  }
  return result;
}

/**
 * Appends copies of [startNr, endNr) to the end of the array. Originals are
 * unchanged. Each copy gets time = original time + (timeForFirstMarker - first
 * selected original time), a new unique id, and keeps name/info/color. After
 * copying, `mergeNearbyMarkers` is called so that copies landing on an existing
 * marker's time (or on each other) are merged into the survivor.
 */
export function copyMarkers(
  markers: TroffMarker[],
  timeForFirstMarker: number,
  startNr: number,
  endNr: number,
  maxTime = Infinity
): TroffMarker[] {
  const result = markers.map((m) => ({ ...m }));
  const timeToAdd = timeForFirstMarker - Number(markers[startNr].time);
  const newIds = getNewMarkerIds(endNr - startNr, result.map((m) => m.id));
  for (let i = startNr; i < endNr; i++) {
    const original = markers[i];
    result.push({
      color: original.color,
      id: newIds[i - startNr],
      info: original.info,
      name: original.name,
      time: clampTime(Number(original.time) + timeToAdd, maxTime),
    });
  }
  return mergeNearbyMarkers(result);
}

/**
 * Shared implementation for moveMarkers/stretchMarkers: rebuilds the array,
 * recomputing the time of every marker in [startNr, endNr) with `getNewTime`
 * and clamping to [0, maxTime]. Moved markers absorb earlier markers that land
 * within MERGE_TIME_THRESHOLD (0.001 s) of them: the earlier marker is removed
 * and its name/info/color merged into the moved marker via `mergeMarkerInto`.
 * The moved marker keeps its own id.
 */
const applyTimeChangeToRange = (
  markers: TroffMarker[],
  getNewTime: (marker: TroffMarker) => number,
  startNr: number,
  endNr: number,
  maxTime: number
): TroffMarker[] => {
  const result: TroffMarker[] = [];
  for (let i = 0; i < markers.length; i++) {
    const inRange = i >= startNr && i < endNr;
    const moved: TroffMarker = {
      ...markers[i],
      time: inRange ? clampTime(getNewTime(markers[i]), maxTime) : markers[i].time,
    };

    if (inRange) {
      // Absorb earlier markers (with their updated times) that collide within threshold.
      let j = 0;
      while (j < result.length) {
        if (isWithinMergeThreshold(Number(result[j].time), Number(moved.time))) {
          mergeMarkerInto(moved, result[j]);
          result.splice(j, 1);
        } else {
          j += 1;
        }
      }
    }
    result.push(moved);
  }
  return result;
};

/** Moves markers in [startNr, endNr) by `value` seconds, clamped to [0, maxTime]. */
export function moveMarkers(
  markers: TroffMarker[],
  value: number,
  startNr: number,
  endNr: number,
  maxTime: number
): TroffMarker[] {
  return applyTimeChangeToRange(markers, (m) => Number(m.time) + value, startNr, endNr, maxTime);
}

/**
 * Stretches markers in [startNr, endNr) around `baseValue` by `stretchPercent`,
 * clamped to [0, maxTime]. 100% is a natural no-op.
 */
export function stretchMarkers(
  markers: TroffMarker[],
  stretchPercent: number,
  baseValue: number,
  startNr: number,
  endNr: number,
  maxTime: number
): TroffMarker[] {
  return applyTimeChangeToRange(
    markers,
    (m) => ((Number(m.time) - baseValue) * stretchPercent) / 100 + baseValue,
    startNr,
    endNr,
    maxTime
  );
}

/** Returns a new array with the half-open range [startNr, endNr) removed. */
export function deleteMarkers(
  markers: TroffMarker[],
  startNr: number,
  endNr: number
): TroffMarker[] {
  return markers.map((m) => ({ ...m })).filter((_, i) => i < startNr || i >= endNr);
}
