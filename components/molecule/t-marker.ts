import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import '../atom/t-popover.js';
import { formatDuration } from '../../utils/formatters.js';
import { getBgColor } from '../../utils/colorHelpers.js';

export interface MarkerData {
  id?: string;
  name?: string;
  info?: string;
  time?: number;
  label: string;
  value: number;
  color?: string;
  textColor?: string;
}

@customElement('t-marker')
export class Marker extends LitElement {
  static styles = css`
    :host {
      display: block;
      transform: translateY(-50%);
      max-width: 100%;
    }

    .info-button {
      display: flex;
      z-index: 99;
    }

    .marker-row {
      display: flex;
      align-items: center;
      gap: var(--marker-gap);
      padding-right: var(--marker-gap);
      width: 100%;
      box-sizing: border-box;
      border-radius: var(--button-border-radius);
      background-color: var(--marker-bg-color, transparent);
    }

    .time-stamp {
      font-size: 0.9rem;
      font-family: monospace;
      color: var(--marker-on-color, inherit);
    }

    .marker-name-button {
      white-space: nowrap;
      overflow: hidden;
    }
  `;

  @property({ type: Object }) marker: MarkerData = { label: '', value: 0 };
  @property({ type: Boolean }) startActive = false;
  @property({ type: Boolean }) stopActive = false;

  private _boundary: Element | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._boundary = this.parentElement?.closest('.presets-container') ?? null;
  }



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

  private _handlePopoverOpened() {
    this.dispatchEvent(
      new CustomEvent('marker-info-click', {
        detail: { marker: this.marker },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _getMarkerRowStyle(): string {
    const markerColor = getBgColor(this.marker.color);

    if (!markerColor.color) {
      if (!this.marker.textColor) {
        return '';
      }

      return `--marker-on-color: ${this.marker.textColor};`;
    }

    return `--marker-bg-color: ${markerColor.color}; --marker-on-color: ${markerColor.onColor};`;
  }

  render() {
    const hasInfo = Boolean(this.marker.info && this.marker.info.trim());

    return html`
      <div class="marker-row" style=${this._getMarkerRowStyle()}>
        <!-- Edit button -->
        <t-butt ghost slim @click=${this._handleEdit} title="Edit marker"
          ><t-icon slim name="edit"></t-icon>
        </t-butt>

        <!-- Time stamp -->
        <div class="time-stamp">${formatDuration(this.marker.value)}</div>

        <!-- Marker name button -->
        <t-butt
          slim
          ghost
          ellipsis
          class="marker-name-button"
          .active=${this.startActive}
          @click=${this._handleMarkerClick}
          title=${this.marker.label}
        >
          ${this.marker.label}
        </t-butt>

        <!-- Stop button -->
        <t-butt
          slim
          ghost
          class="stop-button"
          .active=${this.stopActive}
          @click=${this._handleStop}
          title="Stop at marker"
        >
          <t-icon slim name="stop-here"></t-icon>
        </t-butt>

        ${hasInfo
          ? html`
              <!-- Info popover -->
              <t-popover
                .header=${this.marker.label || this.marker.name || 'Marker Info'}
                .body=${this.marker.info}
                .boundary=${this._boundary}
                @popover-opened=${this._handlePopoverOpened}
              >
                <t-butt
                  slot="trigger"
                  slim
                  ghost
                  class="info-button"
                  title=${this.marker.info || 'Marker info'}
                >
                  <t-icon slim name="info"></t-icon>
                </t-butt>
              </t-popover>
            `
          : ''}
      </div>
    `;
  }
}
