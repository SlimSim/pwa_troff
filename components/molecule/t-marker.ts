import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';

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
    }

    .marker-row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 0 8px;
      box-sizing: border-box;
    }

    .time-stamp {
      font-size: 0.9rem;
      font-family: monospace;
    }

    .marker-name-button {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    .marker-name-button t-butt {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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

  private _formatTime(value: number): string {
    // Assuming value represents percentage (0-100) of song duration
    // For now, we'll format it as mm:ss based on a 4:20 song (260 seconds)
    const totalSeconds = 260; // 4:20 in seconds
    const currentSeconds = Math.round((value / 100) * totalSeconds);
    const minutes = Math.floor(currentSeconds / 60);
    const seconds = currentSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  render() {
    return html`
      <div class="marker-row">
        <!-- Edit button -->
        <t-butt @click=${this._handleEdit} title="Edit marker"
          ><t-icon name="edit"></t-icon>
        </t-butt>

        <!-- Time stamp -->
        <div class="time-stamp">${this._formatTime(this.marker.value)}</div>

        <!-- Marker name button -->
        <div class="marker-name-button">
          <t-butt
            .active=${this.active}
            @click=${this._handleMarkerClick}
            title=${this.marker.label}
          >
            ${this.marker.label}
          </t-butt>
        </div>

        <!-- Stop button -->
        <t-butt class="stop-button" @click=${this._handleStop} title="Stop at marker">
          <t-icon name="stop-here"></t-icon>
        </t-butt>
      </div>
    `;
  }
}
