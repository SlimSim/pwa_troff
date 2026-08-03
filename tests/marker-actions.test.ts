import { describe, it, expect } from 'vitest';
import type { TroffMarker } from '../types/troff.d.js';
import {
  getSelectedMarkerRange,
  getNewMarkerIds,
  copyMarkers,
  moveMarkers,
  stretchMarkers,
  deleteMarkers,
} from '../utils/marker-actions.js';

// --- Test data helpers (test fixtures only — NOT re-implementations of the logic under test) ---

const makeMarker = (
  id: string,
  time: number | string,
  name = 'Marker',
  info = '',
  color = 'None'
): TroffMarker => ({ color, id, info, name, time });

const makeMarkers = (times: Array<number | string>): TroffMarker[] =>
  times.map((time, i) => makeMarker(`markerNr${i}`, time, `M${i}`, `info${i}`));

const cloneMarkers = (markers: TroffMarker[]): TroffMarker[] => markers.map((m) => ({ ...m }));

describe('getSelectedMarkerRange', () => {
  const markers = (): TroffMarker[] => [
    makeMarker('markerNr0', 0, 'Start'),
    makeMarker('markerNr1', 10, 'Middle'),
    makeMarker('markerNr2', 20, 'End'),
  ];

  it('returns [0, length] when no marker matches either id', () => {
    expect(getSelectedMarkerRange(markers(), 'nope', 'nopeS')).toEqual([0, 3]);
  });

  it('returns [startIndex, length] when only the start marker matches', () => {
    expect(getSelectedMarkerRange(markers(), 'markerNr1', 'nopeS')).toEqual([1, 3]);
  });

  it('returns [0, stopIndex + 1] when only the stop marker matches', () => {
    expect(getSelectedMarkerRange(markers(), 'nope', 'markerNr1S')).toEqual([0, 2]);
  });

  it('returns the selected range when both markers match', () => {
    expect(getSelectedMarkerRange(markers(), 'markerNr1', 'markerNr2S')).toEqual([1, 3]);
  });

  it('includes the stop marker (id with S suffix) in the range', () => {
    expect(getSelectedMarkerRange(markers(), 'markerNr0', 'markerNr1S')).toEqual([0, 2]);
  });
});

describe('getNewMarkerIds', () => {
  it('returns sequential ids starting at 0 when there are no collisions', () => {
    expect(getNewMarkerIds(2, [])).toEqual(['markerNr0', 'markerNr1']);
  });

  it('continues after the last sequential existing id', () => {
    expect(getNewMarkerIds(2, ['markerNr0', 'markerNr1'])).toEqual(['markerNr2', 'markerNr3']);
  });

  it('fills gaps in existing ids', () => {
    expect(getNewMarkerIds(2, ['markerNr0', 'markerNr2'])).toEqual(['markerNr1', 'markerNr3']);
  });

  it('runs past the gap when more ids are needed than free numbers between existing ones', () => {
    expect(getNewMarkerIds(3, ['markerNr0'])).toEqual(['markerNr1', 'markerNr2', 'markerNr3']);
  });

  it('ignores ids that are not in markerNrN format', () => {
    expect(getNewMarkerIds(1, ['custom', 'markerNr1'])).toEqual(['markerNr0']);
  });

  it('returns an empty array for count 0', () => {
    expect(getNewMarkerIds(0, ['markerNr0'])).toEqual([]);
  });
});

describe('copyMarkers', () => {
  it('appends copies of the selected range with shifted times and new ids', () => {
    const input = [
      makeMarker('markerNr0', 10, 'Start', 'startInfo'),
      makeMarker('markerNr1', 20, 'A', 'aInfo'),
      makeMarker('markerNr2', 30, 'B', 'bInfo'),
    ];
    const result = copyMarkers(input, 40, 1, 3);

    expect(result).toHaveLength(5);
    // originals unchanged and still in place
    expect(result[0]).toEqual(makeMarker('markerNr0', 10, 'Start', 'startInfo'));
    expect(result[1]).toEqual(makeMarker('markerNr1', 20, 'A', 'aInfo'));
    expect(result[2]).toEqual(makeMarker('markerNr2', 30, 'B', 'bInfo'));
    // copies keep name/info/color, get new times and unique ids
    expect(result[3]).toEqual(makeMarker('markerNr3', 40, 'A', 'aInfo'));
    expect(result[4]).toEqual(makeMarker('markerNr4', 50, 'B', 'bInfo'));
  });

  it('handles fractional timeToAdd', () => {
    const input = makeMarkers([10, 20]);
    const result = copyMarkers(input, 12.5, 0, 2);

    expect(result[2]).toEqual(makeMarker('markerNr2', 12.5, 'M0', 'info0'));
    expect(result[3]).toEqual(makeMarker('markerNr3', 22.5, 'M1', 'info1'));
  });

  it('handles negative timeToAdd without clamping', () => {
    const input = makeMarkers([10, 20]);
    const result = copyMarkers(input, 5, 0, 2);

    expect(result[2].time).toBe(5);
    expect(result[3].time).toBe(15);
  });

  it('converts string times with Number() when shifting', () => {
    const input = makeMarkers(['10', '20']);
    const result = copyMarkers(input, 15, 0, 2);

    expect(result[2].time).toBe(15);
    expect(result[3].time).toBe(25);
  });

  it('assigns ids unique against originals and against each other', () => {
    const input = makeMarkers([10, 20, 30]);
    const result = copyMarkers(input, 100, 0, 3);

    const originalIds = input.map((m) => m.id);
    const copyIds = result.slice(3).map((m) => m.id);
    expect(copyIds).toEqual(['markerNr3', 'markerNr4', 'markerNr5']);
    for (const id of copyIds) {
      expect(originalIds).not.toContain(id);
    }
    expect(new Set(copyIds).size).toBe(copyIds.length);
  });

  it('returns a new array and does not mutate the input', () => {
    const input = makeMarkers([10, 20]);
    const snapshot = cloneMarkers(input);

    const result = copyMarkers(input, 40, 0, 2);

    expect(result).not.toBe(input);
    expect(input).toEqual(snapshot);
  });
});

