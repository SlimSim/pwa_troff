import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';

export class TIcon extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 1em;
      height: 1em;
    }

    :host([label]) {
      width: auto;
      height: auto;
      min-width: 1em;
      min-height: 1.5em;
    }

    .icon-wrapper {
      font-size: 1.125rem;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1em;
      height: 1em;
    }

    .slim {
      font-size: 0.8rem;
    }

    .large {
      font-size: 1.875rem;
    }

    svg {
      width: 100%;
      height: 100%;
    }

    .label {
      font-size: 0.7em;
      line-height: 1;
      margin-top: 2px;
      color: inherit;
      font-weight: 500;
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
  @property({ type: String }) label = '';
  @property({ type: String }) unit = '';
  @property({ type: Boolean }) slim = false;
  @property({ type: Boolean }) large = false;

  private _svgContent = '';

  private _getClasses() {
    const classes = [];
    if (this.slim) {
      classes.push('slim');
    }
    if (this.large) {
      classes.push('large');
    }
    return classes.join(' ');
  }

  async updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('name') && this.name) {
      try {
        const response = await fetch(`/assets/icons/${this.name}.svg`);
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
        <div class="icon-wrapper">
          <svg
            class="spinner"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" stroke-dasharray="10" stroke-linecap="round" />
          </svg>
        </div>
        ${this.label || this.unit ? html`<div class="label">${this.label}${this.unit}</div>` : ''}
      `;
    }

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(this._svgContent, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    return html`
      <div class="icon-wrapper ${this._getClasses()}">${svgElement}</div>
      ${this.label || this.unit ? html`<div class="label">${this.label}${this.unit}</div>` : ''}
    `;
  }
}

customElements.define('t-icon', TIcon);
