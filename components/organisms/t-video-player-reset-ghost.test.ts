import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TVideoPlayer } from './t-video-player.js';
import type { TButt } from '../atom/t-butt.js';

/**
 * Requested change: `.reset-speed-btn` in `t-video-player.ts` must look like
 * the t-dial reset button but as ghost variant:
 * - `ghost` on the `<t-butt class="reset-speed-btn">`
 * - `<span class="reset-content">` wrapping
 *   `<t-icon class="reset-icon" name="reset">` + `<span class="reset-text">100%</span>`
 * - component CSS for `.reset-content` / `.reset-icon` / `.reset-text`
 *   implementing the stacked layout (icon behind scaled, text overlaid).
 * Contracts kept: `title="Reset speed"`, `video-btn` + `reset-speed-btn`
 * classes, lives inside `.speed-info`, only rendered when
 * `Math.round(speed) !== 100`, click sets speed 100 + dispatches speed-changed.
 */
describe('t-video-player reset-speed ghost + stacked pattern', () => {
  let element: TVideoPlayer;
  const freshElements: TVideoPlayer[] = [];

  beforeEach(() => {
    element = new TVideoPlayer();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    for (const el of freshElements) {
      if (document.body.contains(el)) {
        document.body.removeChild(el);
      }
    }
    freshElements.length = 0;
  });

  const createPlayerWithVideo = (): { el: TVideoPlayer; video: HTMLVideoElement } => {
    const el = new TVideoPlayer();
    const video = document.createElement('video');
    el.appendChild(video);
    document.body.appendChild(el);
    freshElements.push(el);
    return { el, video };
  };

  const getButton = (el: TVideoPlayer, selector: string): HTMLElement => {
    const button = el.shadowRoot?.querySelector(selector);
    if (!button) {
      throw new Error(`Expected shadow root to contain <${selector}>`);
    }
    return button as HTMLElement;
  };

  const ruleCssText = (el: TVideoPlayer, selector: string): string => {
    const sheet = el.shadowRoot?.adoptedStyleSheets?.[0];
    const rules = sheet?.cssRules;
    if (!rules) {
      throw new Error('Expected shadow root to expose adoptedStyleSheets[0].cssRules');
    }
    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i] as CSSStyleRule;
      if (rule.selectorText === selector) {
        return rule.style.cssText;
      }
    }
    throw new Error(`Expected component stylesheet to contain a ${selector} rule`);
  };

  it('reset button has ghost variant enabled (keeps title/classes/.speed-info parent)', async () => {
    const { el } = createPlayerWithVideo();
    el.speed = 120;
    await el.updateComplete;

    const button = getButton(el, '.reset-speed-btn');
    // Existing contracts that must keep working:
    expect(button.tagName.toLowerCase()).toBe('t-butt');
    expect(button.classList.contains('video-btn')).toBe(true);
    expect(button.classList.contains('reset-speed-btn')).toBe(true);
    expect(button.getAttribute('title')).toBe('Reset speed');
    expect(el.shadowRoot?.querySelector('.speed-info')?.contains(button)).toBe(true);

    // Requested change: ghost variant (transparent background inherits color).
    const butt = button as unknown as TButt;
    const hasGhost = button.hasAttribute('ghost') || butt.ghost === true;
    expect(hasGhost, '.reset-speed-btn must enable the ghost variant (hasAttribute ghost OR ghost property)').toBe(
      true
    );
  });

  it('reset button stacks icon behind text via .reset-content wrapper', async () => {
    const { el } = createPlayerWithVideo();
    el.speed = 120;
    await el.updateComplete;

    const button = getButton(el, '.reset-speed-btn');
    const content = button.querySelector('.reset-content');
    expect(content, '.reset-speed-btn must wrap contents in <span class="reset-content">').not.toBeNull();

    const icon = content?.querySelector('t-icon.reset-icon');
    expect(icon, '.reset-content must contain <t-icon class="reset-icon" name="reset">').not.toBeNull();
    expect(icon?.getAttribute('name')).toBe('reset');

    const text = content?.querySelector('.reset-text');
    expect(text, '.reset-content must contain <span class="reset-text">100%</span>').not.toBeNull();
    expect(text?.textContent).toBe('100%');

    // No inline styles — stacking must come from the component stylesheet.
    expect(content?.getAttribute('style')).toBeNull();
    expect(button.getAttribute('style')).toBeNull();
  });

  it('stylesheet implements the stacked reset layout (.reset-content/.reset-icon/.reset-text)', async () => {
    const { el } = createPlayerWithVideo();
    el.speed = 120;
    await el.updateComplete;

    // Throws when a rule is missing — same technique as the .marker-label
    // ellipsis test in t-video-player.test.ts.
    const contentCss = ruleCssText(el, '.reset-content');
    const iconCss = ruleCssText(el, '.reset-icon');
    const textCss = ruleCssText(el, '.reset-text');

    expect(contentCss, '.reset-content must establish the stacking context').toContain('position: relative');
    expect(iconCss, '.reset-icon must sit behind the text').toContain('position: absolute');
    expect(iconCss, '.reset-icon must be scaled up behind the text').toContain('scale');
    expect(textCss, '.reset-text must overlay the icon').toContain('position: relative');
    expect(textCss, '.reset-text must be pushed down over the icon').toContain('margin-top');
  });
});
