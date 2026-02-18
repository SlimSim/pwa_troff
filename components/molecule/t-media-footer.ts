import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-button-group.js';

@customElement('t-media-footer')
export class MediaFooter extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: sticky;
      bottom: 0;
      background-color: var(--theme-color, #003366);
      color: var(--on-theme-color, #ffffff);
      z-index: 998;
      border-top: 1px solid var(--on-theme-color, #ffffff);
      box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.2);
    }

    .footer-container {
      padding: 8px 0;
    }

    /* Mobile responsive adjustments */
    @media (min-width: 576px) {
      .footer-container {
        padding: 12px 0;
      }
    }
  `;

  @property({ type: String }) selected: string = 'tracks';

  private filterOptions = [
    { id: 'tracks', label: 'Tracks' },
    { id: 'groups', label: 'Groups' },
    { id: 'artists', label: 'Artists' },
    { id: 'genre', label: 'Genre' },
  ];

  private _handleFilterSelected(event: CustomEvent) {
    this.selected = event.detail.selectedId;
    this.dispatchEvent(
      new CustomEvent('filter-changed', {
        detail: { filter: event.detail.selectedId },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="footer-container">
        <t-button-group
          .options=${this.filterOptions}
          .selected=${this.selected}
          @button-group-selected=${this._handleFilterSelected}
        ></t-button-group>
      </div>
    `;
  }
}
