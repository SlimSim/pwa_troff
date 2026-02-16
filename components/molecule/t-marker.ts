import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';
import { formatDuration } from '../../utils/formatters.js';

export interface MarkerData {
  label: string;
  value: number;
}

@customElement('t-marker')
export class Marker extends LitElement {
  static styles = css`
    :host {
      display: block;
      transform: translateY(50%);
      max-width: 100%;
    }

    .marker-row {
      display: flex;
      align-items: center;
      gap: var(--marker-gap);
      padding-right: var(--marker-gap);
      width: 100%;
      box-sizing: border-box;
    }

    .time-stamp {
      font-size: 0.9rem;
      font-family: monospace;
    }

    .marker-name-button {
      white-space: nowrap;
      overflow: hidden;
    }
  `;

  @property({ type: Object }) marker: MarkerData = { label: '', value: 0 };
  @property({ type: Boolean }) active = false;

  private _handleEdit() {
    this.dispatchEvent(
      new CustomEvent('marker-edit', {
        detail: { marker: this.marker },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleMarkerClick() {
    this.dispatchEvent(
      new CustomEvent('marker-click', {
        detail: { marker: this.marker },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleStop() {
    this.dispatchEvent(
      new CustomEvent('marker-stop', {
        detail: { marker: this.marker },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="marker-row">
        <!-- Edit button -->
        <t-butt @click=${this._handleEdit} title="Edit marker"
          ><t-icon name="edit"></t-icon>
        </t-butt>

        <!-- Time stamp -->
        <div class="time-stamp">${formatDuration(this.marker.value)}</div>

        <!-- Marker name button -->
        <t-butt
          ellipsis
          class="marker-name-button"
          .active=${this.active}
          @click=${this._handleMarkerClick}
          title=${this.marker.label}
        >
          ${this.marker.label}
        </t-butt>

        <!-- Stop button -->
        <t-butt class="stop-button" @click=${this._handleStop} title="Stop at marker">
          <t-icon name="stop-here"></t-icon>
        </t-butt>
      </div>
    `;
  }
}
