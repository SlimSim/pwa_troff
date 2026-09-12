import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TVideoPlayer } from './t-video-player.js';

/**
 * Requested reorder: reset button moves to the LEFT of `t-icon[name=speed]`
 * inside `div.speed-info`, so DOM order when reset is visible is:
 *   1. t-butt.reset-speed-btn (ghost + reset-content + reset-icon + reset-text 100%)
 *   2. t-icon[name=speed]
 *   3. span.speed-text
 * When speed is default (100) no reset button renders; order stays icon then
 * speed-text. All existing contracts preserved (ghost variant, stacked
 * pattern, title="Reset speed", classes, conditional Math.round(speed)!==100,
 * click sets 100 + dispatches speed-changed, controls-hidden handling).
 */
describe('t-video-player speed-info cluster order', () => {
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

  it('reset button precedes speed icon which precedes speed-text when reset is visible', async () => {
    const { el } = createPlayerWithVideo();
    el.speed = 120;
    await el.updateComplete;

    const speedInfo = el.shadowRoot?.querySelector('.speed-info');
    expect(speedInfo, '.speed-info must render').not.toBeNull();

    const resetBtn = speedInfo?.querySelector('.reset-speed-btn');
    const icon = speedInfo?.querySelector('t-icon[name="speed"]');
    const text = speedInfo?.querySelector('.speed-text');
    expect(resetBtn, '.reset-speed-btn must render when speed !== 100').not.toBeNull();
    expect(icon, 't-icon[name=speed] must render').not.toBeNull();
    expect(text, '.speed-text must render').not.toBeNull();

    // DOM-order assertion via compareDocumentPosition: reset precedes icon precedes text.
    expect(
      // eslint-disable-next-line no-bitwise
      (resetBtn as HTMLElement).compareDocumentPosition(icon as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      'reset button must precede the speed icon in DOM order'
    ).toBeTruthy();
    expect(
      // eslint-disable-next-line no-bitwise
      (icon as HTMLElement).compareDocumentPosition(text as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
      'speed icon must precede the speed-text in DOM order'
    ).toBeTruthy();

    // Mirror assertion via children index (element order among .speed-info children).
    const order = Array.from((speedInfo as Element).children);
    expect(order.indexOf(resetBtn as Element)).toBeLessThan(order.indexOf(icon as Element));
    expect(order.indexOf(icon as Element)).toBeLessThan(order.indexOf(text as Element));
  });

  it('default speed renders icon then speed-text with no reset button (unchanged)', async () => {
    const { el } = createPlayerWithVideo();
    el.speed = 100;
    await el.updateComplete;

    const speedInfo = el.shadowRoot?.querySelector('.speed-info');
    expect(speedInfo, '.speed-info must render').not.toBeNull();
    expect(speedInfo?.querySelector('.reset-speed-btn')).toBeNull();

    const icon = speedInfo?.querySelector('t-icon[name="speed"]');
    const text = speedInfo?.querySelector('.speed-text');
    expect(icon).not.toBeNull();
    expect(text).not.toBeNull();
    expect(
      // eslint-disable-next-line no-bitwise
      (icon as HTMLElement).compareDocumentPosition(text as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
      'at default speed the icon must still precede the speed-text'
    ).toBeTruthy();
  });
});
