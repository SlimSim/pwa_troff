import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MediaItem } from './t-media.js';

/**
 * FEATURE SPEC (remove per-row status visuals from t-media):
 *
 * Songs in a group are now displayed in status SECTIONS via t-group-list, so
 * per-row status accents are redundant. These tests pin the ABSENCE of:
 *
 * 1. The `<span class="status-dot">` element in the t-media template.
 * 2. ALL status-dot CSS + the four `.media-container.status-{...}` accent
 *    rules (border-left accents) + the `.media-container` base border-left.
 * 3. `border-left-color` on `.media-container.highlighted` (dead once the
 *    base border-left is gone; highlighted keeps background + shadow).
 * 4. `border-color 0.2s ease` from the `.media-container` transition list
 *    (only existed to animate the removed border colors).
 * 5. The `getGroupSongStatusAccentClass` export in
 *    `utils/group-song-status-ui.ts` and its use in the container class
 *    string (no status-* class is appended to .media-container).
 *
 * KEEP (not tested for removal): the `status` PROPERTY on t-media, the
 * `.status-box`/`.status-remove-row` dropdown, t-group-list sections.
 *
 * These tests import the ACTUAL component/module (never re-implementations)
 * and FAIL (RED) until the coder removes the feature.
 */

const ACCENT_CLASSES = [
  'status-prio',
  'status-active',
  'status-standard',
  'status-archived',
] as const;

/** cssText of the component's static styles (Lit CSSResult). */
function mediaStylesCssText(): string {
  return (MediaItem.styles as unknown as { cssText: string }).cssText;
}

describe('t-media status accent removal', () => {
  let el: MediaItem;

  beforeEach(async () => {
    el = new MediaItem();
    document.body.appendChild(el);
    el.songKey = 'my-song.mp3';
    el.status = 'prio';
    await el.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
  });

  it('renders no .status-dot element in the shadow root', () => {
    // RED today: the template contains `<span class="status-dot" aria-hidden="true">`.
    const dot = el.shadowRoot?.querySelector('.status-dot') ?? null;
    expect(dot, '.status-dot must be removed from the t-media template').toBeNull();
  });

  it.each(['prio', 'active', 'standard', 'archived'] as const)(
    'applies no status-* accent class to .media-container for status "%s"',
    async (status) => {
      el.status = status;
      await el.updateComplete;

      const container = el.shadowRoot?.querySelector('.media-container');
      expect(container, '.media-container must still render').toBeTruthy();

      const className = container?.className ?? '';
      const tokens = className.split(/\s+/);
      for (const accent of ACCENT_CLASSES) {
        expect(
          tokens,
          `.media-container className "${className}" must not contain ${accent}`
        ).not.toContain(accent);
      }
    }
  );

  describe('static styles', () => {
    it('contains no status-dot or status accent rules', () => {
      const cssText = mediaStylesCssText();

      // RED today: .status-dot, .media-container.status-{...} and
      // .media-container.status-{...} .status-dot rules all exist.
      for (const forbidden of [
        'status-dot',
        '.status-prio',
        '.status-active',
        '.status-standard',
        '.status-archived',
      ]) {
        expect(
          cssText.includes(forbidden),
          `static styles must not contain "${forbidden}"`
        ).toBe(false);
      }
    });

    it('contains no border-left declarations', () => {
      const cssText = mediaStylesCssText();

      // RED today: base `border-left: 4px solid transparent`, the four
      // accent `border-left: 3px solid …` rules, and highlighted
      // `border-left-color: …` all exist.
      expect(
        cssText.includes('border-left'),
        'static styles must not contain any border-left declaration'
      ).toBe(false);
    });

    it('transition no longer lists border-color', () => {
      const cssText = mediaStylesCssText();

      // RED today: `.media-container` transition includes `border-color 0.2s ease`.
      expect(
        cssText.includes('border-color 0.2s ease'),
        '.media-container transition must not list border-color 0.2s ease'
      ).toBe(false);
    });
  });

  it('no longer exports getGroupSongStatusAccentClass from utils/group-song-status-ui', async () => {
    const mod = (await import('../../utils/group-song-status-ui.js')) as {
      getGroupSongStatusAccentClass?: unknown;
    };

    // RED today: the function is exported.
    expect(
      mod.getGroupSongStatusAccentClass,
      'getGroupSongStatusAccentClass must be removed from utils/group-song-status-ui.js'
    ).toBeUndefined();
  });
});
