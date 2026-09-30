import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SongEditDialog } from './t-song-edit-dialog.js';

/**
 * Spec: skip song save when nothing changed (Option A — skip in the dialog).
 *
 * `t-song-edit-dialog._save()` must close the dialog WITHOUT dispatching
 * `song-saved` (or `dialog-cancelled`) when an existing song is saved with no
 * edits: all 8 editable fields (customName, choreography, choreographer,
 * title, artist, album, genre, tags) deep-equal the prefill source
 * (`songData.fileData`, normalized with `?? ''`). `songData === null` counts
 * as unchanged (nothing to save), and change-then-revert counts as unchanged.
 *
 * Because `song-saved` is the only signal that makes v2Script write nDB and
 * (for Firebase-group songs) dispatch `song-sync-status`, asserting that no
 * `song-saved` event leaves the dialog is the unit boundary for "no sync work
 * happens".
 */

type SongData = SongEditDialog['songData'];
type SavedEvent = CustomEvent<{ songKey?: string; fileData?: Record<string, string> }>;

/** Events seen on `document` (they bubble + composed out of the dialog). */
let savedEvents: SavedEvent[];
let cancelledEvents: Event[];
let onSaved: (event: Event) => void;
let onCancelled: (event: Event) => void;

/** Fully populated existing song — every editable field has a value. */
function makeSongData(): NonNullable<SongData> {
  return {
    fileData: {
      customName: 'Original Name',
      choreography: 'Original Choreo',
      choreographer: 'Original Choreographer',
      title: 'Original Title',
      artist: 'Original Artist',
      album: 'Original Album',
      genre: 'Tango',
      tags: 'tag1',
    },
  };
}

/** Mounts the dialog, then sets `songData` and opens it (so the prefill runs). */
async function openDialog(songData: SongData): Promise<SongEditDialog> {
  const element = new SongEditDialog();
  document.body.appendChild(element);
  element.songKey = 'my-song.mp3';
  element.songData = songData;
  element.open = true;
  await element.updateComplete;
  return element;
}

function getInputValue(element: SongEditDialog, name: string): string | null {
  const tInput = element.shadowRoot?.querySelector(`t-input[name="${name}"]`) as
    | (HTMLElement & { value: string })
    | null;
  return tInput ? tInput.value : null;
}

function setInputValue(element: SongEditDialog, name: string, value: string): void {
  const tInput = element.shadowRoot?.querySelector(`t-input[name="${name}"]`) as
    | (HTMLElement & { value: string })
    | null;
  expect(tInput).toBeTruthy();
  tInput?.dispatchEvent(
    new CustomEvent('input', {
      detail: { value },
      bubbles: true,
      composed: true,
    })
  );
}

async function clickSave(element: SongEditDialog): Promise<void> {
  const saveBtn = element.shadowRoot?.querySelector('.save-btn') as HTMLElement | null;
  expect(saveBtn).toBeTruthy();
  saveBtn?.click();
  await element.updateComplete;
}

describe('t-song-edit-dialog unchanged save (skip dispatch)', () => {
  beforeEach(() => {
    savedEvents = [];
    cancelledEvents = [];
    onSaved = (event: Event) => savedEvents.push(event as SavedEvent);
    onCancelled = (event: Event) => cancelledEvents.push(event);
    document.addEventListener('song-saved', onSaved);
    document.addEventListener('dialog-cancelled', onCancelled);
  });

  afterEach(() => {
    document.removeEventListener('song-saved', onSaved);
    document.removeEventListener('dialog-cancelled', onCancelled);
    document.body.innerHTML = '';
  });

  it('existing song, no edits → closes without dispatching song-saved or dialog-cancelled', async () => {
    const element = await openDialog(makeSongData());

    // Sanity: the fields were prefilled from songData.fileData on open.
    expect(getInputValue(element, 'title')).toBe('Original Title');

    await clickSave(element);

    expect(savedEvents.length, 'unchanged save must not dispatch song-saved').toBe(0);
    expect(cancelledEvents.length, 'unchanged save is not a cancel').toBe(0);
    expect(element.open, 'dialog must still close').toBe(false);
  });

  it('existing song, one field changed → dispatches song-saved once with the new value', async () => {
    const element = await openDialog(makeSongData());

    setInputValue(element, 'artist', 'Edited Artist');
    await element.updateComplete;

    await clickSave(element);

    expect(savedEvents.length, 'changed save must dispatch song-saved').toBe(1);
    expect(savedEvents[0].detail.songKey).toBe('my-song.mp3');
    expect(savedEvents[0].detail.fileData?.artist).toBe('Edited Artist');
    expect(element.open).toBe(false);
    expect(cancelledEvents.length).toBe(0);
  });

  it('songData: null with untouched defaults → closes without dispatching anything', async () => {
    const element = await openDialog(null);

    // Sanity: without a song, every field prefills to the empty default.
    expect(getInputValue(element, 'customName')).toBe('');

    await clickSave(element);

    expect(savedEvents.length, 'nothing to save when songData is null').toBe(0);
    expect(cancelledEvents.length, 'a skip is not a cancel').toBe(0);
    expect(element.open, 'dialog must still close').toBe(false);
  });

  it('existing song, field changed then reverted before save → not dispatched', async () => {
    const element = await openDialog(makeSongData());

    setInputValue(element, 'title', 'Something else entirely');
    await element.updateComplete;
    setInputValue(element, 'title', 'Original Title');
    await element.updateComplete;

    await clickSave(element);

    expect(
      savedEvents.length,
      'a change-then-revert leaves nothing to save, so nothing is dispatched'
    ).toBe(0);
    expect(cancelledEvents.length).toBe(0);
    expect(element.open).toBe(false);
  });
});
