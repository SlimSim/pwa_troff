import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MainLayout } from './t-main-layout.js';

/**
 * Feature spec #32: t-main-layout must render two new slots for the video player:
 *  - `<slot name="video-top"></slot>` immediately AFTER `<slot name="header">`
 *    and BEFORE `<div class="main-content-parent">`.
 *  - `<slot name="video-sidebar"></slot>` as the FIRST child inside
 *    `<aside class="sidebar">`, BEFORE `<slot name="sidebar">`.
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
    const videoTopSlot = root?.querySelector('slot[name="video-top"]');
    const mainContentParent = root?.querySelector('.main-content-parent');

    expect(videoTopSlot).not.toBeNull();
    expect(headerSlot).not.toBeNull();
    expect(mainContentParent).not.toBeNull();

    const children = Array.from(root?.children ?? []);
    const headerIndex = children.indexOf(headerSlot as Element);
    const videoTopIndex = children.indexOf(videoTopSlot as Element);
    const mainContentIndex = children.indexOf(mainContentParent as Element);

    expect(videoTopIndex).toBeGreaterThan(headerIndex);
    expect(videoTopIndex).toBeLessThan(mainContentIndex);
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
