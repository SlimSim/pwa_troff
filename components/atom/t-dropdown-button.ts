import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { computePopupPosition } from '../../utils/popupPosition.js';
import type { PopupPositionInput } from '../../utils/popupPosition.js';

@customElement('t-dropdown-button')
export class DropdownButton extends LitElement {
  static styles = css`
    :host {
      position: relative;
      display: inline-block;
    }

    .button-wrapper {
      position: relative;
    }

    .dropdown {
      display: none;
      position: fixed;
      background-color: var(--secondary-color);
      color: var(--on-secondary-color);
      border: 2px solid var(--on-body-background);
      border-radius: 4px;
      z-index: 20000;
      min-width: 180px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      visibility: hidden;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .dropdown[open] {
      display: block;
      visibility: visible;
      opacity: 1;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .dropdown {
        min-width: 160px;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) position = 'down';
  @property({ type: String }) align = 'right';
  @property({ type: String }) mobilePosition = 'auto';

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
    this._positionDropdown();
  }

  private _positionDropdown() {
    const buttonWrapper = this.shadowRoot?.querySelector('.button-wrapper') as HTMLElement | null;
    const dropdown = this.shadowRoot?.querySelector('.dropdown') as HTMLElement | null;
    if (!buttonWrapper || !dropdown) return;

    const rect = buttonWrapper.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;
    const useTopPosition = this.mobilePosition === 'top' && isMobile;

    // Reset offsets so the fixed dropdown is measured at its natural size
    // (left+right or top+bottom set together would stretch it), then let the
    // shared popover positioning logic pick the best side and clamp on-screen.
    dropdown.style.top = '0px';
    dropdown.style.left = '0px';
    dropdown.style.bottom = 'auto';
    dropdown.style.right = 'auto';

    const { top, left } = computePopupPosition({
      triggerRect: rect as PopupPositionInput['triggerRect'],
      popupWidth: dropdown.offsetWidth,
      popupHeight: dropdown.offsetHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      preferSide: this.position === 'up' ? 'up' : 'down',
      horizontalAlign: this.align === 'left' ? 'left' : 'right',
    });

    // At top:0/left:0, a transformed containing block makes the fixed dropdown's
    // getBoundingClientRect() return that box's origin in viewport coordinates.
    // Subtracting it converts the computed viewport coords into the containing
    // block's coordinate space (no-op when there is no transformed ancestor).
    const dropRect = dropdown.getBoundingClientRect();

    if (useTopPosition) {
      // Mobile: anchor the dropdown to the top of the viewport and center it
      // horizontally on the screen.
      const centeredLeft = (window.innerWidth - dropdown.offsetWidth) / 2;
      dropdown.style.top = '8px';
      dropdown.style.left = `${Math.max(8, Math.min(centeredLeft, window.innerWidth - dropdown.offsetWidth - 8)) - dropRect.left}px`;
    } else {
      dropdown.style.top = `${top - dropRect.top}px`;
      dropdown.style.left = `${left - dropRect.left}px`;
    }
    dropdown.style.bottom = 'auto';
    dropdown.style.right = 'auto';
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      // Position immediately after render (works in tests and production)
      this._positionDropdown();
    }
  }

  private _handleDocumentClick(event: MouseEvent) {
    const path = event.composedPath();
    const isInside = path.includes(this);
    if (!isInside && this.open) {
      this.open = false;
    }
  }

  private _handleButtonClick(event: Event) {
    event.stopPropagation();
    this.open = !this.open;
    this.dispatchEvent(
      new CustomEvent('dropdown-toggled', {
        detail: { open: this.open },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleDropdownClick(event: Event) {
    event.stopPropagation();
  }

  render() {
    return html`
      <div class="button-wrapper" @click=${this._handleButtonClick}>
        <slot name="button"></slot>
        <div
          class="dropdown"
          position=${this.position}
          align=${this.align}
          ?open=${this.open}
          @click=${this._handleDropdownClick}
        >
          <slot name="dropdown"></slot>
        </div>
      </div>
    `;
  }
}
