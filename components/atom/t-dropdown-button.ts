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
      background-color: var(--theme-color, #003366);
      border: 1px solid var(--on-theme-color, #ffffff);
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

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._handleDocumentClick.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._handleDocumentClick.bind(this));
  }

  private _handleDocumentClick(event: MouseEvent) {
    const target = event.target as Node;
    if (!this.contains(target) && this.open) {
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

  render() {
    return html`
      <div class="button-wrapper" @click=${this._handleButtonClick}>
        <slot name="button"></slot>
        <div class="dropdown" position=${this.position} align=${this.align} ?open=${this.open}>
          <slot name="dropdown"></slot>
        </div>
      </div>
    `;
  }
}
