import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaItem } from './t-media.js';

describe('t-media highlighted class', () => {
  let el: MediaItem;

  beforeEach(() => {
    el = new MediaItem();
    document.body.appendChild(el);
  });

  afterEach(() => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
  });

  it('renders without the .highlighted class by default', async () => {
    await el.updateComplete;

    const container = el.shadowRoot?.querySelector('.media-container');
    expect(container).toBeTruthy();
    expect(container?.classList.contains('highlighted')).toBe(false);
  });

  it('applies the .highlighted class when highlighted is true', async () => {
    (el as any).highlighted = true;
    await el.updateComplete;

    const container = el.shadowRoot?.querySelector('.media-container.highlighted');
    expect(container).toBeTruthy();
    expect(container?.classList.contains('highlighted')).toBe(true);
  });

  it('removes the .highlighted class when highlighted flips to false', async () => {
    (el as any).highlighted = true;
    await el.updateComplete;

    const containerWithHighlight = el.shadowRoot?.querySelector('.media-container.highlighted');
    expect(containerWithHighlight).toBeTruthy();

    (el as any).highlighted = false;
    await el.updateComplete;

    const container = el.shadowRoot?.querySelector('.media-container');
    expect(container).toBeTruthy();
    expect(container?.classList.contains('highlighted')).toBe(false);
  });

  it('coexists with the .active class (both classes present when both properties are true)', async () => {
    (el as any).active = true;
    (el as any).highlighted = true;
    await el.updateComplete;

    const container = el.shadowRoot?.querySelector('.media-container');
    expect(container).toBeTruthy();
    expect(container?.classList.contains('active')).toBe(true);
    expect(container?.classList.contains('highlighted')).toBe(true);
  });
});

describe('t-media song edit button', () => {
  let el: MediaItem;

  beforeEach(() => {
    el = new MediaItem();
    document.body.appendChild(el);
  });

  afterEach(() => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
  });

  it('renders the edit button when songKey is set', async () => {
    el.songKey = 'my-song.mp3';
    await el.updateComplete;

    const editBtn = el.shadowRoot?.querySelector('.edit-btn');
    expect(editBtn).toBeTruthy();
  });

  it('does not render the edit button when songKey is empty', async () => {
    el.songKey = '';
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.edit-btn')).toBeNull();
  });

  it('clicking the edit button dispatches song-edit-requested with the songKey and not media-selected', async () => {
    const editSpy = vi.fn();
    const selectedSpy = vi.fn();
    el.addEventListener('song-edit-requested', editSpy);
    el.addEventListener('media-selected', selectedSpy);

    el.songKey = 'my-song.mp3';
    await el.updateComplete;

    const editBtn = el.shadowRoot?.querySelector('.edit-btn') as HTMLElement | null;
    expect(editBtn).toBeTruthy();
    editBtn?.click();
    await el.updateComplete;

    expect(editSpy).toHaveBeenCalledTimes(1);
    const event = editSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('song-edit-requested');
    expect(event.detail).toEqual({ songKey: 'my-song.mp3' });
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);

    expect(selectedSpy).not.toHaveBeenCalled();
  });

  it('does not render the edit button when hideEditButton is true', async () => {
    el.songKey = 'my-song.mp3';
    (el as any).hideEditButton = true;
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.edit-btn')).toBeNull();
  });

  it('renders the edit button when hideEditButton is false', async () => {
    el.songKey = 'my-song.mp3';
    (el as any).hideEditButton = false;
    await el.updateComplete;

    const editBtn = el.shadowRoot?.querySelector('.edit-btn');
    expect(editBtn).toBeTruthy();
  });

  it('clicking the row itself still dispatches media-selected', async () => {
    const selectedSpy = vi.fn();
    el.addEventListener('media-selected', selectedSpy);

    el.songKey = 'my-song.mp3';
    await el.updateComplete;

    const container = el.shadowRoot?.querySelector('.media-container') as HTMLElement | null;
    expect(container).toBeTruthy();
    container?.click();
    await el.updateComplete;

    expect(selectedSpy).toHaveBeenCalledTimes(1);
    const event = selectedSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.songKey).toBe('my-song.mp3');
  });
});

describe('t-media icon (isVideo) diagnostic', () => {
  let el: MediaItem;

  beforeEach(() => {
    el = new MediaItem();
    document.body.appendChild(el);
  });

  afterEach(() => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
  });

  const getIconName = (e: MediaItem): string | null => {
    const icon = e.shadowRoot?.querySelector('t-icon');
    return icon ? (icon.getAttribute('name') ?? (icon as any).name ?? null) : null;
  };

  it('property isVideo=false -> note', async () => {
    el.albumArt = '';
    el.isVideo = false;
    await el.updateComplete;
    expect(getIconName(el)).toBe('note');
  });

  it('property isVideo=true -> movie-tape', async () => {
    el.albumArt = '';
    el.isVideo = true;
    await el.updateComplete;
    expect(getIconName(el)).toBe('movie-tape');
  });

  it('attribute isVideo (absent) -> note', async () => {
    el.albumArt = '';
    el.removeAttribute('isVideo');
    await el.updateComplete;
    expect(getIconName(el)).toBe('note');
  });

  it('attribute isVideo="" -> movie-tape', async () => {
    el.albumArt = '';
    el.setAttribute('isVideo', '');
    await el.updateComplete;
    expect(getIconName(el)).toBe('movie-tape');
  });
});
