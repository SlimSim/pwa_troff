// utils/marker-actions.ts
// Pure marker operations (copy / move / delete / stretch), ported from the v1 app
// (scriptTroffClass.ts). No DOM access — operate on plain TroffMarker arrays.
import type { TroffMarker } from '../types/troff.d.js';

const clampTime = (time: number, maxTime: number): number =>
  Math.max(0, Math.min(maxTime, time));

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
 * selected original time), a new unique id, and keeps name/info/color.
 * No merge check (v1 quirk).
 */
export function copyMarkers(
  markers: TroffMarker[],
  timeForFirstMarker: number,
  startNr: number,
  endNr: number
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
      time: Number(original.time) + timeToAdd,
    });
  }
  return result;
}

/**
 * Shared implementation for moveMarkers/stretchMarkers: rebuilds the array,
 * recomputing the time of every marker in [startNr, endNr) with `getNewTime`
 * and clamping to [0, maxTime]. Moved markers absorb earlier markers that land
 * on the same time (v1 quirk): the earlier marker is removed and its name
 * (', ' prefixed) / info ('\n\n' prefixed) appended to the moved marker when
 * they differ. The moved marker keeps its own id.
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
      // Absorb earlier markers (with their updated times) that collide.
      let j = 0;
      while (j < result.length) {
        if (Number(result[j].time) === Number(moved.time)) {
          const earlier = result[j];
          if (moved.name !== earlier.name) {
            moved.name = moved.name + ', ' + earlier.name;
          }
          if (moved.info !== earlier.info) {
            moved.info = moved.info + '\n\n' + earlier.info;
          }
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
