import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import './t-loading.js';

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

    :host([fullSize]) .icon-wrapper {
      font-size: 100%;
    }

    .slim {
      font-size: 0.8rem;
    }

    .large {
      font-size: 1.5rem;
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
  `;

  @property({ type: String }) name = '';
  @property({ type: String }) label = '';
  @property({ type: String }) unit = '';
  @property({ type: Boolean }) slim = false;
  @property({ type: Boolean }) large = false;
  @property({ type: Boolean, reflect: true }) fullSize = false;

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
          <t-loading></t-loading>
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
