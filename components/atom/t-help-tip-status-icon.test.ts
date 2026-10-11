import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { THelpTip } from './t-help-tip.js';

/**
 * FEATURE SPEC (UI redesign): t-help-tip gets a new optional `icon` property.
 *
 * - `@property({ type: String }) icon = 'help'`
 * - The trigger t-icon name becomes `this.open ? 'close' : this.icon`.
 * - Backwards compatible: the default renders 'help' when closed and 'close'
 *   when open (the pre-existing t-help-tip.test.ts must keep passing).
 * - Custom icon: `icon="more-vertical"` renders 'more-vertical' while closed
 *   and still 'close' while open.
 *
 * These tests import the ACTUAL THelpTip class (never a re-implementation).
 * RED until the `icon` property exists in components/atom/t-help-tip.ts.
 */

/** Test-only view onto the not-yet-existing `icon` property (no `any`). */
type THelpTipWithIcon = THelpTip & { icon: string };

function withIcon(el: THelpTip): THelpTipWithIcon {
  return el as THelpTipWithIcon;
}

describe('t-help-tip custom trigger icon', () => {
  let element: THelpTip;

  beforeEach(() => {
    element = new THelpTip();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  function setSummaryContent(text: string) {
    const span = document.createElement('span');
    span.slot = 'summary';
    span.textContent = text;
    element.appendChild(span);
  }

  /** Name of the single trigger t-icon rendered in the shadow root. */
  function triggerIconName(): string | null {
    const icon = element.shadowRoot?.querySelector('t-icon');
    return icon ? icon.getAttribute('name') : null;
  }

  it("defaults the icon property to 'help'", async () => {
    setSummaryContent('Summary');
    await element.updateComplete;

    expect(withIcon(element).icon).toBe('help');
  });

  it("renders t-icon[name='help'] when closed with the default icon (backwards compat)", async () => {
    setSummaryContent('Summary');
    await element.updateComplete;

    expect(withIcon(element).icon).toBe('help');
    expect(triggerIconName()).toBe('help');
    expect(element.shadowRoot?.querySelector('t-icon[name="close"]')).toBeNull();
  });

  it("renders t-icon[name='close'] when open with the default icon (backwards compat)", async () => {
    setSummaryContent('Summary');
    element.open = true;
    await element.updateComplete;

    expect(triggerIconName()).toBe('close');
    expect(element.shadowRoot?.querySelector('t-icon[name="help"]')).toBeNull();
  });

  it('renders the custom icon while closed', async () => {
    setSummaryContent('Summary');
    withIcon(element).icon = 'more-vertical';
    await element.updateComplete;

    expect(triggerIconName()).toBe('more-vertical');
    expect(element.shadowRoot?.querySelector('t-icon[name="help"]')).toBeNull();
    expect(element.shadowRoot?.querySelector('t-icon[name="close"]')).toBeNull();
  });

  it('swaps the custom icon to close while open and back to the custom icon when closed again', async () => {
    setSummaryContent('Summary');
    withIcon(element).icon = 'more-vertical';
    await element.updateComplete;

    element.open = true;
    await element.updateComplete;
    expect(triggerIconName()).toBe('close');
    expect(element.shadowRoot?.querySelector('t-icon[name="more-vertical"]')).toBeNull();

    element.open = false;
    await element.updateComplete;
    expect(triggerIconName()).toBe('more-vertical');
  });

  it('toggles to close and back via summary clicks while a custom icon is set', async () => {
    setSummaryContent('Summary');
    withIcon(element).icon = 'more-vertical';
    await element.updateComplete;

    const summaryButton = element.shadowRoot?.querySelector(
      '.summary-button'
    ) as HTMLElement | null;
    expect(summaryButton).toBeTruthy();

    summaryButton?.click();
    await element.updateComplete;
    expect(element.open).toBe(true);
    expect(triggerIconName()).toBe('close');

    summaryButton?.click();
    await element.updateComplete;
    expect(element.open).toBe(false);
    expect(triggerIconName()).toBe('more-vertical');
  });

  it('accepts the custom icon via the icon attribute', async () => {
    setSummaryContent('Summary');
    element.setAttribute('icon', 'more-vertical');
    await element.updateComplete;

    expect(withIcon(element).icon).toBe('more-vertical');
    expect(triggerIconName()).toBe('more-vertical');
  });
});
