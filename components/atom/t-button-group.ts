import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-butt.js';

interface ButtonOption {
  id: string;
  label: string;
}

@customElement('t-button-group')
export class ButtonGroup extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .button-group-container {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0 8px;
      scroll-behavior: smooth;
      /* Hide scrollbar while keeping functionality */
      scrollbar-width: none;
    }

    .button-group-container::-webkit-scrollbar {
      display: none;
    }

    /* Mobile responsive adjustments */
    @media (min-width: 576px) {
      .button-group-container {
        gap: 12px;
        padding: 0 12px;
      }
    }
  `;

  @property({ type: Array }) options: ButtonOption[] = [];
  @property({ type: String }) selected: string = '';

  private _handleButtonClick(optionId: string) {
    this.selected = optionId;
    this.dispatchEvent(
      new CustomEvent('button-group-selected', {
        detail: { selectedId: optionId },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="button-group-container">
        ${this.options.map(
          (option) => html`
            <t-butt
              @click=${() => this._handleButtonClick(option.id)}
              ?active=${this.selected === option.id}
            >
              ${option.label}
            </t-butt>
          `
        )}
      </div>
    `;
  }
}