describe('moveMarkers', () => {
  it('moves all markers when the whole array is selected', () => {
    const input = makeMarkers([0, 5, 10]);
    const result = moveMarkers(input, 2, 0, 3, 100);

    expect(result).toHaveLength(3);
    expect(result.map((m) => m.time)).toEqual([2, 7, 12]);
    expect(result.map((m) => m.id)).toEqual(['markerNr0', 'markerNr1', 'markerNr2']);
  });

  it('moves only the selected range', () => {
    const input = makeMarkers([0, 5, 10]);
    const result = moveMarkers(input, 3, 1, 2, 100);

    expect(result.map((m) => m.time)).toEqual([0, 8, 10]);
  });

  it('clamps at maxTime', () => {
    const input = makeMarkers([0, 5, 10]);
    const result = moveMarkers(input, 50, 1, 2, 10);

    expect(result.map((m) => m.time)).toEqual([0, 10, 10]);
  });

  it('clamps at 0', () => {
    const input = makeMarkers([3, 5, 10]);
    const result = moveMarkers(input, -50, 0, 1, 100);

    expect(result.map((m) => m.time)).toEqual([0, 5, 10]);
  });

  it('converts string times with Number()', () => {
    const input = makeMarkers(['0', '5', '10']);
    const result = moveMarkers(input, 1, 0, 3, 100);

    expect(result.map((m) => m.time)).toEqual([1, 6, 11]);
  });

  it('merges an earlier marker on collision, appending name and info', () => {
    const input = [
      makeMarker('markerNr0', 0, 'Start', 'startInfo'),
      makeMarker('markerNr1', 5, 'Middle', 'middleInfo'),
      makeMarker('markerNr2', 10, 'End', 'endInfo'),
    ];
    const result = moveMarkers(input, -5, 1, 2, 100);

    expect(result).toEqual([
      makeMarker('markerNr1', 0, 'Middle, Start', 'middleInfo\n\nstartInfo'),
      makeMarker('markerNr2', 10, 'End', 'endInfo'),
    ]);
  });

  it('does not append the name when the moved and earlier markers have the same name', () => {
    const input = [
      makeMarker('markerNr0', 0, 'Same', 'i0'),
      makeMarker('markerNr1', 5, 'Same', 'i1'),
    ];
    const result = moveMarkers(input, -5, 1, 2, 100);

    expect(result).toEqual([makeMarker('markerNr1', 0, 'Same', 'i1\n\ni0')]);
  });

  it('does not append the info when the moved and earlier markers have the same info', () => {
    const input = [
      makeMarker('markerNr0', 0, 'A', 'info'),
      makeMarker('markerNr1', 5, 'B', 'info'),
    ];
    const result = moveMarkers(input, -5, 1, 2, 100);

    expect(result).toEqual([makeMarker('markerNr1', 0, 'B, A', 'info')]);
  });

  it('merges with an earlier marker that was itself moved', () => {
    const input = [
      makeMarker('markerNr0', 6, 'A', 'aInfo'),
      makeMarker('markerNr1', 0, 'X', 'xInfo'),
      makeMarker('markerNr2', 3, 'Y', 'yInfo'),
    ];
    const result = moveMarkers(input, 6, 1, 3, 6);

    // X clamps onto A (6) and absorbs it; Y clamps onto X (6) and absorbs X (including A inside)
    expect(result).toEqual([makeMarker('markerNr2', 6, 'Y, X, A', 'yInfo\n\nxInfo\n\naInfo')]);
  });

  it('absorbs multiple earlier markers one after another', () => {
    const input = [
      makeMarker('markerNr0', 6, 'A', 'aInfo'),
      makeMarker('markerNr1', 6, 'B', 'bInfo'),
      makeMarker('markerNr2', 0, 'X', 'xInfo'),
    ];
    const result = moveMarkers(input, 6, 2, 3, 6);

    expect(result).toEqual([
      makeMarker('markerNr2', 6, 'X, A, B', 'xInfo\n\naInfo\n\nbInfo'),
    ]);
  });

  it('does not merge when the resulting times differ', () => {
    const input = makeMarkers([0, 5, 10]);
    const result = moveMarkers(input, -3, 1, 2, 100);

    expect(result).toHaveLength(3);
    expect(result.map((m) => m.time)).toEqual([0, 2, 10]);
    expect(result.map((m) => m.id)).toEqual(['markerNr0', 'markerNr1', 'markerNr2']);
  });

  it('returns a new array and does not mutate the input', () => {
    const input = makeMarkers([0, 5, 10]);
    const snapshot = cloneMarkers(input);

    const result = moveMarkers(input, 2, 0, 3, 100);

    expect(result).not.toBe(input);
    expect(input).toEqual(snapshot);
  });
});

