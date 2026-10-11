import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaItem } from './t-media.js';
import { TButt } from './t-butt.js';

/**
 * FEATURE SPEC (dropdown polish): status dropdown styling contract +
 * remove-from-group row inside the t-media status dropdown.
 *
 * - CSS contract (happy-dom does not resolve shadow styles reliably, so —
 *   same precedent as t-video-player.test.ts / t-group-list-manage-mode.test.ts
 *   — we assert against the actual component stylesheet text):
 *   - `.status-box` gets padding + gap via spacing CSS vars with fallbacks
 *     (e.g. var(--spacing-md, 12px) / var(--spacing-sm, 8px)) instead of the
 *     current bare `display: flex; flex-direction: column`.
 *   - `t-butt` inside `.status-box` gets `width: 100%` so the status buttons
 *     render stacked full-width instead of cramped in a row.
 *   - `.status-remove-row` is visually separated with padding-top and a
 *     border-top using var(--list-border-color, ...).
 * - Remove row: a SEPARATE ROW div (class="status-remove-row") inside
 *   `.status-box`, containing ONE `t-butt` with the `confirm` attribute,
 *   visible text "Remove from group" and a confirmText like "Remove from
 *   group?". First click only enters the t-butt confirm state (no event);
 *   second click dispatches CustomEvent 'song-remove-requested'
 *   (detail { songKey }, bubbles + composed) from t-media.
 * - Same render gate as the dropdown: showStatusButton && songKey &&
 *   !hideEditButton (the row lives inside the gated dropdown).
 *
 * These tests import the ACTUAL components (never re-implementations), so the
 * styling/remove-row tests FAIL (RED) until the feature exists.
 */

type MediaItemWithStatusButton = MediaItem & { showStatusButton: boolean };

function withStatusButton(el: MediaItem): MediaItemWithStatusButton {
  return el as MediaItemWithStatusButton;
}

function buttonText(btn: Element): string {
  return (btn.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The component stylesheet as text (repo precedent: cssText assertions). */
function mediaCssText(): string {
  return (MediaItem.styles as unknown as { cssText: string }).cssText;
}

/** Declaration bodies of every rule whose selector matches `selectorPattern`. */
function declarationBlocks(selectorPattern: RegExp): string[] {
  const rulePattern = new RegExp(selectorPattern.source + '[^{}]*\\{([^{}]*)\\}', 'g');
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(mediaCssText())) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

describe('t-media status dropdown CSS contract', () => {
  it('.status-box rule provides padding and gap via spacing CSS vars with fallbacks', () => {
    const styled = declarationBlocks(/\.status-box/).filter(
      (block) => /padding:/.test(block) && /gap:/.test(block)
    );
    expect(styled.length).toBeGreaterThan(0);
    expect(styled[0]).toMatch(/padding:[^;{}]*var\(--spacing/);
    expect(styled[0]).toMatch(/gap:[^;{}]*var\(--spacing/);
  });

  it('forces t-butt inside .status-box to width: 100% (stacked full-width status buttons)', () => {
    expect(mediaCssText()).toMatch(
      /\.status-box[^{}]*t-butt[^{}]*\{[^}]*width:\s*100%/
    );
  });

  it('.status-remove-row is visually separated with padding-top and a --list-border-color border-top', () => {
    const blocks = declarationBlocks(/\.status-remove-row/);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((block) => /padding-top:/.test(block))).toBe(true);
    expect(blocks.some((block) => /border-top:[^;]*var\(--list-border-color/.test(block))).toBe(
      true
    );
  });
});

describe('t-media remove-from-group row', () => {
  let el: MediaItem;

  beforeEach(async () => {
    el = new MediaItem();
    document.body.appendChild(el);
    el.songKey = 'my-song.mp3';
    withStatusButton(el).showStatusButton = true;
    await el.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
    vi.restoreAllMocks();
  });

  function removeRow(): HTMLElement | null {
    return (el.shadowRoot?.querySelector('.status-remove-row') ?? null) as HTMLElement | null;
  }

  function removeButton(): TButt | null {
    return (removeRow()?.querySelector('t-butt') ?? null) as TButt | null;
  }

  it('renders a separate .status-remove-row inside .status-box with one confirm t-butt labeled "Remove from group"', async () => {
    const box = el.shadowRoot?.querySelector('.status-box');
    expect(box).toBeTruthy();

    const row = removeRow();
    expect(row).toBeTruthy();
    expect(box?.contains(row as Node)).toBe(true);

    const buttons = Array.from(row?.querySelectorAll('t-butt') ?? []);
    expect(buttons).toHaveLength(1);

    const btn = buttons[0];
    expect(btn.hasAttribute('confirm')).toBe(true);
    expect(buttonText(btn)).toContain('Remove from group');

    const confirmText =
      (btn as Element & { confirmText?: string }).confirmText ?? btn.getAttribute('confirmText');
    expect(confirmText ?? '').toMatch(/remove from group/i);
  });

  it('first click only enters the t-butt confirm state; second click dispatches song-remove-requested {songKey} (bubbles + composed)', async () => {
    const btn = removeButton();
    expect(btn).toBeTruthy();
    await btn?.updateComplete;

    const innerButton = btn?.shadowRoot?.querySelector('button') as HTMLElement | null;
    expect(innerButton).toBeTruthy();

    const removeSpy = vi.fn();
    document.addEventListener('song-remove-requested', removeSpy);
    try {
      // First click — t-butt intercepts into its confirm state, no event.
      innerButton?.click();
      await btn?.updateComplete;
      expect(btn?.shadowRoot?.querySelector('.confirm-text')).toBeTruthy();
      expect(removeSpy).not.toHaveBeenCalled();

      // Second click — confirmed, the event is dispatched from t-media.
      innerButton?.click();
      await el.updateComplete;
      expect(removeSpy).toHaveBeenCalledTimes(1);

      const event = removeSpy.mock.calls[0][0] as CustomEvent<{ songKey: string }>;
      expect(event.type).toBe('song-remove-requested');
      expect(event.detail).toEqual({ songKey: 'my-song.mp3' });
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
      expect(event.target).toBe(el);
    } finally {
      document.removeEventListener('song-remove-requested', removeSpy);
    }
  });

  it('renders no remove row when showStatusButton is false', async () => {
    withStatusButton(el).showStatusButton = false;
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.status-box')).toBeNull();
    expect(removeRow()).toBeNull();
  });

  it('renders no remove row when hideEditButton is true', async () => {
    el.hideEditButton = true;
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.status-box')).toBeNull();
    expect(removeRow()).toBeNull();
  });

  it('renders no remove row when songKey is empty', async () => {
    el.songKey = '';
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.status-box')).toBeNull();
    expect(removeRow()).toBeNull();
  });
});
