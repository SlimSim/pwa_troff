import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MainLayout } from './t-main-layout.js';

/**
 * Feature spec #32: t-main-layout must render two new slots for the video player:
 *  - `<slot name="video-top"></slot>` as the FIRST child inside
 *    `<div class="app-body">`, BEFORE `<div class="main-content-parent">`.
 *  - `<slot name="video-sidebar"></slot>` as the FIRST child inside
 *    `<aside class="sidebar">`, BEFORE `<slot name="sidebar">`.
 *
 * The `.app-body` wrapper is the positioned container for the `song-list`
 * overlay: it spans the video-top slot AND the main content, so the songlist
 * dropdown covers both instead of being pushed below the video.
 */
describe('t-main-layout video player slots', () => {
  let element: MainLayout;

  beforeEach(() => {
    element = new MainLayout();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('renders a <slot name="video-top"> after the header slot and before .main-content-parent', async () => {
    await element.updateComplete;
    const root = element.shadowRoot;
    expect(root).not.toBeNull();

    const headerSlot = root?.querySelector('slot[name="header"]');
    const appBody = root?.querySelector('.app-body');
    const footerSlot = root?.querySelector('slot[name="footer"]');

    expect(headerSlot).not.toBeNull();
    expect(appBody).not.toBeNull();
    expect(footerSlot).not.toBeNull();

    // .app-body must be a direct child of the shadow root, positioned
    // between the header slot and the footer slot.
    const children = Array.from(root?.children ?? []);
    const headerIndex = children.indexOf(headerSlot as Element);
    const appBodyIndex = children.indexOf(appBody as Element);
    const footerIndex = children.indexOf(footerSlot as Element);

    expect(appBodyIndex).toBeGreaterThan(headerIndex);
    expect(appBodyIndex).toBeLessThan(footerIndex);

    // Inside .app-body, the video-top slot comes before .main-content-parent.
    const videoTopSlot = appBody?.querySelector('slot[name="video-top"]');
    const mainContentParent = appBody?.querySelector('.main-content-parent');

    expect(videoTopSlot).not.toBeNull();
    expect(mainContentParent).not.toBeNull();

    const appBodyChildren = Array.from(appBody?.children ?? []);
    expect(appBodyChildren.indexOf(videoTopSlot as Element)).toBeLessThan(
      appBodyChildren.indexOf(mainContentParent as Element)
    );
  });

  it('renders the song-list slot inside .app-body (after .main-content-parent) so it overlays the video', async () => {
    await element.updateComplete;
    const root = element.shadowRoot;
    expect(root).not.toBeNull();

    const appBody = root?.querySelector('.app-body');
    expect(appBody).not.toBeNull();

    const songListSlot = root?.querySelector('slot[name="song-list"]');
    expect(songListSlot).not.toBeNull();

    // The song-list overlay must share the positioned .app-body container
    // with the video, so it is a descendant of .app-body but NOT of
    // .main-content-parent.
    expect(appBody?.contains(songListSlot as Element)).toBe(true);

    const mainContentParent = appBody?.querySelector('.main-content-parent');
    expect(mainContentParent).not.toBeNull();
    expect(mainContentParent?.contains(songListSlot as Element)).toBe(false);

    // Inside .app-body it must come AFTER .main-content-parent so the
    // absolutely-positioned dropdown is painted above the video/content.
    const appBodyChildren = Array.from(appBody?.children ?? []);
    expect(appBodyChildren.indexOf(songListSlot as Element)).toBeGreaterThan(
      appBodyChildren.indexOf(mainContentParent as Element)
    );
  });

  it('renders a <slot name="video-sidebar"> inside aside.sidebar before <slot name="sidebar">', async () => {
    await element.updateComplete;
    const root = element.shadowRoot;
    const sidebar = root?.querySelector('aside.sidebar');
    expect(sidebar).not.toBeNull();

    const videoSidebarSlot = sidebar?.querySelector('slot[name="video-sidebar"]');
    const sidebarSlot = sidebar?.querySelector('slot[name="sidebar"]');

    expect(videoSidebarSlot).not.toBeNull();
    expect(sidebarSlot).not.toBeNull();

    const children = Array.from(sidebar?.children ?? []);
    expect(children.indexOf(videoSidebarSlot as Element)).toBeLessThan(
      children.indexOf(sidebarSlot as Element)
    );
  });
});
