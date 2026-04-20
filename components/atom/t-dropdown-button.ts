import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

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
      position: absolute;
      background-color: var(--secondary-color);
      color: var(--on-secondary-color);
      border: 2px solid var(--theme-color);
      border-radius: 4px;
      z-index: 1000;
      min-width: 180px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      visibility: hidden;
      opacity: 0;
      transition:
        opacity 0.2s ease,
        visibility 0.2s ease;
    }

    .dropdown[position='down'][align='right'] {
      top: 100%;
      right: 0;
      margin-top: 4px;
    }

    .dropdown[position='down'][align='left'] {
      top: 100%;
      left: 0;
      margin-top: 4px;
    }

    .dropdown[position='up'][align='right'] {
      bottom: 100%;
      right: 0;
      margin-bottom: 4px;
    }

    .dropdown[position='up'][align='left'] {
      bottom: 100%;
      left: 0;
      margin-bottom: 4px;
    }

    .dropdown[open] {
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

  private _boundHandleDocumentClick!: (event: MouseEvent) => void;

  connectedCallback() {
    super.connectedCallback();
    this._boundHandleDocumentClick = this._handleDocumentClick.bind(this);
    document.addEventListener('mousedown', this._boundHandleDocumentClick, { capture: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousedown', this._boundHandleDocumentClick, { capture: true });
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
    if (!this.open) {
      this.open = true;
      this.dispatchEvent(
        new CustomEvent('dropdown-toggled', {
          detail: { open: this.open },
          bubbles: true,
          composed: true,
        })
      );
    }
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
