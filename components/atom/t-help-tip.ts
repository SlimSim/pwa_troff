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
      align-items: flex-start;
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
      margin-top: 2px;
    }

    .chevron-icon {
      flex-shrink: 0;
      margin-top: 2px;
      transition:
        transform 0.2s ease,
        opacity 0.2s ease;
      opacity: 0;
      transform: rotateX(0deg);
    }

    :host([open]) .chevron-icon {
      opacity: 1;
      transform: rotateX(180deg);
    }

    .summary-content {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xxs, 2px);
    }

    .summary-h3 {
      margin: 0;
      font-size: var(--font-size-sm, 0.875rem);
      font-weight: 600;
      line-height: 1.2;
    }

    .summary-p {
      margin: 0;
      font-size: var(--font-size-sm, 0.875rem);
      line-height: 1.3;
      opacity: 0.8;
    }

    .detail-content {
      display: none;
      padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
      margin: var(--spacing-xs, 4px) calc(var(--spacing-xs, 4px) * -1) 0;
      background-color: var(--help-tip-background);
      color: var(--on-help-tip-background);
      border-radius: var(--button-border-radius, 4px);
      animation: fadeIn 0.2s ease-out;
      font-size: var(--font-size-xs, 0.75rem);
      line-height: 1.4;
    }

    .detail-content ::slotted(*) {
      margin: 0;
    }

    .detail-content ::slotted(:first-child) {
      margin-top: 0;
    }

    .detail-content ::slotted(:last-child) {
      margin-bottom: 0;
    }

    .detail-content ::slotted(p) {
      margin: var(--spacing-xs, 4px) 0;
    }

    .detail-content ::slotted(ul) {
      margin: var(--spacing-xs, 4px) 0;
      padding-left: var(--spacing-lg, 16px);
    }

    .detail-content ::slotted(li) {
      margin: var(--spacing-xxs, 2px) 0;
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
        aria-controls="${this._summaryId}-content"
        @click=${this._handleSummaryClick}
        @keydown=${this._handleKeyDown}
      >
        <span class="summary-content">
          ${this.h3 ? html`<h3 class="summary-h3">${this.h3}</h3>` : ''}
          ${this.p ? html`<p class="summary-p">${this.p}</p>` : ''}
        </span>
        <t-icon class="help-icon" name="help" slim></t-icon>
        <t-icon class="chevron-icon" name="chevron-down" slim></t-icon>
        <slot name="summary"></slot>
      </button>
      <div
        id="${this._summaryId}-content"
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
