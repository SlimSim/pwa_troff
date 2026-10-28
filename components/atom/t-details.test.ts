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

/**
 * Feature (AMENDED spec): when the panel EXPANDS, t-details scrolls its content
 * back into view on the nearest scrollable ancestor, respecting the INSET
 * visible area (the app shell puts t-header at the top and t-footer at the
 * bottom, so the container's visible box runs from the header's bottom edge to
 * the footer's top edge):
 *  - bounds = the scroll container's own bounding rect (its visible box);
 *    for the document.scrollingElement fallback the bounds are the viewport
 *    ({ top: 0, bottom: window.innerHeight });
 *  - if the bottom of the t-details is below the container bottom bound,
 *    scroll down so the bottom aligns with that bound (visible above the
 *    footer), NOT with window.innerHeight;
 *  - clamped so the top of the t-details never scrolls above the container
 *    top bound (hidden behind the header is forbidden):
 *    delta = min(rect.bottom - bounds.bottom, rect.top - bounds.top);
 *  - no scroll when the top is already at/above the top bound (never scroll up);
 *  - no scroll when already fully visible;
 *  - smooth behavior; only on OPENING, never on collapsing.
 *
 * happy-dom quirks handled here:
 *  - no real layout → the t-details' and the scroll containers'
 *    getBoundingClientRect are stubbed;
 *  - window.innerHeight is controlled via Object.defineProperty (same pattern
 *    as t-dropdown-button.test.ts);
 *  - Element.scrollTo may not exist / is not reliably a spy → installed
 *    explicitly on the scroll container with Object.defineProperty;
 *  - happy-dom 20.9.0's getComputedStyle() does NOT reflect inline styles
 *    (it returns "" for every property), so computed overflow-y is injected
 *    via a getComputedStyle mock that overlays values recorded by
 *    setOverflowY() — the implementation still calls the real
 *    window.getComputedStyle, only the missing layout info is provided.
 */
