import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './t-share-song-dialog.js';
import type { ShareSongDialog } from './t-share-song-dialog.js';

function createDialog(): ShareSongDialog {
  const dialog = document.createElement('t-share-song-dialog') as ShareSongDialog;
  document.body.appendChild(dialog);
  return dialog;
}

function findButton(dialog: HTMLElement, label: string): HTMLElement | null {
  const buttons = dialog.shadowRoot?.querySelectorAll('t-butt');
  if (!buttons) {
    return null;
  }
  for (const button of Array.from(buttons)) {
    const text = (button.textContent ?? '').trim().toLowerCase();
    if (text.includes(label.toLowerCase())) {
      return button as HTMLElement;
    }
  }
  return null;
}

describe('t-share-song-dialog', () => {
  let dialog: ShareSongDialog;

  beforeEach(() => {
    dialog = createDialog();
  });

  afterEach(() => {
    if (document.body.contains(dialog)) {
      document.body.removeChild(dialog);
    }
    vi.restoreAllMocks();
  });

  const overlay = () => dialog.shadowRoot?.querySelector('.overlay') as HTMLElement | null;
  const title = () => dialog.shadowRoot?.querySelector('.dialog-title')?.textContent ?? '';

  it('renders the confirm view with title "Upload Song" and an Upload song button by default', async () => {
    await dialog.updateComplete;

    expect(dialog.state).toBe('confirm');
    expect(title()).toContain('Upload Song');
    expect(findButton(dialog, 'Upload song')).toBeTruthy();
    expect(findButton(dialog, 'Cancel')).toBeTruthy();
  });

  it('emits share-confirmed when the Upload song button is clicked', async () => {
    await dialog.updateComplete;

    const confirmed = vi.fn();
    dialog.addEventListener('share-confirmed', confirmed);

    findButton(dialog, 'Upload song')!.click();
    await dialog.updateComplete;

    expect(confirmed).toHaveBeenCalledTimes(1);
  });

  it('emits dialog-cancelled and closes when Cancel is clicked', async () => {
    await dialog.updateComplete;

    const cancelled = vi.fn();
    dialog.addEventListener('dialog-cancelled', cancelled);

    findButton(dialog, 'Cancel')!.click();
    await dialog.updateComplete;

    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(false);
  });

  it('renders the uploading view and cannot be cancelled while uploading', async () => {
    dialog.state = 'uploading';
    dialog.open = true;
    await dialog.updateComplete;

    expect(title()).toContain('Upload in progress');

    const cancelled = vi.fn();
    dialog.addEventListener('dialog-cancelled', cancelled);

    // Neither the Cancel button (if present) nor the overlay may cancel an upload
    findButton(dialog, 'Cancel')?.click();
    overlay()?.click();
    await dialog.updateComplete;

    expect(cancelled).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
  });

  it('renders the done view with the share URL and copies it via the clipboard', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    dialog.state = 'done';
    dialog.songName = 'track.mp3';
    dialog.shareUrl = 'https://example.com/#123&song.mp3';
    await dialog.updateComplete;

    expect(title()).toContain('Upload complete');

    const songName = dialog.shadowRoot?.querySelector('.song-name');
    expect(songName?.textContent).toContain('track.mp3');

    const input = dialog.shadowRoot?.querySelector('.share-url-input') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    expect(input!.value).toBe('https://example.com/#123&song.mp3');
    expect(input!.readOnly).toBe(true);

    const copyButton = dialog.shadowRoot?.querySelector('.copy-url-button') as HTMLElement | null;
    expect(copyButton).toBeTruthy();
    copyButton!.click();

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://example.com/#123&song.mp3');
    });
  });

  it('shows "Song already uploaded" instead of "Upload complete" when alreadyUploaded is true', async () => {
    dialog.state = 'done';
    dialog.alreadyUploaded = true;
    await dialog.updateComplete;

    expect(title()).toContain('Song already uploaded');
    expect(title()).not.toContain('Upload complete');
  });

  it('emits dialog-cancelled when the overlay is clicked in confirm state', async () => {
    await dialog.updateComplete;

    const cancelled = vi.fn();
    dialog.addEventListener('dialog-cancelled', cancelled);

    overlay()!.click();
    await dialog.updateComplete;

    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(false);
  });
});