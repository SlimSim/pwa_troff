import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { THelpTip } from '../../components/atom/t-help-tip.js';

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

  function setSummaryContent(content: string | Node) {
    const span = document.createElement('span');
    span.slot = 'summary';
    if (typeof content === 'string') {
      span.textContent = content;
    } else {
      span.appendChild(content);
    }
    element.appendChild(span);
  }

  function setDetailContent(content: string | Node) {
    const div = document.createElement('div');
    if (typeof content === 'string') {
      div.textContent = content;
    } else {
      div.appendChild(content);
    }
    element.appendChild(div);
  }

  async function openViaSummaryClick() {
    await element.updateComplete;
    const summaryButton = element.shadowRoot?.querySelector('.summary-button') as HTMLElement;
    summaryButton.click();
    await element.updateComplete;
  }

  describe('default state', () => {
    it('renders with closed state by default', async () => {
      await element.updateComplete;
      expect(element.open).toBe(false);
      expect(element.hasAttribute('open')).toBe(false);
    });

    it('has no popup in the shadow root and popupElement is null when closed', async () => {
      setSummaryContent('Summary');
      setDetailContent('Detail content');
      await element.updateComplete;

      expect(element.popupElement).toBeNull();
      expect(element.shadowRoot?.querySelector('.detail-content')).toBeNull();
    });

    it('keeps detail content in the light DOM when closed', async () => {
      setSummaryContent('Summary');
      setDetailContent('Detail content');
      await element.updateComplete;

      const detail = element.querySelector(':scope > div');
      expect(detail?.textContent).toContain('Detail content');
    });

    it('renders summary button with help icon', async () => {
      setSummaryContent('Summary Title');
      await element.updateComplete;

      const summaryButton = element.shadowRoot?.querySelector('.summary-button');
      expect(summaryButton).toBeTruthy();

      // Check light DOM for slotted content
      const summarySlot = element.querySelector('[slot="summary"]');
      expect(summarySlot?.textContent).toContain('Summary Title');

      // Should have a help icon in shadow DOM
      const helpIcon = element.shadowRoot?.querySelector('t-icon[name="help"]');
      expect(helpIcon).toBeTruthy();
    });
  });

  describe('open property and attribute', () => {
    it('portals the popup into document.body when open property is set', async () => {
      setSummaryContent('Summary');
      setDetailContent('Detail content');
      element.open = true;
      await element.updateComplete;

      const popup = element.popupElement;
      expect(popup).toBeTruthy();
      expect(popup).toBeInstanceOf(HTMLElement);

      // The popup must NOT live inside the component's shadow root...
      expect(element.shadowRoot?.querySelector('.detail-content')).toBeNull();

      // ...but it must be attached to document.body via a portal host.
      // NOTE: happy-dom's Node.contains() does NOT cross shadow boundaries
      // (real browsers do via shadow-including semantics), so assert on the
      // portal host div (the popup's shadow root host) instead of the popup.
      const popupRoot = popup?.getRootNode() as ShadowRoot | null;
      expect(popupRoot?.host).toBeInstanceOf(HTMLElement);
      expect(document.body.contains(popupRoot?.host as Node)).toBe(true);
    });

    it('moves the detail content into the portaled popup when open', async () => {
      setSummaryContent('Summary');
      setDetailContent('Detail content');
      element.open = true;
      await element.updateComplete;

      const popup = element.popupElement;
      expect(popup?.textContent).toContain('Detail content');
    });

    it('shows default slot content when open attribute is set', async () => {
      setSummaryContent('Summary');
      setDetailContent('Detail content');
      element.setAttribute('open', '');
      await element.updateComplete;

      expect(element.open).toBe(true);
      expect(element.hasAttribute('open')).toBe(true);
      expect(element.popupElement).toBeTruthy();
    });

    it('reflects open property to open attribute', async () => {
      element.open = true;
      await element.updateComplete;
      expect(element.hasAttribute('open')).toBe(true);
    });

    it('reflects open attribute to open property', async () => {
      element.setAttribute('open', '');
      await element.updateComplete;
      expect(element.open).toBe(true);
    });

    it('removes open attribute when open property set to false', async () => {
      element.open = true;
      await element.updateComplete;
      element.open = false;
      await element.updateComplete;
      expect(element.hasAttribute('open')).toBe(false);
    });

    it('removes open property when open attribute removed', async () => {
      element.setAttribute('open', '');
      await element.updateComplete;
      element.removeAttribute('open');
      await element.updateComplete;
      expect(element.open).toBe(false);
    });
  });

  describe('clicking summary toggles open state', () => {
    it('toggles open from false to true when summary clicked', async () => {
      setSummaryContent('Summary');
      setDetailContent('Detail');
      await element.updateComplete;

      expect(element.open).toBe(false);

      const summaryButton = element.shadowRoot?.querySelector('.summary-button') as HTMLElement;
      summaryButton.click();
      await element.updateComplete;

      expect(element.open).toBe(true);
    });

    it('toggles open from true to false when summary clicked again', async () => {
      element.open = true;
      setSummaryContent('Summary');
      setDetailContent('Detail');
      await element.updateComplete;

      expect(element.open).toBe(true);

      const summaryButton = element.shadowRoot?.querySelector('.summary-button') as HTMLElement;
      summaryButton.click();
      await element.updateComplete;

      expect(element.open).toBe(false);
    });

    it('creates and removes the portaled popup when toggled via summary click', async () => {
      setSummaryContent('Summary');
      setDetailContent('Detail content');
      await element.updateComplete;

      expect(element.popupElement).toBeNull();

      const summaryButton = element.shadowRoot?.querySelector('.summary-button') as HTMLElement;
      summaryButton.click();
      await element.updateComplete;

      expect(element.popupElement).toBeTruthy();
      expect(element.popupElement?.textContent).toContain('Detail content');

      summaryButton.click();
      await element.updateComplete;

      expect(element.popupElement).toBeNull();
    });

    it('returns the detail content to the light DOM when closed', async () => {
      setSummaryContent('Summary');
      setDetailContent('Detail content');
      element.open = true;
      await element.updateComplete;

      expect(element.popupElement?.textContent).toContain('Detail content');

      element.open = false;
      await element.updateComplete;

      expect(element.popupElement).toBeNull();
      const detail = element.querySelector(':scope > div');
      expect(detail?.textContent).toContain('Detail content');
    });
  });

  describe('accessibility', () => {
    it('summary button has aria-expanded reflecting open state', async () => {
      setSummaryContent('Summary');
      await element.updateComplete;

      const summaryButton = element.shadowRoot?.querySelector('.summary-button');
      expect(summaryButton?.getAttribute('aria-expanded')).toBe('false');

      element.open = true;
      await element.updateComplete;

      expect(summaryButton?.getAttribute('aria-expanded')).toBe('true');
    });

    it('portaled popup has role="region" and aria-labelledby pointing at summary', async () => {
      element.open = true;
      setSummaryContent('Summary');
      await element.updateComplete;

      const popup = element.popupElement;
      expect(popup?.getAttribute('role')).toBe('region');

      const summaryButton = element.shadowRoot?.querySelector('.summary-button');
      const summaryId = summaryButton?.getAttribute('id');
      expect(summaryId).toBeTruthy();
      expect(popup?.getAttribute('aria-labelledby')).toBe(summaryId);
    });
  });

  describe('slots', () => {
    it('renders summary slot content with help icon', async () => {
      const strong = document.createElement('strong');
      strong.textContent = 'Bold Summary';
      setSummaryContent(strong);
      await element.updateComplete;

      // Check light DOM for slotted content
      const summarySlot = element.querySelector('[slot="summary"]');
      expect(summarySlot?.innerHTML).toContain('<strong>Bold Summary</strong>');

      // Should have help icon in shadow DOM
      const helpIcon = element.shadowRoot?.querySelector('t-icon[name="help"]');
      expect(helpIcon).toBeTruthy();
    });

    it('renders all default slot content inside the portaled popup when open', async () => {
      setSummaryContent('Summary');
      const p = document.createElement('p');
      p.textContent = 'Paragraph content';
      const span = document.createElement('span');
      span.textContent = 'More content';
      setDetailContent(p);
      element.appendChild(span); // Add second element as well
      element.open = true;
      await element.updateComplete;

      const popup = element.popupElement;
      expect(popup?.textContent).toContain('Paragraph content');
      expect(popup?.textContent).toContain('More content');
    });

    it('hides default slot content when closed', async () => {
      setSummaryContent('Summary');
      const p = document.createElement('p');
      p.textContent = 'Hidden content';
      setDetailContent(p);
      await element.updateComplete;

      // Content stays in the light DOM (hidden slot), no portaled popup exists
      expect(element.popupElement).toBeNull();
      const detail = element.querySelector(':scope > div');
      expect(detail?.textContent).toContain('Hidden content');
    });
  });

  describe('portaled popup behavior', () => {
    it('renders the open portaled popup with z-index 20000', async () => {
      element.open = true;
      await element.updateComplete;

      const popup = element.popupElement as HTMLElement;
      expect(getComputedStyle(popup).zIndex).toBe('20000');
    });

    it('sets inline position styles on the portaled popup when opened', async () => {
      element.open = true;
      await element.updateComplete;

      const popup = element.popupElement;
      expect(popup?.style.top).toBeTruthy();
      expect(popup?.style.left).toBeTruthy();
    });

    it('closes on outside document mousedown', async () => {
      element.open = true;
      await element.updateComplete;
      expect(element.open).toBe(true);

      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await element.updateComplete;
      expect(element.open).toBe(false);
    });

    it('does not close when mousedown is dispatched inside the popup', async () => {
      element.open = true;
      await element.updateComplete;
      expect(element.open).toBe(true);

      const popup = element.popupElement as HTMLElement;
      popup.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, composed: true })
      );
      await element.updateComplete;

      expect(element.open).toBe(true);
    });

    it('repositions the portaled popup on window resize when open', async () => {
      element.open = true;
      await element.updateComplete;

      const popup = element.popupElement;
      expect(popup?.style.top).toBeTruthy();
      expect(popup?.style.left).toBeTruthy();

      window.dispatchEvent(new Event('resize'));
      await element.updateComplete;

      expect(popup?.style.top).toBeTruthy();
      expect(popup?.style.left).toBeTruthy();
    });

    it('does nothing on window scroll/resize when closed and popupElement stays null', async () => {
      await element.updateComplete;
      expect(element.popupElement).toBeNull();

      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
      await element.updateComplete;

      expect(element.popupElement).toBeNull();
    });
  });

  describe('CSS variables', () => {
    it('uses CSS variables from variables.css for styling', async () => {
      setSummaryContent('Summary');
      await element.updateComplete;

      const styles = getComputedStyle(element.shadowRoot?.host as Element);
      // Check that CSS variables from variables.css are available
      expect(styles.getPropertyValue('--button-border-radius')).toBeDefined();
    });
  });
});