import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';

export class TIcon extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      width: 1em;
      height: 1em;
    }
    svg {
      width: 100%;
      height: 100%;
    }
    .spinner {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `;

  @property({ type: String }) name = '';

  private _svgContent = '';

  async updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('name') && this.name) {
      try {
        const response = await fetch(`assets/icons/${this.name}.svg`);
        if (response.ok) {
          this._svgContent = await response.text();
          this.requestUpdate();
        } else {
          console.warn(`Failed to load icon: ${this.name}`);
        }
      } catch (error) {
        console.error(`Error fetching icon: ${error}`);
      }
    }
  }

  render() {
    if (!this._svgContent) {
      return html`
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="10" stroke-linecap="round" />
        </svg>
      `;
    }
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(this._svgContent, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    return html`${svgElement}`;
  }
}

customElements.define('t-icon', TIcon);
