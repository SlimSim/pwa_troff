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
      display: none;
      position: fixed;
      background-color: var(--secondary-color);
      color: var(--on-secondary-color);
      border: 2px solid var(--theme-color);
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

  private _boundHandleDocumentClick!: (event: MouseEvent) => void;
  private _boundHandleReposition!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._boundHandleDocumentClick = this._handleDocumentClick.bind(this);
    document.addEventListener('mousedown', this._boundHandleDocumentClick, { capture: true });
    this._boundHandleReposition = this._reposition.bind(this);
    window.addEventListener('scroll', this._boundHandleReposition, { capture: true });
    window.addEventListener('resize', this._boundHandleReposition);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousedown', this._boundHandleDocumentClick, { capture: true });
    window.removeEventListener('scroll', this._boundHandleReposition, { capture: true });
    window.removeEventListener('resize', this._boundHandleReposition);
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

    // Position vertically
    if (this.position === 'down') {
      dropdown.style.top = `${rect.bottom + 4}px`;
      dropdown.style.bottom = 'auto';
    } else {
      dropdown.style.top = 'auto';
      dropdown.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    }

    // Position horizontally
    if (this.align === 'right') {
      dropdown.style.left = 'auto';
      dropdown.style.right = `${window.innerWidth - rect.right}px`;
    } else {
      dropdown.style.left = `${rect.left}px`;
      dropdown.style.right = 'auto';
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      // Wait for render to complete, then position
      requestAnimationFrame(() => this._positionDropdown());
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
