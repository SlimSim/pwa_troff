import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { computePopupPosition } from '../../utils/popupPosition.js';
import type { PopupPositionInput } from '../../utils/popupPosition.js';

@customElement('t-help-tip')
export class THelpTip extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      text-align: left;
    }

    .summary-button {
      margin-left: -5px;
      margin-top: -4px;
      margin-bottom: -4px;
    }

    .summary-button:focus-visible {
      outline: 2px solid var(--focus-color, #2196f3);
      outline-offset: 2px;
      border-radius: var(--button-border-radius, 4px);
    }

    .help-icon {
      flex-shrink: 0;
      margin-top: 2px;
      padding-right: 4px;
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
      padding-right: 4px;
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
      position: fixed;
      padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
      background-color: var(--help-tip-background);
      color: var(--on-help-tip-background);
      border: 2px solid var(--theme-color);
      border-radius: var(--button-border-radius, 4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 20000;
      min-width: 180px;
      max-width: min(360px, calc(100vw - 16px));
      visibility: hidden;
      opacity: 0;
      transition: opacity 0.2s ease;
      font-size: var(--font-size-xs, 0.75rem);
      line-height: 1.4;
    }

    .detail-content[open] {
      display: block;
      visibility: visible;
      opacity: 1;
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
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) h3 = '';
  @property({ type: String }) p = '';
  @property({ type: String }) position = 'down';
  @property({ type: String }) align = 'right';
  @property({ type: String }) mobilePosition = 'auto';

  @state() private _summaryId = `help-tip-summary-${Math.random().toString(36).substr(2, 9)}`;

  private _boundHandleDocumentClick!: (event: MouseEvent) => void;
  private _boundHandleReposition!: () => void;
  private _boundHandleVisualViewportChange!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._boundHandleDocumentClick = this._handleDocumentClick.bind(this);
    document.addEventListener('mousedown', this._boundHandleDocumentClick, { capture: true });
    this._boundHandleReposition = this._reposition.bind(this);
    window.addEventListener('scroll', this._boundHandleReposition, { capture: true });
    window.addEventListener('resize', this._boundHandleReposition);

    this._boundHandleVisualViewportChange = this._reposition.bind(this);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._boundHandleVisualViewportChange);
      window.visualViewport.addEventListener('scroll', this._boundHandleVisualViewportChange);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousedown', this._boundHandleDocumentClick, { capture: true });
    window.removeEventListener('scroll', this._boundHandleReposition, { capture: true });
    window.removeEventListener('resize', this._boundHandleReposition);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._boundHandleVisualViewportChange);
      window.visualViewport.removeEventListener('scroll', this._boundHandleVisualViewportChange);
    }
  }

  private _reposition() {
    if (!this.open) return;
    this._positionDetail();
  }

  private _positionDetail() {
    const summaryButton = this.shadowRoot?.querySelector('.summary-button') as HTMLElement | null;
    const detailContent = this.shadowRoot?.querySelector('.detail-content') as HTMLElement | null;
    if (!summaryButton || !detailContent) return;

    const rect = summaryButton.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;
    const useTopPosition = this.mobilePosition === 'top' && isMobile;

    // Reset offsets so the fixed popup is measured at its natural size
    // (left+right or top+bottom set together would stretch it), then let the
    // shared popover positioning logic pick the best side and clamp on-screen.
    detailContent.style.top = '0px';
    detailContent.style.left = '0px';
    detailContent.style.bottom = 'auto';
    detailContent.style.right = 'auto';

    const { top, left } = computePopupPosition({
      triggerRect: rect as PopupPositionInput['triggerRect'],
      popupWidth: detailContent.offsetWidth,
      popupHeight: detailContent.offsetHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      preferSide: this.position === 'up' ? 'up' : 'down',
      horizontalAlign: this.align === 'left' ? 'left' : 'right',
    });

    // At top:0/left:0, a transformed containing block makes the fixed popup's
    // getBoundingClientRect() return that box's origin in viewport coordinates.
    // Subtracting it converts the computed viewport coords into the containing
    // block's coordinate space (no-op when there is no transformed ancestor).
    const detailRect = detailContent.getBoundingClientRect();

    if (useTopPosition) {
      // Mobile: anchor the popup to the top of the viewport and center it
      // horizontally on the screen.
      const centeredLeft = (window.innerWidth - detailContent.offsetWidth) / 2;
      detailContent.style.top = '8px';
      detailContent.style.left = `${Math.max(8, Math.min(centeredLeft, window.innerWidth - detailContent.offsetWidth - 8)) - detailRect.left}px`;
    } else {
      detailContent.style.top = `${top - detailRect.top}px`;
      detailContent.style.left = `${left - detailRect.left}px`;
    }
    detailContent.style.bottom = 'auto';
    detailContent.style.right = 'auto';
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      // Position immediately after render (works in tests and production)
      this._positionDetail();
    }
  }

  private _handleDocumentClick(event: MouseEvent) {
    const path = event.composedPath();
    const isInside = path.includes(this);
    if (!isInside && this.open) {
      this.open = false;
    }
  }

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
      <t-butt
        ghost
        slim
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
      </t-butt>
      <div
        id="${this._summaryId}-content"
        class="detail-content"
        role="region"
        aria-labelledby=${this._summaryId}
        ?open=${this.open}
        ?hidden=${!this.open}
      >
        <slot></slot>
      </div>
    `;
  }
}
