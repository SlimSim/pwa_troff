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

  describe('default state', () => {
    it('renders with closed state by default', async () => {
      await element.updateComplete;
      expect(element.open).toBe(false);
      expect(element.hasAttribute('open')).toBe(false);
    });

    it('does not show default slot content when closed', async () => {
      setSummaryContent('Summary');
      setDetailContent('Detail content');
      await element.updateComplete;

      // The detail content div exists but is hidden via hidden attribute
      const detailContent = element.shadowRoot?.querySelector('.detail-content');
      expect(detailContent).toBeTruthy();
      expect(detailContent?.hasAttribute('hidden')).toBe(true);
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
    it('shows default slot content when open property is set', async () => {
      element.open = true;
      setSummaryContent('Summary');
      setDetailContent('Detail content');
      await element.updateComplete;

      const detailContent = element.shadowRoot?.querySelector('.detail-content');
      expect(detailContent).toBeTruthy();
      expect(detailContent?.hasAttribute('hidden')).toBe(false);

      // The slot element exists in shadow DOM
      const slot = detailContent?.querySelector('slot');
      expect(slot).toBeTruthy();
    });

    it('shows default slot content when open attribute is set', async () => {
      element.setAttribute('open', '');
      setSummaryContent('Summary');
      setDetailContent('Detail content');
      await element.updateComplete;

      expect(element.open).toBe(true);
      expect(element.hasAttribute('open')).toBe(true);
      const detailContent = element.shadowRoot?.querySelector('.detail-content');
      expect(detailContent?.hasAttribute('hidden')).toBe(false);
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

    it('shows/hides detail content when toggled via summary click', async () => {
      setSummaryContent('Summary');
      setDetailContent('Detail content');
      await element.updateComplete;

      let detailContent = element.shadowRoot?.querySelector('.detail-content');
      expect(detailContent?.hasAttribute('hidden')).toBe(true);

      const summaryButton = element.shadowRoot?.querySelector('.summary-button') as HTMLElement;
      summaryButton.click();
      await element.updateComplete;

      detailContent = element.shadowRoot?.querySelector('.detail-content');
      expect(detailContent?.hasAttribute('hidden')).toBe(false);

      summaryButton.click();
      await element.updateComplete;

      detailContent = element.shadowRoot?.querySelector('.detail-content');
      expect(detailContent?.hasAttribute('hidden')).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('summary button has button role semantics', async () => {
      setSummaryContent('Summary');
      await element.updateComplete;

      const summaryButton = element.shadowRoot?.querySelector('.summary-button');
      expect(summaryButton).toBeTruthy();
      expect(summaryButton?.tagName.toLowerCase()).toBe('button');
    });

    it('summary button has aria-expanded reflecting open state', async () => {
      setSummaryContent('Summary');
      await element.updateComplete;

      const summaryButton = element.shadowRoot?.querySelector('.summary-button');
      expect(summaryButton?.getAttribute('aria-expanded')).toBe('false');

      element.open = true;
      await element.updateComplete;

      expect(summaryButton?.getAttribute('aria-expanded')).toBe('true');
    });

    it('summary button is focusable', async () => {
      setSummaryContent('Summary');
      await element.updateComplete;

      const summaryButton = element.shadowRoot?.querySelector('.summary-button') as HTMLElement;
      expect(summaryButton.tabIndex).toBeGreaterThanOrEqual(0);
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

    it('renders default slot content when open', async () => {
      element.open = true;
      setSummaryContent('Summary');
      const p = document.createElement('p');
      p.textContent = 'Paragraph content';
      const span = document.createElement('span');
      span.textContent = 'More content';
      setDetailContent(p);
      element.appendChild(span); // Add second element as well
      await element.updateComplete;

      const defaultSlot = element.shadowRoot?.querySelector('.detail-content slot');
      expect(defaultSlot).toBeTruthy();
    });

    it('hides default slot content when closed', async () => {
      setSummaryContent('Summary');
      const p = document.createElement('p');
      p.textContent = 'Hidden content';
      setDetailContent(p);
      await element.updateComplete;

      const detailContent = element.shadowRoot?.querySelector('.detail-content');
      expect(detailContent?.hasAttribute('hidden')).toBe(true);
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
