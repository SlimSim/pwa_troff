import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TButt } from './t-butt.js';
import { MediaItem } from './t-media.js';

/**
 * FEATURE SPEC — t-butt fill + confirm bypass fix (tests only, must FAIL on current code).
 *
 * Bug 1 (host-click bypass): clicking the <t-butt> host outside the inner
 * <button> currently bubbles to the parent @click handler and dispatches
 * `song-remove-requested` instantly WITHOUT entering t-butt confirm state.
 * Required: with `confirm=true`, a click targeting the host (not the inner
 * button) must enter confirming state (show .confirm-text) and must NOT let
 * the parent handler fire on first click; second click fires.
 *
 * Bug 2 (fill): inner `.base` button must fill the entire <t-butt> host width
 * (width 100%, box-sizing border-box or equivalent). Asserted via the
 * component stylesheet text (same precedent as t-media-status-remove.test.ts
 * cssText assertions — happy-dom does not resolve shadow styles reliably).
 */

function tButtCssText(): string {
  return (TButt.styles as unknown as { cssText: string }).cssText;
}

/** Declaration bodies of rules whose selector list contains EXACTLY `.base` (bare, no modifiers). */
function bareBaseBlocks(): string[] {
  const cssText = tButtCssText().replace(/\/\*[\s\S]*?\*\//g, '');
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cssText)) !== null) {
    const selectors = match[1].split(',').map((s) => s.trim());
    if (selectors.includes('.base')) {
      blocks.push(match[2]);
    }
  }
  return blocks;
}

/** Dispatch a click whose target is the <t-butt> host itself (not the inner button). */
function clickHost(host: HTMLElement): void {
  host.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
  );
}

describe('t-butt fill: inner .base fills host width', () => {
  it('bare `.base` rule sets width: 100% (not only `.base.full-width`) with border-box sizing', () => {
    const blocks = bareBaseBlocks();
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((block) => /width:\s*100%/.test(block))).toBe(true);
    expect(blocks.some((block) => /box-sizing:\s*border-box/.test(block))).toBe(true);
  });
});

describe('t-butt host-click confirm bypass', () => {
  let element: TButt;

  beforeEach(async () => {
    element = new TButt();
    document.body.appendChild(element);
    element.confirm = true;
    await element.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('first click targeting the host (not inner button) does NOT call parent handler and shows .confirm-text', async () => {
    const clickSpy = vi.fn();
    element.addEventListener('click', clickSpy);

    // Target is the host itself — simulates clicking host padding/empty area.
    clickHost(element);
    await element.updateComplete;

    expect(clickSpy).not.toHaveBeenCalled();
    expect(element.shadowRoot?.querySelector('.confirm-text')).toBeTruthy();
  });

  it('second host click DOES call the parent handler exactly once', async () => {
    const clickSpy = vi.fn();
    element.addEventListener('click', clickSpy);

    clickHost(element);
    await element.updateComplete;
    clickHost(element);
    await element.updateComplete;

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

type MediaItemWithStatusButton = MediaItem & { showStatusButton: boolean };

describe('t-media remove-row host-click confirm bypass (integration)', () => {
  let el: MediaItem;

  beforeEach(async () => {
    el = new MediaItem();
    document.body.appendChild(el);
    el.songKey = 'my-song.mp3';
    (el as MediaItemWithStatusButton).showStatusButton = true;
    await el.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
    vi.restoreAllMocks();
  });

  it('clicking the remove-row t-butt host (not inner button) enters confirm first; second click dispatches song-remove-requested once', async () => {
    const btn = el.shadowRoot?.querySelector('.status-remove-row t-butt') as TButt | null;
    expect(btn).toBeTruthy();
    await btn?.updateComplete;

    const removeSpy = vi.fn();
    document.addEventListener('song-remove-requested', removeSpy);
    try {
      // First click targets the <t-butt> host itself — must NOT dispatch.
      clickHost(btn as HTMLElement);
      await (btn as TButt).updateComplete;

      expect(removeSpy).not.toHaveBeenCalled();
      expect(btn?.shadowRoot?.querySelector('.confirm-text')).toBeTruthy();

      // Second click — confirmed, dispatches once with detail {songKey}.
      clickHost(btn as HTMLElement);
      await el.updateComplete;

      expect(removeSpy).toHaveBeenCalledTimes(1);
      const event = removeSpy.mock.calls[0][0] as CustomEvent<{ songKey: string }>;
      expect(event.type).toBe('song-remove-requested');
      expect(event.detail).toEqual({ songKey: 'my-song.mp3' });
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    } finally {
      document.removeEventListener('song-remove-requested', removeSpy);
    }
  });
});
