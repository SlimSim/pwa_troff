import { describe, it, expect } from 'vitest';
import type { TroffMarker } from '../types/troff.d.js';
import { mergeImportedMarkers } from '../utils/marker-import.js';

// --- Test data helpers (test fixtures only — NOT re-implementations of the logic under test) ---

const makeMarker = (
  id: string,
  time: number | string,
  name = 'Marker',
  info = '',
  color = 'None'
): TroffMarker => ({ color, id, info, name, time });

const cloneMarkers = (markers: TroffMarker[]): TroffMarker[] => markers.map((m) => ({ ...m }));

describe('mergeImportedMarkers', () => {
  it('adds every imported marker with new markersNrN ids when there is no time collision, leaving existing markers unchanged', () => {
    const existing = [
      makeMarker('markerNr0', 0, 'E0', 'i0'),
      makeMarker('markerNr1', 10, 'E1', 'i1'),
      makeMarker('markerNr2', 20, 'E2', 'i2'),
    ];
    const imported = [
      makeMarker('impA', 5, 'I0', 'j0'),
      makeMarker('impB', 15, 'I1', 'j1'),
      makeMarker('impC', 25.5, 'I2', 'j2'),
    ];

    const result = mergeImportedMarkers(existing, imported, 100);

    expect(result).toHaveLength(6);
    expect(result.map((m) => m.id)).toEqual([
      'markerNr0',
      'markerNr1',
      'markerNr2',
      'markerNr3',
      'markerNr4',
      'markerNr5',
    ]);
    expect(result.slice(0, 3)).toEqual(existing);
    expect(result[3]).toEqual(makeMarker('markerNr3', 5, 'I0', 'j0'));
    expect(result[4]).toEqual(makeMarker('markerNr4', 15, 'I1', 'j1'));
    expect(result[5]).toEqual(makeMarker('markerNr5', 25.5, 'I2', 'j2'));
  });

  it('keeps the existing name when existing and imported names are equal', () => {
    const result = mergeImportedMarkers(
      [makeMarker('markerNr0', 10, 'Same')],
      [makeMarker('impX', 10, 'Same')],
      100
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Same');
    expect(result[0].id).toBe('markerNr0');
  });

  it('appends an imported name as "existing, imported" when the names differ', () => {
    const result = mergeImportedMarkers(
      [makeMarker('markerNr0', 10, 'Existing')],
      [makeMarker('impX', 10, 'Imported')],
      100
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Existing, Imported');
  });

  it('keeps the existing info when existing and imported info are equal', () => {
    const result = mergeImportedMarkers(
      [makeMarker('markerNr0', 10, 'A', 'keepMe')],
      [makeMarker('impX', 10, 'B', 'keepMe')],
      100
    );

    expect(result).toHaveLength(1);
    expect(result[0].info).toBe('keepMe');
  });

  it('separates differing info with a blank line when merging', () => {
    const result = mergeImportedMarkers(
      [makeMarker('markerNr0', 10, 'A', 'firstLine')],
      [makeMarker('impX', 10, 'B', 'secondLine')],
      100
    );

    expect(result).toHaveLength(1);
    expect(result[0].info).toBe('firstLine\n\nsecondLine');
  });

  it('keeps the existing color when only the existing marker has a color', () => {
    const result = mergeImportedMarkers(
      [makeMarker('markerNr0', 10, 'A', 'i', 'red')],
      [makeMarker('impX', 10, 'B', 'i', 'None')],
      100
    );

    expect(result).toHaveLength(1);
    expect(result[0].color).toBe('red');
  });

  it('uses the imported color when only the imported marker has a color', () => {
    const result = mergeImportedMarkers(
      [makeMarker('markerNr0', 10, 'A', 'i', 'None')],
      [makeMarker('impX', 10, 'B', 'i', 'blue')],
      100
    );

    expect(result).toHaveLength(1);
    expect(result[0].color).toBe('blue');
  });

  it('resolves to "None" when neither marker has a color (including empty string)', () => {
    const result = mergeImportedMarkers(
      [makeMarker('markerNr0', 10, 'A', 'i', 'None')],
      [makeMarker('impX', 10, 'B', 'i', '')],
      100
    );

    expect(result).toHaveLength(1);
    expect(result[0].color).toBe('None');
  });

  it('uses the imported color when both markers have a color', () => {
    const result = mergeImportedMarkers(
      [makeMarker('markerNr0', 10, 'A', 'i', 'red')],
      [makeMarker('impX', 10, 'B', 'i', 'blue')],
      100
    );

    expect(result).toHaveLength(1);
    expect(result[0].color).toBe('blue');
  });

  it('does NOT merge when the time difference is exactly 0.0011 (added as a new marker)', () => {
    const existing = [makeMarker('markerNr0', 5, 'Anchor')];
    const imported = [makeMarker('impX', 5.0011, 'Imported')];

    const result = mergeImportedMarkers(existing, imported, 100);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(makeMarker('markerNr0', 5, 'Anchor'));
    expect(result[1]).toEqual(makeMarker('markerNr1', 5.0011, 'Imported'));
  });

  it('merges when the time difference is just below 0.001', () => {
    const existing = [makeMarker('markerNr0', 5, 'Anchor')];
    const imported = [makeMarker('impX', 5.0009999, 'Imported')];

    const result = mergeImportedMarkers(existing, imported, 100);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(makeMarker('markerNr0', 5, 'Anchor, Imported'));
  });

  it('keeps the existing marker id and time when merging', () => {
    const result = mergeImportedMarkers(
      [makeMarker('markerNr7', 12.5, 'Old', 'oldInfo', 'red')],
      [makeMarker('impX', 12.5, 'New', 'newInfo', 'blue')],
      100
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('markerNr7');
    expect(result[0].time).toBe(12.5);
  });

  it('compares string times numerically', () => {
    const result = mergeImportedMarkers(
      [makeMarker('markerNr0', '12.5', 'Existing')],
      [makeMarker('impX', 12.5, 'New')],
      100
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('markerNr0');
    expect(result[0].time).toBe('12.5'); // keeps the existing string time on merge
    expect(result[0].name).toBe('Existing, New');
  });

  it('clamps an out-of-range imported time to maxTime without treating it as a collision', () => {
    const existing = [makeMarker('markerNr0', '12.5', 'Existing')];
    const imported = [makeMarker('impX', 99, 'New')];

    const result = mergeImportedMarkers(existing, imported, 60);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(makeMarker('markerNr0', '12.5', 'Existing'));
    expect(result[1]).toEqual(makeMarker('markerNr1', 60, 'New'));
  });

  it('clamps imported times above the song duration to maxTime', () => {
    const existing = [makeMarker('markerNr0', 0, 'Existing')];
    const imported = [makeMarker('impA', 999, 'WayLong'), makeMarker('impB', 12.5, 'Fine')];

    const result = mergeImportedMarkers(existing, imported, 60);

    expect(result.map((m) => m.time)).toEqual([0, 60, 12.5]);
  });

  it('clamps imported negative times to 0', () => {
    const existing = [makeMarker('markerNr0', 10, 'Existing')];
    const imported = [makeMarker('impA', -5, 'Negative'), makeMarker('impB', 12.5, 'Fine')];

    const result = mergeImportedMarkers(existing, imported, 60);

    expect(result.map((m) => m.time)).toEqual([10, 0, 12.5]);
  });

  it('clamps the "max" sentinel to a plain number equal to maxTime', () => {
    const existing = [makeMarker('markerNr0', 0, 'Existing')];
    const imported = [makeMarker('impA', 'max', 'AtEnd')];

    const result = mergeImportedMarkers(existing, imported, 60);

    expect(result).toHaveLength(2);
    expect(result[1].time).toBe(60);
    expect(result[1].time).toBeTypeOf('number');
  });

  it('returns a new array with fresh marker copies and does not mutate either input array', () => {
    const existing = [makeMarker('markerNr0', 0, 'Existing', 'iE', 'red')];
    const imported = [makeMarker('impX', 5, 'Imported', 'iI', 'blue')];
    const existingSnapshot = cloneMarkers(existing);
    const importedSnapshot = cloneMarkers(imported);

    const result = mergeImportedMarkers(existing, imported, 100);

    expect(result).not.toBe(existing);
    expect(result).not.toBe(imported);
    expect(existing).toEqual(existingSnapshot);
    expect(imported).toEqual(importedSnapshot);
    // existing entry is a structurally-equal but fresh object
    expect(result[0]).toEqual(existingSnapshot[0]);
    expect(result[0]).not.toBe(existing[0]);
    // added import entry is a fresh copy of the imported marker (with a new id)
    expect(result[1]).toEqual({ ...importedSnapshot[0], id: 'markerNr1' });
    expect(result[1]).not.toBe(imported[0]);
  });

  it('merges every imported marker that lands on the same existing marker time', () => {
    const existing = [makeMarker('markerNr0', 10, 'Existing', 'eInfo')];
    const imported = [
      makeMarker('impA', 10, 'Amber', 'aInfo'),
      makeMarker('impB', 10, 'Bob', 'bInfo'),
    ];

    const result = mergeImportedMarkers(existing, imported, 100);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      makeMarker('markerNr0', 10, 'Existing, Amber, Bob', 'eInfo\n\naInfo\n\nbInfo')
    );
  });

  it('allows new markerNrN ids even when an existing id is not in markerNrN format', () => {
    const existing = [makeMarker('custom1', 0, 'Custom')];
    const imported = [makeMarker('impX', 5, 'New')];

    const result = mergeImportedMarkers(existing, imported, 100);

    expect(result).toHaveLength(2);
    expect(result[1].id).toBe('markerNr0');
  });

  it('picks the lowest free markerNrN id after an existing high-numbered id', () => {
    const existing = [makeMarker('markerNr2', 0, 'Existing')];
    const imported = [makeMarker('impX', 5, 'New')];

    const result = mergeImportedMarkers(existing, imported, 100);

    expect(result).toHaveLength(2);
    expect(result[1].id).toBe('markerNr0');
  });

  it('matches an imported marker against previously added imported markers too', () => {
    const existing = [makeMarker('markerNr0', 0, 'Existing')];
    const imported = [makeMarker('first', 5, 'First'), makeMarker('second', 5.0000001, 'Second')];

    const result = mergeImportedMarkers(existing, imported, 100);

    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(['markerNr0', 'markerNr1']);
    expect(result[1].name).toBe('First, Second');
    expect(result[1].time).toBe(5);
  });
});
