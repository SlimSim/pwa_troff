import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
