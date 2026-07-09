import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { THelpTip } from './t-help-tip.js';

describe('t-help-tip', () => {
  let element: THelpTip;

  beforeEach(() => {
    element = new THelpTip();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('renders a trigger button with "?" text', async () => {
    await element.updateComplete;
    const trigger = element.shadowRoot?.querySelector('.trigger') as HTMLElement;
    expect(trigger).toBeTruthy();
    expect(trigger?.textContent?.trim()).toBe('?');
  });

  it('popover is hidden by default', async () => {
    await element.updateComplete;
    const popover = element.shadowRoot?.querySelector('.popover') as HTMLElement;
    expect(popover?.hasAttribute('hidden')).toBe(true);
  });

  it('clicking trigger shows the popover', async () => {
    await element.updateComplete;
    const trigger = element.shadowRoot?.querySelector('.trigger') as HTMLElement;
    trigger.click();
    await element.updateComplete;

    const popover = element.shadowRoot?.querySelector('.popover') as HTMLElement;
    expect(popover?.hasAttribute('hidden')).toBe(false);
  });

  it('clicking trigger again hides the popover', async () => {
    await element.updateComplete;
    const trigger = element.shadowRoot?.querySelector('.trigger') as HTMLElement;

    // Open
    trigger.click();
    await element.updateComplete;

    // Close
    trigger.click();
    await element.updateComplete;

    const popover = element.shadowRoot?.querySelector('.popover') as HTMLElement;
    expect(popover?.hasAttribute('hidden')).toBe(true);
  });

  it('clicking the backdrop closes the popover', async () => {
    await element.updateComplete;
    const trigger = element.shadowRoot?.querySelector('.trigger') as HTMLElement;

    // Open
    trigger.click();
    await element.updateComplete;

    const backdrop = element.shadowRoot?.querySelector('.backdrop') as HTMLElement;
    expect(backdrop).toBeTruthy();

    backdrop.click();
    await element.updateComplete;

    const popover = element.shadowRoot?.querySelector('.popover') as HTMLElement;
    expect(popover?.hasAttribute('hidden')).toBe(true);
  });

  it('displays text content via property', async () => {
    element.text = 'Helpful information here.';
    await element.updateComplete;

    const trigger = element.shadowRoot?.querySelector('.trigger') as HTMLElement;
    trigger.click();
    await element.updateComplete;

    // The slot fallback shows the text when no slotted content
    // We check the popover content directly
    const popover = element.shadowRoot?.querySelector('.popover') as HTMLElement;
    expect(popover?.textContent?.trim()).toContain('Helpful information here.');
  });

  it('sets aria-expanded on trigger', async () => {
    await element.updateComplete;
    const trigger = element.shadowRoot?.querySelector('.trigger') as HTMLElement;

    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    trigger.click();
    await element.updateComplete;
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
  });

  it('Escape key closes the popover', async () => {
    await element.updateComplete;
    const trigger = element.shadowRoot?.querySelector('.trigger') as HTMLElement;

    // Open
    trigger.click();
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('.popover')?.hasAttribute('hidden')).toBe(false);

    // Dispatch escape on the trigger
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('.popover')?.hasAttribute('hidden')).toBe(true);
  });

  it('accepts custom placement attribute via property', () => {
    element.placement = 'top';
    expect(element.placement).toBe('top');
  });

  it('placement property defaults to bottom', () => {
    expect(element.placement).toBe('bottom');
  });

  it('popover is positioned with inline style on open', async () => {
    await element.updateComplete;
    const trigger = element.shadowRoot?.querySelector('.trigger') as HTMLElement;
    trigger.click();
    await element.updateComplete;

    const popover = element.shadowRoot?.querySelector('.popover') as HTMLElement;
    const style = popover?.getAttribute('style') || '';
    expect(style).toContain('top:');
    expect(style).toContain('left:');
  });
});