import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GroupDialog } from './t-group-dialog.js';
import type { TroffFirebaseGroupIdentifyer } from '../../types/troff.d.js';

/**
 * Spec: skip group save when nothing changed (Option A — skip in the dialog).
 *
 * `t-group-dialog._save()` must close the dialog WITHOUT dispatching
 * `group-saved` (or `dialog-cancelled`) when an existing group is saved with
 * no edits. Everything else keeps the current behaviour:
 *   - existing group + at least one editable field differs → `group-saved`
 *   - new group (`group === null`) → always `group-saved` (creation syncs)
 *
 * Because `group-saved` is the only signal that makes v2Script dispatch
 * `group-sync-status` (the "syncing" badge), asserting that no `group-saved`
 * event leaves the dialog is the unit boundary for "no sync work happens".
 */

/** Private members under test — accessed via cast, as in other component tests. */
type GroupDialogInternals = {
  _editName: string;
  _editInfo: string;
  _editColor: string;
  _editIcon: string;
  _editOwners: string[];
  _save: () => void;
};

const internals = (element: GroupDialog) => element as unknown as GroupDialogInternals;

type SavedEvent = CustomEvent<{ group: TroffFirebaseGroupIdentifyer }>;

/** A fully populated existing group — every editable field has a value. */
function makeGroup(overrides: Partial<TroffFirebaseGroupIdentifyer> = {}): TroffFirebaseGroupIdentifyer {
  return {
    id: 7,
    firebaseGroupDocId: 'doc1',
    name: 'Band',
    info: 'Practice Tuesdays',
    color: '#ff0000',
    icon: 'music',
    owners: ['a@example.com', 'b@example.com'],
    songs: [],
    ...overrides,
  };
}

/** Events seen on `document` (they bubble + composed out of the dialog). */
let savedEvents: SavedEvent[];
let cancelledEvents: Event[];
let onSaved: (event: Event) => void;
let onCancelled: (event: Event) => void;

/** Mounts the dialog, then sets `group` and opens it (so the clone captures the group). */
async function openDialog(
  group: TroffFirebaseGroupIdentifyer | null
): Promise<GroupDialog> {
  const element = new GroupDialog();
  document.body.appendChild(element);
  await element.updateComplete;

  element.group = group;
  element.open = true;
  await element.updateComplete;
  return element;
}

async function save(element: GroupDialog): Promise<void> {
  internals(element)._save();
  await element.updateComplete;
}

describe('t-group-dialog unchanged save (skip dispatch)', () => {
  beforeEach(() => {
    savedEvents = [];
    cancelledEvents = [];
    onSaved = (event: Event) => savedEvents.push(event as SavedEvent);
    onCancelled = (event: Event) => cancelledEvents.push(event);
    document.addEventListener('group-saved', onSaved);
    document.addEventListener('dialog-cancelled', onCancelled);
  });

  afterEach(() => {
    document.removeEventListener('group-saved', onSaved);
    document.removeEventListener('dialog-cancelled', onCancelled);
    document.body.innerHTML = '';
  });

  it('existing group, no edits → closes without dispatching group-saved or dialog-cancelled', async () => {
    const element = await openDialog(makeGroup());

    // Sanity: the group was cloned on open, so "unchanged" is well defined.
    expect(internals(element)._editName).toBe('Band');
    expect(internals(element)._editOwners).toEqual(['a@example.com', 'b@example.com']);

    await save(element);

    expect(savedEvents.length, 'unchanged save must not dispatch group-saved').toBe(0);
    expect(cancelledEvents.length, 'unchanged save is not a cancel').toBe(0);
    expect(element.open, 'dialog must still close').toBe(false);
  });

  it('existing group, changed name → dispatches group-saved once with the new name', async () => {
    const element = await openDialog(makeGroup());

    internals(element)._editName = 'Renamed Band';
    await element.updateComplete;

    await save(element);

    expect(savedEvents.length, 'changed save must dispatch group-saved').toBe(1);
    expect(savedEvents[0].detail.group.name).toBe('Renamed Band');
    expect(element.open).toBe(false);
    expect(cancelledEvents.length).toBe(0);
  });

  it('existing group with fa-prefixed icon, no edits → not dispatched (icon normalization)', async () => {
    const element = await openDialog(makeGroup({ icon: 'fa-music' }));

    // Sanity: cloning strips the `fa-` prefix, so the comparison must normalize
    // the original the same way or this save always looks "changed".
    expect(internals(element)._editIcon).toBe('music');

    await save(element);

    expect(
      savedEvents.length,
      'fa-prefixed icon must normalize to unchanged, so nothing is dispatched'
    ).toBe(0);
    expect(element.open).toBe(false);
  });

  it('existing group, owners edited (one removed) → dispatches group-saved', async () => {
    const element = await openDialog(makeGroup());

    internals(element)._editOwners = ['a@example.com'];
    await element.updateComplete;

    await save(element);

    expect(savedEvents.length, 'owner change must dispatch group-saved').toBe(1);
    expect(savedEvents[0].detail.group.owners).toEqual(['a@example.com']);
    expect(element.open).toBe(false);
  });

  it('existing group, field changed then reverted before save → not dispatched', async () => {
    const element = await openDialog(makeGroup());

    internals(element)._editInfo = 'Something else entirely';
    await element.updateComplete;
    internals(element)._editInfo = 'Practice Tuesdays';
    await element.updateComplete;

    await save(element);

    expect(
      savedEvents.length,
      'a change-then-revert leaves nothing to save, so nothing is dispatched'
    ).toBe(0);
    expect(element.open).toBe(false);
  });

  it('new group (group === null) with untouched defaults → group-saved STILL dispatched', async () => {
    const element = await openDialog(null);

    // Sanity: creation starts from the empty defaults.
    expect(internals(element)._editName).toBe('');
    expect(internals(element)._editOwners).toEqual([]);

    await save(element);

    expect(savedEvents.length, 'creation must always dispatch group-saved').toBe(1);
    expect(savedEvents[0].detail.group.name).toBe('');
    expect(savedEvents[0].detail.group.songs).toEqual([]);
    expect(element.open).toBe(false);
  });
});
