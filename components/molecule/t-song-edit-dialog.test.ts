import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SongEditDialog } from './t-song-edit-dialog.js';

/**
 * Tests for the song edit dialog (GitHub issue #26 — "Enable song editing").
 *
 * The dialog is a pure UI component: it receives the song via properties
 * (`songKey`, `songData`) and reports results via events. It must NOT import
 * nDB or Firebase — persistence is the parent's job (v2Script.ts wiring,
 * which is intentionally not tested here).
 *
 * Contract assumed for the implementation (documented for the implementer):
 *  - editable fields are <t-input> elements with a `name` attribute:
 *    customName, choreography, choreographer, title, artist, album, genre, tags
 *  - the song key is shown read-only in a <span id="file">
 *  - the computed display name is shown read-only in a <span id="displayName">
 *    and equals `customName || choreography || title || songKey`
 *  - footer buttons carry the classes .save-btn and .cancel-btn
 *  - clicking the .overlay backdrop (target === currentTarget) cancels
 *  - Escape (keydown on document) while open cancels
 */
describe('t-song-edit-dialog', () => {
  let element: SongEditDialog;

  beforeEach(() => {
    element = new SongEditDialog();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  function getInputValue(name: string): string | null {
    const tInput = element.shadowRoot?.querySelector(`t-input[name="${name}"]`) as
      | (HTMLElement & { value: string })
      | null;
    return tInput ? tInput.value : null;
  }

  function setInputValue(name: string, value: string): void {
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

  function getFieldNames(): string[] {
    return [
      'customName',
      'choreography',
      'choreographer',
      'title',
      'artist',
      'album',
      'genre',
      'tags',
    ];
  }

  it('renders with the overlay closed by default', async () => {
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.overlay.open')).toBeNull();
  });

  it('pre-fills the editable fields from songData.fileData when opened', async () => {
    element.songKey = 'my-song.mp3';
    element.songData = {
      fileData: {
        customName: 'My Custom Name',
        choreography: 'My Choreography',
        choreographer: 'My Choreographer',
        title: 'My Title',
        artist: 'My Artist',
        album: 'My Album',
        genre: 'Tango',
        tags: 'tag1, tag2',
      },
    };
    element.open = true;
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.overlay.open')).toBeTruthy();

    const expected = {
      customName: 'My Custom Name',
      choreography: 'My Choreography',
      choreographer: 'My Choreographer',
      title: 'My Title',
      artist: 'My Artist',
      album: 'My Album',
      genre: 'Tango',
      tags: 'tag1, tag2',
    };
    for (const field of getFieldNames()) {
      expect(getInputValue(field), `field "${field}"`).toBe(expected[field as keyof typeof expected]);
    }

    // The song key is shown read-only.
    expect(element.shadowRoot?.querySelector('span#file')?.textContent).toBe('my-song.mp3');
  });

  it('computes the readonly display name as customName || choreography || title || songKey', async () => {
    // customName wins over title
    element.songKey = 'my-song.mp3';
    element.songData = {
      fileData: {
        customName: 'Preferred Name',
        choreography: '',
        choreographer: '',
        title: 'Fallback Title',
        artist: '',
        album: '',
        genre: '',
        tags: '',
      },
    };
    element.open = true;
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('span#displayName')?.textContent).toBe('Preferred Name');

    // falls back to choreography when customName is empty
    element.open = false;
    element.songData = {
      fileData: {
        customName: '',
        choreography: 'Choreo Name',
        choreographer: '',
        title: '',
        artist: '',
        album: '',
        genre: '',
        tags: '',
      },
    };
    element.open = true;
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('span#displayName')?.textContent).toBe('Choreo Name');

    // falls back to songKey when all display fields are empty
    element.open = false;
    element.songData = {
      fileData: {
        customName: '',
        choreography: '',
        choreographer: '',
        title: '',
        artist: '',
        album: '',
        genre: '',
        tags: '',
      },
    };
    element.open = true;
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('span#displayName')?.textContent).toBe('my-song.mp3');
  });

  it('dispatches song-saved with songKey + edited fileData and closes on Save', async () => {
    const savedSpy = vi.fn();
    element.addEventListener('song-saved', savedSpy);

    element.songKey = 'my-song.mp3';
    element.songData = {
      fileData: {
        customName: 'Original Name',
        choreography: 'Choreo',
        choreographer: 'Choreographer',
        title: 'Title',
        artist: 'Artist',
        album: 'Album',
        genre: 'Tango',
        tags: 'tag1',
      },
    };
    element.open = true;
    await element.updateComplete;

    // Simulate the user editing two of the fields through the t-inputs.
    setInputValue('customName', 'Edited Name');
    setInputValue('artist', 'Edited Artist');
    await element.updateComplete;

    const saveBtn = element.shadowRoot?.querySelector('.save-btn') as HTMLElement | null;
    expect(saveBtn).toBeTruthy();
    saveBtn?.click();
    await element.updateComplete;

    expect(savedSpy).toHaveBeenCalledTimes(1);
    const event = savedSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('song-saved');
    expect(event.detail.songKey).toBe('my-song.mp3');

    const fileData = event.detail.fileData;
    expect(fileData.customName).toBe('Edited Name');
    expect(fileData.choreography).toBe('Choreo');
    expect(fileData.choreographer).toBe('Choreographer');
    expect(fileData.title).toBe('Title');
    expect(fileData.artist).toBe('Edited Artist');
    expect(fileData.album).toBe('Album');
    expect(fileData.genre).toBe('Tango');
    expect(fileData.tags).toBe('tag1');
    for (const field of getFieldNames()) {
      expect(fileData, `fileData should contain "${field}"`).toHaveProperty(field);
    }

    expect(element.open).toBe(false);
  });

  it('dispatches dialog-cancelled and closes on Cancel', async () => {
    const cancelledSpy = vi.fn();
    element.addEventListener('dialog-cancelled', cancelledSpy);

    element.songKey = 'my-song.mp3';
    element.songData = { fileData: {} };
    element.open = true;
    await element.updateComplete;

    const cancelBtn = element.shadowRoot?.querySelector('.cancel-btn') as HTMLElement | null;
    expect(cancelBtn).toBeTruthy();
    cancelBtn?.click();
    await element.updateComplete;

    expect(cancelledSpy).toHaveBeenCalledTimes(1);
    expect(element.open).toBe(false);
  });

  it('dispatches dialog-cancelled and closes when the overlay backdrop is clicked', async () => {
    const cancelledSpy = vi.fn();
    element.addEventListener('dialog-cancelled', cancelledSpy);

    element.songKey = 'my-song.mp3';
    element.songData = { fileData: {} };
    element.open = true;
    await element.updateComplete;

    const overlay = element.shadowRoot?.querySelector('.overlay') as HTMLElement | null;
    expect(overlay).toBeTruthy();
    // Dispatching directly on the overlay makes target === currentTarget,
    // i.e. a backdrop click (not a click on the dialog box itself).
    overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await element.updateComplete;

    expect(cancelledSpy).toHaveBeenCalledTimes(1);
    expect(element.open).toBe(false);
  });

  it('dispatches dialog-cancelled and closes on the Escape key while open', async () => {
    const cancelledSpy = vi.fn();
    element.addEventListener('dialog-cancelled', cancelledSpy);

    element.songKey = 'my-song.mp3';
    element.songData = { fileData: {} };
    element.open = true;
    await element.updateComplete;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await element.updateComplete;

    expect(cancelledSpy).toHaveBeenCalledTimes(1);
    expect(element.open).toBe(false);
  });
});
