import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Marker } from './t-marker.js';
import { Popover } from '../atom/t-popover.js';

describe('t-marker', () => {
  let element: Marker;

  beforeEach(() => {
    element = new Marker();
    element.marker = {
      id: 'm1',
      name: 'Intro',
      label: 'Intro',
      value: 12.5,
    };
    document.body.appendChild(element);
  });

  afterEach(() => {
    // The boundary test moves the marker inside a .presets-container wrapper.
    const parent = element.parentElement;
    if (parent && parent !== document.body) {
      parent.remove();
    } else if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('renders basic marker row correctly', async () => {
    await element.updateComplete;
    const nameBtn = element.shadowRoot?.querySelector('.marker-name-button');
    expect(nameBtn?.textContent?.trim()).toBe('Intro');

    const infoBtn = element.shadowRoot?.querySelector('.info-button');
    expect(infoBtn).toBeNull();
  });

  it('renders info button with ghost attribute when marker.info is present', async () => {
    element.marker = {
      id: 'm1',
      name: 'Chorus',
      label: 'Chorus',
      value: 45,
      info: 'Key change happens at count 4',
    };
    await element.updateComplete;

    const infoBtn = element.shadowRoot?.querySelector('.info-button');
    expect(infoBtn).not.toBeNull();
    expect(infoBtn?.hasAttribute('ghost')).toBe(true);
  });

  it('opens info popover and dispatches marker-info-click event when info button is clicked', async () => {
    element.marker = {
      id: 'm1',
      name: 'Bridge',
      label: 'Bridge',
      value: 80,
      info: 'Slower tempo here',
    };
    await element.updateComplete;

    const infoClickSpy = vi.fn();
    element.addEventListener('marker-info-click', infoClickSpy);

    // The info button is a <t-butt slot="trigger"> slotted into <t-popover>.
    const infoBtn = element.shadowRoot?.querySelector('.info-button') as HTMLElement;
    expect(infoBtn).not.toBeNull();

    // happy-dom does not include <slot> nodes in composedPath, so a click on
    // the slotted light-DOM button never reaches the popover's trigger
    // listener. Drive the popover's .trigger-wrapper instead — the exact
    // element a user click on the info button would bubble through.
    const popover = element.shadowRoot?.querySelector(
      't-popover'
    ) as Popover;
    expect(popover).not.toBeNull();
    const triggerWrapper = popover.shadowRoot?.querySelector(
      '.trigger-wrapper'
    ) as HTMLElement;
    expect(triggerWrapper).not.toBeNull();
    triggerWrapper.click();

    await popover.updateComplete;
    await element.updateComplete;

    expect(infoClickSpy).toHaveBeenCalledTimes(1);
    expect(infoClickSpy.mock.calls[0][0].detail.marker.info).toBe('Slower tempo here');
    expect(popover.open).toBe(true);

    // The info text is now passed as the popover's `body` property — the old
    // default <slot> body cannot feed a popup rendered in a portal on
    // document.body, so there is no slot to inspect anymore.
    expect(popover.body).toBe('Slower tempo here');
    expect(
      popover.popupElement?.querySelector('.popup-body')?.textContent?.trim()
    ).toBe('Slower tempo here');
  });

  it('closes info popover when the popover close button is clicked', async () => {
    element.marker = {
      id: 'm1',
      name: 'Outro',
      label: 'Outro',
      value: 120,
      info: 'Fade out',
    };
    await element.updateComplete;

    const infoBtn = element.shadowRoot?.querySelector('.info-button') as HTMLElement;
    expect(infoBtn).not.toBeNull();

    const popover = element.shadowRoot?.querySelector(
      't-popover'
    ) as Popover;
    expect(popover).not.toBeNull();

    // Open via the trigger wrapper (see note in the opening test about
    // happy-dom skipping <slot> in composedPath).
    const triggerWrapper = popover.shadowRoot?.querySelector(
      '.trigger-wrapper'
    ) as HTMLElement;
    expect(triggerWrapper).not.toBeNull();
    triggerWrapper.click();
    await popover.updateComplete;
    expect(popover.open).toBe(true);

    // The close button lives inside the PORTALED popup, not the component's
    // shadow root.
    const closeBtn = popover.popupElement?.querySelector(
      '.popup-header t-butt'
    ) as HTMLElement | null;
    expect(closeBtn).not.toBeNull();
    closeBtn?.click();
    await popover.updateComplete;

    expect(popover.open).toBe(false);

    // The portaled popup is removed from document.body on close.
    expect(popover.popupElement).toBeNull();
  });

  it('sets t-popover boundary to the nearest .presets-container ancestor', async () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'presets-container';
    document.body.appendChild(wrapper);
    wrapper.appendChild(element);

    element.marker = {
      id: 'm1',
      name: 'Bridge',
      label: 'Bridge',
      value: 80,
      info: 'Slower tempo here',
    };
    await element.updateComplete;

    const popover = element.shadowRoot?.querySelector(
      't-popover'
    ) as Popover;
    expect(popover).not.toBeNull();
    expect(popover.boundary).toBe(wrapper);
  });

  it('leaves t-popover boundary null when not inside a .presets-container', async () => {
    element.marker = {
      id: 'm1',
      name: 'Bridge',
      label: 'Bridge',
      value: 80,
      info: 'Slower tempo here',
    };
    await element.updateComplete;

    const popover = element.shadowRoot?.querySelector(
      't-popover'
    ) as Popover;
    expect(popover).not.toBeNull();
    expect(popover.boundary).toBeNull();
  });

  it('info popover prefers right positioning', async () => {
    element.marker = {
      id: 'm1',
      name: 'Intro',
      label: 'Intro',
      value: 12.5,
      info: 'First section',
    };
    await element.updateComplete;

    const popover = element.shadowRoot?.querySelector(
      't-popover'
    ) as Popover;
    expect(popover).not.toBeNull();
    expect(popover.preferPosition).toBe('right');
    expect(popover.hasAttribute('prefer-position')).toBe(true);
  });

  it('host is click-through so an overlapping marker cannot swallow clicks', async () => {
    await element.updateComplete;

    // NEW fix: `:host { pointer-events: none; }` makes the marker's full-width
    // host row transparent to clicks, so a later overlapping marker can no
    // longer block the earlier marker's buttons.
    expect(getComputedStyle(element).pointerEvents).toBe('none');
  });

  it('keeps edit, name and stop buttons clickable (pointer-events: auto)', async () => {
    await element.updateComplete;

    // The first t-butt inside .marker-row is the edit button.
    const editBtn = element.shadowRoot?.querySelector(
      '.marker-row > t-butt'
    ) as HTMLElement | null;
    const nameBtn = element.shadowRoot?.querySelector(
      '.marker-name-button'
    ) as HTMLElement | null;
    const stopBtn = element.shadowRoot?.querySelector(
      '.stop-button'
    ) as HTMLElement | null;

    expect(editBtn).not.toBeNull();
    expect(nameBtn).not.toBeNull();
    expect(stopBtn).not.toBeNull();

    // NEW fix: `t-butt { pointer-events: auto; }` keeps every button clickable
    // even though the host row itself is click-through.
    expect(getComputedStyle(editBtn as HTMLElement).pointerEvents).toBe('auto');
    expect(getComputedStyle(nameBtn as HTMLElement).pointerEvents).toBe('auto');
    expect(getComputedStyle(stopBtn as HTMLElement).pointerEvents).toBe('auto');
  });

  it('keeps the slotted info button clickable (pointer-events: auto)', async () => {
    element.marker = {
      id: 'm1',
      name: 'Intro',
      label: 'Intro',
      value: 12.5,
      info: 'some text',
    };
    await element.updateComplete;

    const infoBtn = element.shadowRoot?.querySelector(
      '.info-button'
    ) as HTMLElement | null;
    expect(infoBtn).not.toBeNull();

    // The info button must stay clickable despite the click-through host.
    expect(getComputedStyle(infoBtn as HTMLElement).pointerEvents).toBe('auto');
  });
});
