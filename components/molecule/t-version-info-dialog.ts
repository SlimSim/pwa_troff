import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import type { TroffMarker } from '../../types/troff.d.js';

/**
 * "More about this version" info for one server-song version: the version's
 * markers plus a download link for exactly this version (#id&fileNameUri).
 *
 * The host (t-server-song-list) decides when to mount it and feeds
 * fileNameUri / troffDataId / markers as properties.
 */
@customElement('t-version-info-dialog')
export class VersionInfoDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--on-primary-color);
    }

    .version-info {
      margin: 4px var(--container-padding-x) 8px;
      padding: 8px;
      border: 1px solid var(--list-border-color);
      border-radius: 4px;
      background-color: var(--list-hover-bg);
    }

    .version-info-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }

    .version-info-markers {
      list-style: none;
      margin: 8px 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .version-info-marker {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 0.9rem;
    }

    .version-info-marker-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .version-info-marker-time {
      color: var(--on-gray-out);
      white-space: nowrap;
    }
  `;

  @property({ type: String }) fileNameUri = '';
  @property({ type: Number }) troffDataId = 0;
  @property({ type: Array }) markers: TroffMarker[] = [];

  render() {
    return html`
      <div class="version-info">
        <div class="version-info-header">
          <t-icon name="info"></t-icon>
          <span>Version info</span>
        </div>
        <ul class="version-info-markers">
          ${this.markers.map(
            (marker) => html`
              <li class="version-info-marker">
                <span class="version-info-marker-name">${marker.name}</span>
                <span class="version-info-marker-time">${marker.time}</span>
              </li>
            `
          )}
        </ul>
        <t-butt class="version-info-download" href="#${this.troffDataId}&${this.fileNameUri}">
          <t-icon name="download-song"></t-icon>
          <span>Download this version</span>
        </t-butt>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-version-info-dialog': VersionInfoDialog;
  }
}
