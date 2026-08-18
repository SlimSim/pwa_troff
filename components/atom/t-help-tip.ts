import { LitElement, html, css, render } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { computePopupPosition } from '../../utils/popupPosition.js';
import type { PopupPositionInput } from '../../utils/popupPosition.js';

// The open popup is portaled into document.body (inside its own shadow root),
// so it escapes any stacking context from an ancestor container (e.g. the
// settings panel, z-index 999, below the header/footer at 1000). These styles
// live with the portal-rendered popup, not the component.
const popupStyles = css`
  .detail-content {
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
    font-size: var(--font-size-xs, 0.75rem);
    line-height: 1.4;
  }

  .detail-content > * {
    margin: 0;
  }

  .detail-content > :first-child {
    margin-top: 0;
  }

  .detail-content > :last-child {
    margin-bottom: 0;
  }

  .detail-content p {
    margin: var(--spacing-xs, 4px) 0;
  }

  .detail-content ul {
    margin: var(--spacing-xs, 4px) 0;
    padding-left: var(--spacing-lg, 16px);
  }

  .detail-content li {
    margin: var(--spacing-xxs, 2px) 0;
  }
`;

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

    /* Hidden placeholder slot: captures the default-slot light DOM so the
       popup can move those nodes into the portal while open. */
    .detail-slot {
      display: none;
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) h3 = '';
  @property({ type: String }) p = '';
  @property({ type: String }) position = 'down';
  @property({ type: String }) align = 'right';
  @property({ type: String }) mobilePosition = 'auto';

  @state() private _summaryId = `help-tip-summary-${Math.random().toString(36).substr(2, 9)}`;

  private _portalHost: HTMLDivElement | null = null;
  private _portalRoot: ShadowRoot | null = null;

  private _boundHandleDocumentClick!: (event: MouseEvent) => void;
  private _boundHandleReposition!: () => void;
  private _boundHandleVisualViewportChange!: () => void;

  get popupElement(): HTMLElement | null {
    return this._portalRoot
      ? (this._portalRoot.querySelector('.detail-content') as HTMLElement | null)
      : null;
  }

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
    this._destroyPortal();
    document.removeEventListener('mousedown', this._boundHandleDocumentClick, { capture: true });
    window.removeEventListener('scroll', this._boundHandleReposition, { capture: true });
    window.removeEventListener('resize', this._boundHandleReposition);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._boundHandleVisualViewportChange);
      window.visualViewport.removeEventListener('scroll', this._boundHandleVisualViewportChange);
    }
  }

  private _ensurePortal(): ShadowRoot | null {
    if (this._portalRoot) return this._portalRoot;
    this._portalHost = document.createElement('div');
    document.body.appendChild(this._portalHost);
    this._portalRoot = this._portalHost.attachShadow({ mode: 'open' });
    return this._portalRoot;
  }

  private _destroyPortal() {
    if (!this._portalHost) return;
    // Move the slotted detail nodes back into the host's light DOM so they
    // stay assigned to the hidden slot (and aren't lost with the portal).
    const popup = this.popupElement;
    if (popup) {
      for (const node of Array.from(popup.childNodes)) {
        this.appendChild(node);
      }
    }
    this._portalHost.remove();
    this._portalHost = null;
    this._portalRoot = null;
  }

  private _movingNodes = false;

  private _getDetailNodes(): Node[] {
    const slot = this.shadowRoot?.querySelector('.detail-slot slot') as HTMLSlotElement | null;
    return slot ? slot.assignedNodes() : [];
  }

  private _renderPopup() {
    if (!this.open) {
      this._destroyPortal();
      return;
    }
    const root = this._ensurePortal();
    if (!root) return;
    render(
      html`
        <style>${popupStyles.cssText}</style>
        <div
          id="${this._summaryId}-content"
          class="detail-content"
          role="region"
          aria-labelledby=${this._summaryId}
        >
        </div>
      `,
      root,
      { host: this }
    );
    this._syncContentToPopup();
    this._positionPopup();
  }

  private _syncContentToPopup() {
    const popup = this.popupElement;
    if (!popup) return;
    const nodes = this._getDetailNodes();
    if (nodes.length === 0) return;
    // Move the slotted detail nodes into the portaled popup so the popup
    // escapes the component's stacking context. Guard our own mutations so
    // the resulting slotchange doesn't re-trigger this.
    this._movingNodes = true;
    while (popup.firstChild) popup.removeChild(popup.firstChild);
    for (const node of nodes) popup.appendChild(node);
    this._movingNodes = false;
  }

  private _reposition() {
    if (!this.open) return;
    this._positionPopup();
  }

  private _positionPopup() {
    const summaryButton = this.shadowRoot?.querySelector('.summary-button') as HTMLElement | null;
    const popup = this.popupElement;
    if (!summaryButton || !popup) return;

    // Reset to measure the popup at its natural size, then let the shared
    // popover positioning logic pick the best side and clamp on-screen. The
    // portal lives in document.body, so no containing-block compensation is
    // needed — position: fixed is relative to the viewport.
    popup.style.left = '0px';
    popup.style.top = '0px';

    const rect = summaryButton.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;
    const useTopPosition = this.mobilePosition === 'top' && isMobile;

    if (useTopPosition) {
      // Mobile: anchor the popup to the top of the viewport and center it
      // horizontally on the screen.
      const centeredLeft = (window.innerWidth - popup.offsetWidth) / 2;
      popup.style.top = '8px';
      popup.style.left = `${Math.max(8, Math.min(centeredLeft, window.innerWidth - popup.offsetWidth - 8))}px`;
    } else {
      const { top, left } = computePopupPosition({
        triggerRect: rect as PopupPositionInput['triggerRect'],
        popupWidth: popup.offsetWidth,
        popupHeight: popup.offsetHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        preferSide: this.position === 'up' ? 'up' : 'down',
        horizontalAlign: this.align === 'left' ? 'left' : 'right',
      });
      popup.style.top = `${top}px`;
      popup.style.left = `${left}px`;
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open')) {
      this._renderPopup();
    }
  }

  private _handleDocumentClick(event: MouseEvent) {
    const path = event.composedPath();
    const isInside =
      path.includes(this) || Boolean(this._portalHost && path.includes(this._portalHost));
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

  private _handleSlotChange = () => {
    // The parent re-rendered the slotted detail content while the popup is
    // open — refresh the portaled popup with the new nodes.
    if (this.open && !this._movingNodes) {
      this._renderPopup();
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
        <t-icon class="help-icon" name=${this.open ? 'close' : 'help'} slim></t-icon>
        <slot name="summary"></slot>
      </t-butt>
      <div class="detail-slot" aria-hidden="true">
        <slot @slotchange=${this._handleSlotChange}></slot>
      </div>
    `;
  }
}