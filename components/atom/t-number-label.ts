import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('t-number-label')
export class NumberLabel extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .number-circle {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.55rem;
      color: var(--on-theme-color, #ffffff);
      font-weight: 500;
    }

    .number-circle.week {
      background-color: rgba(76, 175, 80, 0.4);
    }

    .number-circle.total {
      background-color: rgba(33, 150, 243, 0.4);
    }

    /* Mobile responsive adjustments */
    @media (min-width: 576px) {
      .number-circle {
        width: 22px;
        height: 22px;
        font-size: 0.65rem;
      }
    }
  `;

  @property({ type: String }) variant: 'week' | 'total' = 'week';
  @property({ type: Number }) value = 0;

  render() {
    return html`
      <div class="number-circle ${this.variant}">
        ${this.value}
      </div>
    `;
  }
}