describe('stretchMarkers', () => {
  it('doubles times for the whole array with base 0 at 200%', () => {
    const input = makeMarkers([0, 5, 10]);
    const snapshot = cloneMarkers(input);

    const result = stretchMarkers(input, 200, 0, 0, 3, 100);

    expect(result.map((m) => m.time)).toEqual([0, 10, 20]);
    expect(input).toEqual(snapshot);
  });

  it('keeps the start marker put when baseValue is its time', () => {
    const input = makeMarkers([10, 20, 30]);
    const result = stretchMarkers(input, 200, 20, 1, 3, 100);

    expect(result.map((m) => m.time)).toEqual([10, 20, 40]);
  });

  it('clamps at maxTime', () => {
    const input = makeMarkers([0, 5]);
    const result = stretchMarkers(input, 300, 0, 1, 2, 10);

    expect(result.map((m) => m.time)).toEqual([0, 10]);
  });

  it('merges markers that collide after stretching', () => {
    const input = [
      makeMarker('markerNr0', 0, 'A', 'aInfo'),
      makeMarker('markerNr1', 5, 'B', 'bInfo'),
      makeMarker('markerNr2', 10, 'C', 'cInfo'),
    ];
    const result = stretchMarkers(input, 200, 0, 1, 3, 10);

    // B doubles to 10; C doubles to 20 but clamps to 10 and absorbs B
    expect(result).toEqual([
      makeMarker('markerNr0', 0, 'A', 'aInfo'),
      makeMarker('markerNr2', 10, 'C, B', 'cInfo\n\nbInfo'),
    ]);
  });

  it('is a no-op at 100%', () => {
    const input = makeMarkers([0, 5, 10]);
    const result = stretchMarkers(input, 100, 0, 0, 3, 100);

    expect(result.map((m) => m.time)).toEqual([0, 5, 10]);
    expect(result.map((m) => m.id)).toEqual(['markerNr0', 'markerNr1', 'markerNr2']);
  });

  it('returns a new array and does not mutate the input', () => {
    const input = makeMarkers([0, 5, 10]);
    const snapshot = cloneMarkers(input);

    const result = stretchMarkers(input, 150, 0, 0, 3, 100);

    expect(result).not.toBe(input);
    expect(input).toEqual(snapshot);
  });
});

describe('deleteMarkers', () => {
  it('removes a middle range and keeps the surrounding markers', () => {
    const input = [
      makeMarker('markerNr0', 0, 'Start', 'startInfo'),
      makeMarker('markerNr1', 5, 'A', 'aInfo'),
      makeMarker('markerNr2', 10, 'B', 'bInfo'),
      makeMarker('markerNr3', 15, 'End', 'endInfo'),
    ];
    const result = deleteMarkers(input, 1, 3);

    expect(result).toEqual([
      makeMarker('markerNr0', 0, 'Start', 'startInfo'),
      makeMarker('markerNr3', 15, 'End', 'endInfo'),
    ]);
  });

  it('keeps start and stop markers when deleting the range between them', () => {
    const input = makeMarkers([0, 5, 10]);
    const result = deleteMarkers(input, 1, 2);

    expect(result).toEqual([
      makeMarker('markerNr0', 0, 'M0', 'info0'),
      makeMarker('markerNr2', 10, 'M2', 'info2'),
    ]);
  });

  it('returns an empty array when everything is deleted', () => {
    const input = makeMarkers([0, 5, 10]);
    const result = deleteMarkers(input, 0, 3);

    expect(result).toEqual([]);
  });

  it('returns a new array and does not mutate the input', () => {
    const input = makeMarkers([0, 5, 10]);
    const snapshot = cloneMarkers(input);

    const result = deleteMarkers(input, 1, 2);

    expect(result).not.toBe(input);
    expect(input).toEqual(snapshot);
  });
});
