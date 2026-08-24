import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DetailsElement } from './t-details.js';

describe('t-details', () => {
  let element: DetailsElement;

  beforeEach(() => {
    element = new DetailsElement();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('is open=false by default and does not reflect an open attribute on the host', async () => {
    await element.updateComplete;

    expect(element.open).toBe(false);
    expect(element.hasAttribute('open')).toBe(false);
  });

  it('renders an inner native <details> element', async () => {
    await element.updateComplete;

    // An inner, native details element (not reimplemented logic) exists in the shadow DOM.
    const details = element.shadowRoot?.querySelector('details');
    expect(details).toBeInstanceOf(HTMLDetailsElement);
  });

  it('renders the inner <details> closed by default (no open attribute)', async () => {
    await element.updateComplete;

    const details = element.shadowRoot?.querySelector('details');
    expect(details?.hasAttribute('open')).toBe(false);
  });

  it('open=true reflects to the host attribute and opens the inner <details>', async () => {
    await element.updateComplete;

    element.open = true;
    await element.updateComplete;

    expect(element.hasAttribute('open')).toBe(true);

    const details = element.shadowRoot?.querySelector('details');
    expect(details?.hasAttribute('open')).toBe(true);
  });

  it('clicking the summary opens the panel (property, host attribute and inner <details>)', async () => {
    await element.updateComplete;

    // happy-dom 20.9.0 implements the native <details> toggle behaviour: a click
    // bubbling through the inner details toggles its open attribute, so this is a
    // real user interaction all the way through.
    const summary = element.shadowRoot?.querySelector('summary') as HTMLElement;
    expect(summary).toBeTruthy();

    summary.click();
    await element.updateComplete;

    expect(element.open).toBe(true);
    expect(element.hasAttribute('open')).toBe(true);

    const details = element.shadowRoot?.querySelector('details');
    expect(details?.hasAttribute('open')).toBe(true);
  });

  it('clicking the summary twice closes the panel again', async () => {
    await element.updateComplete;

    const summary = element.shadowRoot?.querySelector('summary') as HTMLElement;

    summary.click();
    await element.updateComplete;
    expect(element.open).toBe(true);

    summary.click();
    await element.updateComplete;

    expect(element.open).toBe(false);
    expect(element.hasAttribute('open')).toBe(false);

    const details = element.shadowRoot?.querySelector('details');
    expect(details?.hasAttribute('open')).toBe(false);
  });

  it('dispatches details-toggled with detail.open=true when the panel is opened', async () => {
    // Listener added before the opening click.
    const toggleSpy = vi.fn();
    element.addEventListener('details-toggled', toggleSpy);

    await element.updateComplete;

    const summary = element.shadowRoot?.querySelector('summary') as HTMLElement;
    summary.click();
    await element.updateComplete;

    expect(toggleSpy).toHaveBeenCalledTimes(1);
    const event = toggleSpy.mock.calls[0][0] as CustomEvent<{ open: boolean }>;
    expect(event.detail.open).toBe(true);
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('dispatches details-toggled with detail.open=false when the panel is closed', async () => {
    await element.updateComplete;

    const summary = element.shadowRoot?.querySelector('summary') as HTMLElement;

    // Open first, then listen for the closing toggle.
    summary.click();
    await element.updateComplete;
    expect(element.open).toBe(true);

    const toggleSpy = vi.fn();
    element.addEventListener('details-toggled', toggleSpy);

    summary.click();
    await element.updateComplete;

    expect(toggleSpy).toHaveBeenCalledTimes(1);
    const event = toggleSpy.mock.calls[0][0] as CustomEvent<{ open: boolean }>;
    expect(event.detail.open).toBe(false);
  });

  it('renders the title property inside p.advanced-summary-title', async () => {
    await element.updateComplete;

    element.title = 'Advanced';
    await element.updateComplete;

    const title = element.shadowRoot?.querySelector('p.advanced-summary-title');
    expect(title).toBeTruthy();
    expect(title?.textContent).toBe('Advanced');
  });

  it('renders the text property inside p.advanced-summary-text', async () => {
    await element.updateComplete;

    element.text = 'Marker actions and states!';
    await element.updateComplete;

    const text = element.shadowRoot?.querySelector('p.advanced-summary-text');
    expect(text).toBeTruthy();
    expect(text?.textContent).toBe('Marker actions and states!');
  });

  it('does not render p.advanced-summary-text when text is empty (the default)', async () => {
    await element.updateComplete;

    expect(element.text).toBe('');
    expect(element.shadowRoot?.querySelector('p.advanced-summary-text')).toBeNull();
  });

  it('renders the chevron t-icon with name="chevron-down" and class advanced-chevron inside the summary', async () => {
    await element.updateComplete;

    const chevron = element.shadowRoot?.querySelector('summary t-icon.advanced-chevron');
    expect(chevron).toBeTruthy();
    expect(chevron?.getAttribute('name')).toBe('chevron-down');
    expect(chevron?.classList.contains('advanced-chevron')).toBe(true);
  });

  it('renders default-slot content inside .advanced-content', async () => {
    const content = document.createElement('div');
    content.className = 'test-content';
    content.textContent = 'Hello';
    element.appendChild(content);
    await element.updateComplete;

    const contentDiv = element.shadowRoot?.querySelector('.advanced-content');
    expect(contentDiv).toBeTruthy();

    const slot = contentDiv?.querySelector('slot');
    expect(slot).toBeTruthy();
    expect(slot?.assignedNodes()).toContain(content);
  });

  it('renders the badge slot inside the summary', async () => {
    const badge = document.createElement('span');
    badge.slot = 'badge';
    badge.className = 'scope-badge';
    badge.textContent = 'App-wide';
    element.appendChild(badge);
    await element.updateComplete;

    const summary = element.shadowRoot?.querySelector('summary');
    expect(summary).toBeTruthy();

    const badgeSlot = summary?.querySelector('slot[name="badge"]') as HTMLSlotElement | null;
    expect(badgeSlot).toBeTruthy();
    expect(badgeSlot?.assignedNodes()).toContain(badge);
  });
});
