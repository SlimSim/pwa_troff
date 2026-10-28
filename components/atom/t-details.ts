import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { computeRevealScrollDelta } from '../../utils/scroll-utils.js';
import type { ViewportRect } from '../../utils/scroll-utils.js';
import './t-icon.js';

@customElement('t-details')
export class DetailsElement extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    details.advanced-panel {
      overflow: hidden;
    }

    details.advanced-panel[open] {
      background-color: var(--secondary-color, rgba(0, 0, 0, 0.08));
      box-shadow: 0px 0px 0px 2px var(--secondary-color, rgba(0, 0, 0, 0.08));
    }

    .advanced-summary {
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      cursor: pointer;
      padding: 12px 0;
      padding-right: 1px;
    }

    .advanced-summary::-webkit-details-marker {
      display: none;
    }

    .advanced-summary-copy {
      display: grid;
      gap: 2px;
    }

    .advanced-summary-title {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-color, #000);
    }

    .advanced-summary-text {
      margin: 0;
      font-size: 0.82rem;
      color: var(--text-color, #000);
      opacity: 0.8;
    }

    .advanced-summary-end {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .advanced-chevron {
      font-size: 1rem;
      transition: transform 0.3s ease-in-out;
      transform-style: preserve-3d;
    }

    details.advanced-panel[open] .advanced-chevron {
      transform: rotateX(180deg) translateY(0);
    }

    .advanced-content {
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) title = '';
  @property({ type: String }) text = '';

  private _handleToggle() {
    const details = this.shadowRoot?.querySelector('details');
    const isOpen = details?.hasAttribute('open') ?? false;
    if (isOpen !== this.open) {
      this.open = isOpen;
      this.dispatchEvent(
        new CustomEvent('details-toggled', {
          detail: { open: this.open },
          bubbles: true,
          composed: true,
        })
      );
      if (isOpen) {
        this._scrollContentIntoView();
      }
    }
  }

  /** Find the nearest scrollable ancestor, climbing across shadow-root boundaries. */
  private _findScrollContainer(): Element | null {
    let current: Element | null = this;
    while (current) {
      const overflowY = window.getComputedStyle(current).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') {
        return current;
      }
      const parent: HTMLElement | null = current.parentElement;
      if (parent) {
        current = parent;
        continue;
      }
      const root = current.getRootNode();
      current = root instanceof ShadowRoot ? root.host : null;
    }
    return document.scrollingElement;
  }

  /** Smooth-scroll the container so the bottom of this element comes into view. */
  private _scrollContentIntoView(): void {
    const container = this._findScrollContainer();
    if (!container) {
      return;
    }
    // The document scrolling element's rect spans the whole document, so the
    // fallback bounds are the viewport; a real container bounds itself.
    const bounds: ViewportRect =
      container === document.scrollingElement
        ? { top: 0, bottom: window.innerHeight }
        : container.getBoundingClientRect();
    const delta = computeRevealScrollDelta(this.getBoundingClientRect(), bounds);
    if (delta <= 0) {
      return;
    }
    container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' });
  }

  render() {
    return html`
      <details class="advanced-panel" ?open=${this.open} @toggle=${this._handleToggle}>
        <summary class="advanced-summary">
          <div class="advanced-summary-copy">
            ${this.title ? html`<p class="advanced-summary-title">${this.title}</p>` : ''}
            ${this.text ? html`<p class="advanced-summary-text">${this.text}</p>` : ''}
          </div>
          <div class="advanced-summary-end">
            <slot name="badge"></slot>
            <t-icon name="chevron-down" class="advanced-chevron"></t-icon>
          </div>
        </summary>
        <div class="advanced-content">
          <slot></slot>
        </div>
      </details>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-details': DetailsElement;
  }
}
