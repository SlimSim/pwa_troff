import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TVideoPlayer } from './t-video-player.js';

/**
 * Feature spec #32: `t-video-player` is a dumb frame that hosts a slotted
 * <video> element. Its shadow DOM is `<div class="video-frame"><slot></slot></div>`
 * with `:host([hidden]) { display: none; }` so the video player can be shown /
 * hidden by toggling the `hidden` attribute.
 */
describe('t-video-player', () => {
  let element: TVideoPlayer;

  beforeEach(() => {
    element = new TVideoPlayer();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('renders a shadow root containing a .video-frame with a slot element', async () => {
    await element.updateComplete;
    expect(element.shadowRoot).not.toBeNull();
    const frame = element.shadowRoot?.querySelector('.video-frame');
    expect(frame).not.toBeNull();
    expect(frame?.querySelector('slot')).not.toBeNull();
  });

  it('projects a <video> element placed in light DOM into the slot', async () => {
    const video = document.createElement('video');
    element.appendChild(video);
    await element.updateComplete;

    const slot = element.shadowRoot?.querySelector('slot') as HTMLSlotElement | null;
    expect(slot).not.toBeNull();
    expect(Array.from(slot?.assignedNodes() ?? [])).toContain(video);
  });

  it('reflects the hidden property to the host attribute (pairs with :host([hidden]))', async () => {
    element.hidden = true;
    await element.updateComplete;
    expect(element.hasAttribute('hidden')).toBe(true);

    element.hidden = false;
    await element.updateComplete;
    expect(element.hasAttribute('hidden')).toBe(false);
  });
});
