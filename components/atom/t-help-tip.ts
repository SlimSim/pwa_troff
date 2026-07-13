import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('t-help-tip')
export class THelpTip extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
    }

    .summary-button {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs, 4px);
      cursor: pointer;
      list-style: none;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      background: none;
      border: none;
      padding: 0;
      font: inherit;
      color: inherit;
    }

    .summary-button:focus-visible {
      outline: 2px solid var(--focus-color, #2196f3);
      outline-offset: 2px;
      border-radius: var(--button-border-radius, 4px);
    }

    .help-icon {
      flex-shrink: 0;
    }

    .summary-content {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs, 4px);
      flex-wrap: wrap;
    }

    .summary-h3 {
      margin: 0;
      font-size: inherit;
      font-weight: 600;
      line-height: 1.2;
    }

    .summary-p {
      margin: 0;
      font-size: inherit;
      line-height: 1.3;
      opacity: 0.8;
    }

    .detail-content {
      display: none;
      padding: var(--spacing-sm, 8px) 0;
      animation: fadeIn 0.2s ease-out;
    }

    :host([open]) .detail-content {
      display: block;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) h3 = '';
  @property({ type: String }) p = '';

  @state() private _summaryId = `help-tip-summary-${Math.random().toString(36).substr(2, 9)}`;

  private _handleSummaryClick = () => {
    this.open = !this.open;
  };

  private _handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open = !this.open;
    }
  };

  render() {
    return html`
      <button
        class="summary-button"
        id=${this._summaryId}
        aria-expanded=${this.open}
        aria-controls=${this._summaryId}-content
        @click=${this._handleSummaryClick}
        @keydown=${this._handleKeyDown}
      >
        ${this.h3 ? html`<h3 class="summary-h3">${this.h3}</h3>` : ''}
        ${this.p ? html`<p class="summary-p">${this.p}</p>` : ''}
        <t-icon class="help-icon" name="help" slim></t-icon>
        <span class="summary-content"><slot name="summary"></slot></span>
      </button>
      <div
        id=${this._summaryId}-content
        class="detail-content"
        role="region"
        aria-labelledby=${this._summaryId}
        ?hidden=${!this.open}
      >
        <slot></slot>
      </div>
    `;
  }
}