describe('t-details – scrolls content into view when expanding', () => {
  const VIEWPORT_HEIGHT = 800;

  let element: DetailsElement;
  let scrollContainer: HTMLDivElement;
  let scrollToSpy: ReturnType<typeof vi.fn>;
  let originalInnerHeight: number;
  let extraNodes: HTMLElement[] = [];

  /** Layout info happy-dom cannot compute: element → computed overflow-y. */
  const computedOverflow = new WeakMap<Element, string>();

  /** Give an element a "computed" overflow-y (inline style + injected map). */
  function setOverflowY(el: HTMLElement, value: string): void {
    el.style.overflowY = value;
    computedOverflow.set(el, value);
  }

  /**
   * Install a scrollTo spy on any element (shadowing a prototype scrollTo if
   * happy-dom provides one).
   */
  function spyOnScrollTo(el: Element): ReturnType<typeof vi.fn> {
    const spy = vi.fn();
    Object.defineProperty(el, 'scrollTo', {
      value: spy,
      writable: true,
      configurable: true,
    });
    return spy;
  }

  beforeEach(async () => {
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: VIEWPORT_HEIGHT,
    });

    // Overlay the recorded overflow-y values onto happy-dom's computed styles.
    const realGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      const style = realGetComputedStyle(el);
      const forced = computedOverflow.get(el);
      if (forced === undefined) {
        return style;
      }
      return new Proxy(style, {
        get(target, prop) {
          if (prop === 'overflowY') {
            return forced;
          }
          const value = Reflect.get(target, prop);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }) as CSSStyleDeclaration;
    });

    // Default light-DOM scroll container (computed overflow-y: auto).
    // Its visible box spans the whole viewport here (no header/footer inset);
    // inset boxes are covered by dedicated tests below.
    scrollContainer = document.createElement('div');
    setOverflowY(scrollContainer, 'auto');
    scrollToSpy = spyOnScrollTo(scrollContainer);
    stubContainerRect(scrollContainer, 0, VIEWPORT_HEIGHT);
    document.body.appendChild(scrollContainer);

    element = new DetailsElement();
    scrollContainer.appendChild(element);
    await element.updateComplete;
  });

  afterEach(() => {
    element.remove();
    scrollContainer.remove();
    for (const node of extraNodes) {
      node.remove();
    }
    extraNodes = [];
    if (document.scrollingElement) {
      Reflect.deleteProperty(document.scrollingElement, 'scrollTo');
    }
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
    vi.restoreAllMocks();
  });

  /** Stub the on-screen rect of the t-details host element. */
  function stubRect(top: number, bottom: number): void {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      top,
      bottom,
    } as DOMRect);
  }

  /** Stub the visible box of a scroll container (top/bottom are its bounds). */
  function stubContainerRect(container: Element, top: number, bottom: number): void {
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      top,
      bottom,
    } as DOMRect);
  }

  /** Expand the panel through a real click on the inner <summary>. */
  async function clickSummary(): Promise<void> {
    const summary = element.shadowRoot?.querySelector('summary') as HTMLElement;
    expect(summary).toBeTruthy();
    summary.click();
    await element.updateComplete;
  }

  it('scrolls the scroll container down so the bottom of the t-details aligns with the viewport bottom', async () => {
    stubRect(300, 1000); // 200px below the 800px viewport bottom
    scrollContainer.scrollTop = 40;

    await clickSummary();

    // delta = min(1000 - 800, 300) = 200 → top = scrollTop + 200
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith({
      top: scrollContainer.scrollTop + 200,
      behavior: 'smooth',
    });
  });

  it('clamps the scroll so the top of the t-details never scrolls past the viewport top', async () => {
    // Taller than the viewport: bottom 200px below, but top only 100px from
    // the viewport top → clamped to 100px.
    stubRect(100, 1000);
    scrollContainer.scrollTop = 40;

    await clickSummary();

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith({
      top: scrollContainer.scrollTop + 100,
      behavior: 'smooth',
    });
  });

  it('does not scroll when the whole t-details is already fully visible', async () => {
    stubRect(100, 700); // entirely within the 800px viewport

    await clickSummary();

    expect(element.open).toBe(true);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('does not scroll when the top of the t-details is already above the viewport top', async () => {
    stubRect(-60, 900); // top above viewport → delta would be <= 0

    await clickSummary();

    expect(element.open).toBe(true);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('does not scroll when collapsing the panel', async () => {
    stubRect(300, 1000);

    await clickSummary(); // expand (may scroll)
    scrollToSpy.mockClear();

    await clickSummary(); // collapse

    expect(element.open).toBe(false);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('scrolls the nearest scrollable ancestor, not a higher non-scrollable one', async () => {
    element.remove();
    scrollContainer.remove();

    const outer = document.createElement('div');
    setOverflowY(outer, 'visible');
    const outerScrollTo = spyOnScrollTo(outer);

    const inner = document.createElement('div');
    setOverflowY(inner, 'auto');
    const innerScrollTo = spyOnScrollTo(inner);
    stubContainerRect(inner, 0, VIEWPORT_HEIGHT);

    outer.appendChild(inner);
    inner.appendChild(element);
    document.body.appendChild(outer);
    extraNodes.push(outer);
    await element.updateComplete;

    stubRect(300, 1000);
    inner.scrollTop = 40;

    await clickSummary();

    expect(innerScrollTo).toHaveBeenCalledTimes(1);
    expect(innerScrollTo).toHaveBeenCalledWith({
      top: inner.scrollTop + 200,
      behavior: 'smooth',
    });
    expect(outerScrollTo).not.toHaveBeenCalled();
  });

  it('climbs across shadow-root boundaries to find the scroll container', async () => {
    element.remove();
    scrollContainer.remove();

    // scrollContainer (auto) > host (shadow root) > inner div > t-details
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    setOverflowY(inner, 'visible');
    shadow.appendChild(inner);
    inner.appendChild(element);

    scrollContainer.appendChild(host);
    document.body.appendChild(scrollContainer);
    extraNodes.push(host);
    await element.updateComplete;

    stubRect(300, 1000);
    scrollContainer.scrollTop = 40;

    await clickSummary();

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith({
      top: scrollContainer.scrollTop + 200,
      behavior: 'smooth',
    });
  });

  it('falls back to window scrolling (document.scrollingElement) when no scrollable ancestor exists', async () => {
    element.remove();
    scrollContainer.remove();

    // t-details directly in the body: no ancestor has a scrollable overflow-y.
    document.body.appendChild(element);
    await element.updateComplete;

    const scrollingElement = document.scrollingElement as HTMLElement;
    expect(scrollingElement).toBeTruthy();
    const windowScrollToSpy = spyOnScrollTo(scrollingElement);
    // The scrolling element's own rect spans the WHOLE document — the fallback
    // must still use the viewport as bounds, not this rect.
    stubContainerRect(scrollingElement, -4000, 9000);

    stubRect(300, 1000);
    scrollingElement.scrollTop = 40;

    await clickSummary();

    expect(windowScrollToSpy).toHaveBeenCalledTimes(1);
    expect(windowScrollToSpy).toHaveBeenCalledWith({
      top: scrollingElement.scrollTop + 200,
      behavior: 'smooth',
    });
  });

  /**
   * AMENDED spec: the bounds are the INSET visible box of the scroll
   * container (header bottom → footer top), not window.innerHeight.
   * Container box { top: 60, bottom: 730 } = 60px header, footer top at 730
   * in an 800px window.
   */
  describe('inset scroll-container bounds (header bottom / footer top)', () => {
    const CONTAINER_TOP = 60;
    const CONTAINER_BOTTOM = 730;

    beforeEach(() => {
      stubContainerRect(scrollContainer, CONTAINER_TOP, CONTAINER_BOTTOM);
    });

    it('aligns the t-details bottom with the container bottom bound (footer top), not window.innerHeight', async () => {
      stubRect(300, 800); // bottom overflows the 730px footer top by 70
      scrollContainer.scrollTop = 40;

      await clickSummary();

      // delta = min(800 - 730, 300 - 60) = 70 → bottom lands on the footer top
      expect(scrollToSpy).toHaveBeenCalledTimes(1);
      expect(scrollToSpy).toHaveBeenCalledWith({
        top: scrollContainer.scrollTop + 70,
        behavior: 'smooth',
      });
    });

    it('clamps the scroll to the container top bound (header bottom) so the t-details top never hides behind the header', async () => {
      stubRect(100, 1000); // overflows 270 below the footer top, but top is only 40 below the header bottom
      scrollContainer.scrollTop = 40;

      await clickSummary();

      // delta = min(1000 - 730, 100 - 60) = 40 → top lands on the container top edge
      expect(scrollToSpy).toHaveBeenCalledTimes(1);
      expect(scrollToSpy).toHaveBeenCalledWith({
        top: scrollContainer.scrollTop + 40,
        behavior: 'smooth',
      });
    });

    it('does not scroll when the t-details bottom is exactly at the container bottom bound', async () => {
      stubRect(300, 730);

      await clickSummary();

      expect(element.open).toBe(true);
      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it('does not scroll up when the t-details top is exactly at the container top bound', async () => {
      stubRect(60, 900);

      await clickSummary();

      expect(element.open).toBe(true);
      expect(scrollToSpy).not.toHaveBeenCalled();
    });
  });
});
