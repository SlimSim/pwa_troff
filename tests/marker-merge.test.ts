import { describe, it, expect } from 'vitest';
import type { TroffMarker } from '../types/troff.d.js';
import {
  mergeNearbyMarkers,
  copyMarkers,
  moveMarkers,
  mergeMarkerInto,
  hasColor,
  MERGE_TIME_THRESHOLD,
} from '../utils/marker-actions.js';

// --- Test data helpers (test fixtures only — NOT re-implementations of the logic under test) ---

const makeMarker = (
  id: string,
  time: number | string,
  name = 'Marker',
  info = '',
  color = 'None'
): TroffMarker => ({ color, id, info, name, time });

const cloneMarkers = (markers: TroffMarker[]): TroffMarker[] => markers.map((m) => ({ ...m }));

describe('mergeNearbyMarkers', () => {
  it('merges two markers at the exact same time, first survives', () => {
    const markers = [
      makeMarker('markerNr0', 10, 'First', 'firstInfo', 'red'),
      makeMarker('markerNr1', 10, 'Second', 'secondInfo', 'blue'),
    ];

    const result = mergeNearbyMarkers(markers);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('markerNr0');
    expect(result[0].name).toBe('First, Second');
    expect(result[0].info).toBe('firstInfo\n\nsecondInfo');
    expect(result[0].color).toBe('blue');
  });

  it('merges two markers within 0.001s threshold', () => {
    const markers = [makeMarker('markerNr0', 5.0, 'A'), makeMarker('markerNr1', 5.0005, 'B')];

    const result = mergeNearbyMarkers(markers);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('markerNr0');
    expect(result[0].name).toBe('A, B');
  });

  it('does NOT merge markers that are exactly 0.001s apart', () => {
    const markers = [makeMarker('markerNr0', 5.0, 'A'), makeMarker('markerNr1', 5.001, 'B')];

    const result = mergeNearbyMarkers(markers);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('markerNr0');
    expect(result[1].id).toBe('markerNr1');
  });

  it('does NOT merge markers that differ by more than 0.001s', () => {
    const markers = [makeMarker('markerNr0', 10, 'A'), makeMarker('markerNr1', 10.5, 'B')];

    const result = mergeNearbyMarkers(markers);

    expect(result).toHaveLength(2);
  });

  it('merges multiple markers landing at the same time into the first', () => {
    const markers = [
      makeMarker('markerNr0', 10, 'Alpha', 'aInfo'),
      makeMarker('markerNr1', 10.0001, 'Beta', 'bInfo'),
      makeMarker('markerNr2', 10.0002, 'Gamma', 'cInfo'),
    ];

    const result = mergeNearbyMarkers(markers);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      makeMarker('markerNr0', 10, 'Alpha, Beta, Gamma', 'aInfo\n\nbInfo\n\ncInfo')
    );
  });

  it('does not merge markers that are far apart', () => {
    const markers = [
      makeMarker('markerNr0', 0, 'Start'),
      makeMarker('markerNr1', 10, 'Middle'),
      makeMarker('markerNr2', 20, 'End'),
    ];

    const result = mergeNearbyMarkers(markers);

    expect(result).toHaveLength(3);
  });

  it('keeps the existing name when both markers have the same name', () => {
    const result = mergeNearbyMarkers([
      makeMarker('markerNr0', 10, 'Same'),
      makeMarker('markerNr1', 10, 'Same'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Same');
  });

  it('keeps the existing info when both markers have the same info', () => {
    const result = mergeNearbyMarkers([
      makeMarker('markerNr0', 10, 'A', 'sameInfo'),
      makeMarker('markerNr1', 10, 'B', 'sameInfo'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].info).toBe('sameInfo');
  });

  it('resolves color to "None" when neither marker has a color', () => {
    const result = mergeNearbyMarkers([
      makeMarker('markerNr0', 10, 'A', 'i', 'None'),
      makeMarker('markerNr1', 10, 'B', 'i', ''),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].color).toBe('None');
  });

  it('takes the imported color when only the imported marker has a color', () => {
    const result = mergeNearbyMarkers([
      makeMarker('markerNr0', 10, 'A', 'i', 'None'),
      makeMarker('markerNr1', 10, 'B', 'i', 'green'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].color).toBe('green');
  });

  it('keeps the existing color when only the existing marker has a color', () => {
    const result = mergeNearbyMarkers([
      makeMarker('markerNr0', 10, 'A', 'i', 'red'),
      makeMarker('markerNr1', 10, 'B', 'i', 'None'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].color).toBe('red');
  });

  it('takes the imported color when both markers have a color', () => {
    const result = mergeNearbyMarkers([
      makeMarker('markerNr0', 10, 'A', 'i', 'red'),
      makeMarker('markerNr1', 10, 'B', 'i', 'blue'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].color).toBe('blue');
  });

  it('does not mutate the input array', () => {
    const input = [
      makeMarker('markerNr0', 10, 'A', 'aInfo', 'red'),
      makeMarker('markerNr1', 10, 'B', 'bInfo', 'blue'),
    ];
    const snapshot = cloneMarkers(input);

    const result = mergeNearbyMarkers(input);

    expect(result).not.toBe(input);
    expect(input).toEqual(snapshot);
    expect(result[0]).not.toBe(input[0]);
  });

  it('compares string times numerically', () => {
    const result = mergeNearbyMarkers([
      makeMarker('markerNr0', '12.5', 'Existing'),
      makeMarker('markerNr1', 12.5, 'New'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('markerNr0');
    expect(result[0].time).toBe('12.5');
    expect(result[0].name).toBe('Existing, New');
  });

  it('handles a chain of markers with slightly increasing times', () => {
    const markers = [
      makeMarker('markerNr0', 0, 'M0'),
      makeMarker('markerNr1', 0.0001, 'M1'),
      makeMarker('markerNr2', 0.0002, 'M2'),
      makeMarker('markerNr3', 10, 'M3'),
    ];

    const result = mergeNearbyMarkers(markers);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('M0, M1, M2');
    expect(result[1].name).toBe('M3');
  });
});

describe('copyMarkers with merge', () => {
  it('merges a copy that lands on a different marker time', () => {
    const input = [
      makeMarker('markerNr0', 10, 'First', 'firstInfo'),
      makeMarker('markerNr1', 20, 'Second', 'secondInfo'),
    ];
    // Copy markerNr1 to time 10 — lands on markerNr0's time
    const result = copyMarkers(input, 10, 1, 2, 100);

    expect(result).toHaveLength(2);
    // markerNr0 survives (first in array), copy merged into it
    expect(result[0]).toEqual(
      makeMarker('markerNr0', 10, 'First, Second', 'firstInfo\n\nsecondInfo')
    );
    expect(result[1]).toEqual(makeMarker('markerNr1', 20, 'Second', 'secondInfo'));
  });

  it('absorbs a self-copy into the original when names and info are identical', () => {
    const input = [
      makeMarker('markerNr0', 10, 'Original', 'origInfo'),
      makeMarker('markerNr1', 20, 'Other'),
    ];
    // Copy markerNr0 to its own time — same name/info, so nothing is appended
    const result = copyMarkers(input, 10, 0, 1, 100);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(makeMarker('markerNr0', 10, 'Original', 'origInfo'));
    expect(result[1]).toEqual(makeMarker('markerNr1', 20, 'Other'));
  });

  it('merges copies that land on the same time as each other', () => {
    // The two selected markers share a time, so both copies land at 40 and merge
    const input = [
      makeMarker('markerNr0', 10, 'A'),
      makeMarker('markerNr1', 10, 'B'),
      makeMarker('markerNr2', 50, 'C'),
    ];
    const result = copyMarkers(input, 40, 0, 2, 100);

    expect(result).toHaveLength(3);
    // Original pair at time 10 merges too
    expect(result[0].name).toBe('A, B');
    // Both copies land at 40 and merge into one
    expect(result[2].time).toBe(40);
    expect(result[2].name).toBe('A, B');
  });

  it('does not merge when copies land at different times', () => {
    const input = [makeMarker('markerNr0', 10, 'A'), makeMarker('markerNr1', 20, 'B')];
    const result = copyMarkers(input, 40, 0, 2, 100);

    expect(result).toHaveLength(4);
    expect(result[2].time).toBe(40);
    expect(result[3].time).toBe(50);
  });
});

describe('moveMarkers threshold', () => {
  it('merges markers that are within 0.001s after moving (not exact equality)', () => {
    const input = [
      makeMarker('markerNr0', 5.0, 'A', 'aInfo'),
      makeMarker('markerNr1', 5.0005, 'B', 'bInfo'),
    ];
    // Move markerNr1 by -0.0005, landing at 5.0 (within 0.001s of markerNr0)
    const result = moveMarkers(input, -0.0005, 1, 2, 100);

    expect(result).toHaveLength(1);
    // Moved marker survives
    expect(result[0].id).toBe('markerNr1');
    expect(result[0].name).toBe('B, A');
  });

  it('does not merge when the time difference is exactly 0.001 after moving', () => {
    const input = [makeMarker('markerNr0', 5.0, 'A'), makeMarker('markerNr1', 5.001, 'B')];
    // Move markerNr1 by -0.0001, landing at 5.0009 (diff = 0.0009 < 0.001, will merge)
    // Let's use a diff that lands exactly at 0.001:
    // Move markerNr1 by -0.0005, landing at 5.0005, diff = 0.0005 < 0.001 → merges
    // Actually, let's test: markerNr0 at 5.0, markerNr1 at 5.002, move by -0.001 → lands at 5.001, diff = 0.001 → does NOT merge
    const input2 = [makeMarker('markerNr0', 5.0, 'A'), makeMarker('markerNr1', 5.002, 'B')];
    const result = moveMarkers(input2, -0.001, 1, 2, 100);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('markerNr0');
    expect(result[1].id).toBe('markerNr1');
  });
});

describe('hasColor', () => {
  it('returns false for undefined', () => {
    expect(hasColor(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(hasColor('')).toBe(false);
  });

  it('returns false for "None"', () => {
    expect(hasColor('None')).toBe(false);
  });

  it('returns true for a color name', () => {
    expect(hasColor('red')).toBe(true);
  });
});

describe('mergeMarkerInto', () => {
  it('merges source name into target when names differ', () => {
    const target = makeMarker('m1', 10, 'Target', 'tInfo', 'red');
    const source = makeMarker('m2', 10, 'Source', 'sInfo', 'blue');

    mergeMarkerInto(target, source);

    expect(target.name).toBe('Target, Source');
    expect(target.info).toBe('tInfo\n\nsInfo');
    expect(target.color).toBe('blue');
  });

  it('does not modify name when names are the same', () => {
    const target = makeMarker('m1', 10, 'Same', 'tInfo');
    const source = makeMarker('m2', 10, 'Same', 'sInfo');

    mergeMarkerInto(target, source);

    expect(target.name).toBe('Same');
  });

  it('does not modify info when infos are the same', () => {
    const target = makeMarker('m1', 10, 'A', 'same');
    const source = makeMarker('m2', 10, 'B', 'same');

    mergeMarkerInto(target, source);

    expect(target.info).toBe('same');
  });

  it('keeps target color when source has no color', () => {
    const target = makeMarker('m1', 10, 'A', 'i', 'red');
    const source = makeMarker('m2', 10, 'B', 'i', 'None');

    mergeMarkerInto(target, source);

    expect(target.color).toBe('red');
  });

  it('takes source color when target has no color', () => {
    const target = makeMarker('m1', 10, 'A', 'i', 'None');
    const source = makeMarker('m2', 10, 'B', 'i', 'blue');

    mergeMarkerInto(target, source);

    expect(target.color).toBe('blue');
  });

  it('resolves to None when neither has a color', () => {
    const target = makeMarker('m1', 10, 'A', 'i', 'None');
    const source = makeMarker('m2', 10, 'B', 'i', '');

    mergeMarkerInto(target, source);

    expect(target.color).toBe('None');
  });
});

describe('MERGE_TIME_THRESHOLD constant', () => {
  it('is 0.001', () => {
    expect(MERGE_TIME_THRESHOLD).toBe(0.001);
  });
});
