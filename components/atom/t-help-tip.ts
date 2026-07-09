import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-icon.js';

const GAP = 8;
const EDGE_MARGIN = 8;

@customElement('t-help-tip')
export class THelpTip extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      position: relative;
    }

    .trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 1px solid var(--text-color, #000);
      background: transparent;
      color: var(--text-color, #000);
      cursor: pointer;
      padding: 0;
      font-size: 13px;
      line-height: 1;
      font-family: sans-serif;
      opacity: 0.6;
      transition: opacity 0.15s ease;
      flex-shrink: 0;
    }

    .trigger:hover,
    .trigger:focus-visible {
      opacity: 1;
    }

    .trigger.open {
      opacity: 1;
    }

    .popover {
      position: fixed;
      z-index: 1000;
      width: max-content;
      max-width: 280px;
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--secondary-color, rgba(0, 0, 0, 0.08));
      color: var(--on-secondary-color, #000);
      font-size: 0.82rem;
      line-height: 1.4;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      pointer-events: auto;
      visibility: hidden; /* hidden until positioned */
    }

    .popover.visible {
      visibility: visible;
    }

    .popover[hidden] {
      display: none;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 999;
    }
  `;

  @property({ type: String }) text = '';

  @property({ type: String }) placement: 'top' | 'bottom' | 'left' | 'right' = 'bottom';

  @state() private _open = false;

  @state() private _popoverTop = 0;

  @state() private _popoverLeft = 0;

  @state() private _isPositioned = false;

  private _toggle() {
    this._open = !this._open;
  }

  private _close() {
    this._open = false;
  }

  private _onTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this._close();
    }
  }

  private _reposition() {
    const popover = this.shadowRoot?.querySelector('.popover') as HTMLElement | null;
    if (!popover || popover.hidden) return;

    const triggerRect = this.getBoundingClientRect();
    const popoverWidth = popover.offsetWidth;
    const popoverHeight = popover.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // --- Vertical ---
    const spaceBelow = vh - triggerRect.bottom - GAP;
    const spaceAbove = triggerRect.top - GAP;
    let top: number;

    if (this.placement === 'bottom' && spaceBelow >= popoverHeight) {
      top = triggerRect.bottom + GAP;
    } else if (this.placement === 'top' && spaceAbove >= popoverHeight) {
      top = triggerRect.top - GAP - popoverHeight;
    } else if (spaceBelow >= popoverHeight) {
      top = triggerRect.bottom + GAP;
    } else {
      top = Math.max(GAP, triggerRect.top - GAP - popoverHeight);
    }

    // --- Horizontal ---
    // Align left edge with trigger, clamp to viewport
    const left = Math.max(EDGE_MARGIN, Math.min(triggerRect.left, vw - EDGE_MARGIN - popoverWidth));

    this._popoverTop = top;
    this._popoverLeft = left;
    this._isPositioned = true;
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('_open') && this._open) {
      this._isPositioned = false;
      // Wait for the popover DOM to be rendered and laid out
      this.updateComplete.then(() => {
        requestAnimationFrame(() => {
          this._reposition();
        });
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._open = false;
  }

  render() {
    return html`
      <button
        class="trigger ${this._open ? 'open' : ''}"
        @click=${this._toggle}
        @keydown=${this._onTriggerKeydown}
        aria-label="Learn more"
        aria-expanded=${this._open}
        part="trigger"
      >
        ?
      </button>

      <div
        class="popover ${this._isPositioned ? 'visible' : ''}"
        ?hidden=${!this._open}
        part="popover"
        style="top:${this._popoverTop}px;left:${this._popoverLeft}px"
        @click=${(e: Event) => e.stopPropagation()}
      >
        <slot>${this.text}</slot>
      </div>

      ${this._open
        ? html`
            <div
              class="backdrop"
              @click=${this._close}
              @keydown=${this._onTriggerKeydown}
              tabindex="-1"
            ></div>
          `
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-help-tip': THelpTip;
  }
}