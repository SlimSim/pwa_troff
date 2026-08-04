// utils/marker-import.ts
// Merge-import logic for the import/export dialog's "Merge with existing" mode.
//
// Ported from v1's addMarker (scriptTroffClass.ts:2310): an imported marker that
// lands within 0.001 s of an already-present marker is merged into it instead of
// being added as a new marker (name joined with ', ', info joined with '\n\n').
// Color merge rules are an explicit v2 choice (see below).
import type { TroffMarker } from '../types/troff.d.ts';
import {
  getNewMarkerIds,
  normalizeMarkerTime,
  mergeMarkerInto,
  MERGE_TIME_THRESHOLD,
} from './marker-actions.js';

/**
 * Returns a new marker list for a merge import: copies of `existingMarkers`
 * followed by the `importedMarkers` that do not collide with an already-placed
 * marker. Imported marker times are normalized (clamped to [0, maxTime] before
 * the collision check). An imported marker whose numeric time is within
 * MERGE_TIME_THRESHOLD (strictly less than) of an already-placed marker is
 * merged into it (keeping that marker's id and time). Non-colliding imports
 * get new `markerNrN` ids.
 */
export function mergeImportedMarkers(
  existingMarkers: TroffMarker[],
  importedMarkers: TroffMarker[],
  maxTime = Infinity
): TroffMarker[] {
  const result: TroffMarker[] = existingMarkers.map((m) => ({ ...m }));
  const added: TroffMarker[] = [];

  for (const imported of importedMarkers) {
    const time = normalizeMarkerTime(imported.time, maxTime);
    const existing =
      result.find((m) => Math.abs(Number(m.time) - time) < MERGE_TIME_THRESHOLD) ??
      added.find((m) => Math.abs(Number(m.time) - time) < MERGE_TIME_THRESHOLD);
    if (existing) {
      mergeMarkerInto(existing, imported);
    } else {
      added.push({ ...imported, time });
    }
  }

  const newIds = getNewMarkerIds(added.length, result.map((m) => m.id));
  for (let i = 0; i < added.length; i++) {
    added[i] = { ...added[i], id: newIds[i] };
  }

  return [...result, ...added];
}