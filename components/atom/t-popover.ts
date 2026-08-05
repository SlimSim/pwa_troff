import { LitElement, html, css, render } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-butt.js';
import './t-icon.js';
import { computePopupPosition } from '../../utils/popupPosition.js';
import type { PopupPositionInput } from '../../utils/popupPosition.js';

// The open popup is portaled into document.body (inside its own shadow root),
// so these styles live with the portal-rendered popup, not the component.
const popupStyles = css`
  .popup {
    position: fixed;
    background-color: var(--secondary-color);
    color: var(--on-secondary-color);
    border: 2px solid var(--theme-color);
    border-radius: 4px;
    z-index: 20000;
    max-width: min(300px, 90vw);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .popup-header {
    display: flex;
    align-items: center;
    padding: 6px 4px 4px 12px;
    font-weight: bold;
    border-bottom: 1px solid var(--theme-color);
    gap: 8px;
  }

  .popup-header-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .popup-body {
    padding: 8px 12px;
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 200px;
    overflow-y: auto;
  }
`;

@customElement('t-popover')
export class Popover extends LitElement {
  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
    }

    .trigger-wrapper {
      display: flex;
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) header = '';
  @property({ type: String }) body = '';
  @property({ type: Object }) boundary: Element | null = null;
  @property({ type: String, attribute: 'prefer-position' })
  preferPosition: 'center' | 'right' = 'center';

  private _portalHost: HTMLDivElement | null = null;
  private _portalRoot: ShadowRoot | null = null;

  get popupElement(): HTMLElement | null {
    return this._portalRoot
      ? (this._portalRoot.querySelector('.popup') as HTMLElement | null)
      : null;
  }

  private _boundHandleDocumentClick!: (event: MouseEvent) => void;
  private _boundReposition!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._boundHandleDocumentClick = this._handleDocumentClick.bind(this);
    this._boundReposition = this._reposition.bind(this);
    document.addEventListener('mousedown', this._boundHandleDocumentClick, {
      capture: true,
    });
    window.addEventListener('scroll', this._boundReposition, {
      capture: true,
    });
    window.addEventListener('resize', this._boundReposition);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._boundReposition);
      window.visualViewport.addEventListener('scroll', this._boundReposition);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._destroyPortal();
    document.removeEventListener('mousedown', this._boundHandleDocumentClick, {
      capture: true,
    });
    window.removeEventListener('scroll', this._boundReposition, {
      capture: true,
    });
    window.removeEventListener('resize', this._boundReposition);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener(
        'resize',
        this._boundReposition
      );
      window.visualViewport.removeEventListener(
        'scroll',
        this._boundReposition
      );
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
    this._portalHost?.remove();
    this._portalHost = null;
    this._portalRoot = null;
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
        <div class="popup" ?open=${this.open} @click=${this._handlePopupClick}>
          ${this.header
            ? html`
                <div class="popup-header">
                  <span class="popup-header-text">${this.header}</span>
                  <t-butt slim ghost @click=${this._handleCloseClick} title="Close">
                    <t-icon slim name="window-close"></t-icon>
                  </t-butt>
                </div>
              `
            : ''}
          <div class="popup-body">${this.body}</div>
        </div>
      `,
      root,
      { host: this }
    );
  }

  private _reposition() {
    if (!this.open) return;
    this._positionPopup();
  }

  private _positionPopup() {
    const triggerWrapper = this.shadowRoot?.querySelector(
      '.trigger-wrapper'
    ) as HTMLElement | null;
    const popup = this.popupElement;
    if (!triggerWrapper || !popup) return;

    // Reset position to measure natural size
    popup.style.left = '0px';
    popup.style.top = '0px';

    const triggerRect = triggerWrapper.getBoundingClientRect();
    const popupWidth = popup.offsetWidth;
    const popupHeight = popup.offsetHeight;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const boundaryRect = this.boundary instanceof Element
      ? this.boundary.getBoundingClientRect()
      : null;
    const { top, left } = computePopupPosition({
      triggerRect: triggerRect as PopupPositionInput['triggerRect'],
      popupWidth,
      popupHeight,
      viewportWidth,
      viewportHeight,
      boundaryRect,
      preferPosition: this.preferPosition,
    });
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  updated() {
    this._renderPopup();
    if (this.open) {
      this._positionPopup();
    }
  }

  private _handleDocumentClick(event: MouseEvent) {
    const path = event.composedPath();
    const isInside =
      path.includes(this) ||
      Boolean(this._portalHost && path.includes(this._portalHost));
    if (!isInside && this.open) {
      this._close();
    }
  }

  private _handleTriggerClick(event: Event) {
    event.stopPropagation();
    this.open = !this.open;
    if (this.open) {
      this.dispatchEvent(
        new CustomEvent('popover-opened', {
          bubbles: true,
          composed: true,
        })
      );
    } else {
      this._dispatchCloseEvent();
    }
  }

  private _close() {
    this.open = false;
    this._dispatchCloseEvent();
  }

  private _dispatchCloseEvent() {
    this.dispatchEvent(
      new CustomEvent('popover-close', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleCloseClick(event: Event) {
    event.stopPropagation();
    this._close();
  }

  private _handlePopupClick(event: Event) {
    event.stopPropagation();
  }

  render() {
    return html`
      <div class="trigger-wrapper" @click=${this._handleTriggerClick}>
        <slot name="trigger"></slot>
      </div>
    `;
  }
}
