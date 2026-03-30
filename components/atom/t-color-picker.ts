import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { MARKER_COLORS } from '../../constants/constants.js';

@customElement('t-color-picker')
export class TColorPicker extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-size: 16px; /* Mobile-first base font size */
    }

    .color-picker-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    label {
      font-family: sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: var(--on-secondary-color, rgb(50, 50, 50));
      margin-bottom: 2px;
    }

    .color-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
      gap: 8px;
      padding: 8px;
      background-color: var(--secondary-color, #e6e9f0);
      border-radius: var(--button-border-radius, 0);
      border: 1px solid var(--secondary-color, #e6e9f0);
    }

    .color-option {
      width: 40px;
      height: 40px;
      border: 2px solid transparent;
      border-radius: var(--button-border-radius, 4px);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }

    .color-option:hover {
      transform: scale(1.1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .color-option.selected {
      border-color: var(--accent-color-1, #431c5d);
      box-shadow: 0 0 0 2px var(--accent-color-1, #431c5d);
    }

    .color-option.selected::after {
      content: '✓';
      position: absolute;
      font-size: 16px;
      font-weight: bold;
      color: var(--on-accent-color-1, white);
      text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
    }

    .color-option:focus {
      outline: none;
      border-color: var(--accent-color-1, #431c5d);
    }

    .selected-color-display {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background-color: var(--text-area, lightblue);
      border: 1px solid var(--secondary-color, #e6e9f0);
      border-radius: var(--button-border-radius, 0);
      font-family: sans-serif;
      font-size: 14px;
      color: var(--on-text-area, var(--on-secondary-color, rgb(50, 50, 50)));
    }

    .selected-color-preview {
      width: 24px;
      height: 24px;
      border-radius: var(--button-border-radius, 2px);
      border: 1px solid var(--secondary-color, #e6e9f0);
      flex-shrink: 0;
    }

    .helper-text {
      font-size: 12px;
      color: var(--on-gray-out, #595959);
      margin-top: 2px;
    }

    /* Mobile-first responsive adjustments */
    @media (min-width: 576px) {
      :host {
        font-size: 14px;
      }
      
      .color-grid {
        grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
        gap: 6px;
        padding: 6px;
      }
      
      .color-option {
        width: 36px;
        height: 36px;
      }
      
      label {
        font-size: 13px;
      }
    }

    /* Compact variant */
    .color-picker-wrapper.compact .color-grid {
      grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
      gap: 4px;
      padding: 4px;
    }

    .color-picker-wrapper.compact .color-option {
      width: 32px;
      height: 32px;
    }

    .color-picker-wrapper.compact .color-option.selected::after {
      font-size: 14px;
    }

    /* List variant */
    .color-picker-wrapper.list .color-grid {
      grid-template-columns: 1fr;
      gap: 4px;
      padding: 4px;
    }

    .color-picker-wrapper.list .color-option {
      width: 100%;
      height: 32px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      gap: 8px;
    }

    .color-picker-wrapper.list .color-option::before {
      content: '';
      width: 20px;
      height: 20px;
      border-radius: var(--button-border-radius, 2px);
      border: 1px solid var(--secondary-color, #e6e9f0);
      flex-shrink: 0;
    }

    .color-picker-wrapper.list .color-option::after {
      content: attr(data-name);
      font-family: sans-serif;
      font-size: 12px;
      color: inherit;
      position: static;
      text-shadow: none;
    }

    .color-picker-wrapper.list .color-option.selected {
      border-color: var(--accent-color-1, #431c5d);
    }

    .color-picker-wrapper.list .color-option.selected::before {
      background-color: inherit;
    }
  `;

  @property({ type: String }) value = '';
  @property({ type: String }) label = '';
  @property({ type: String }) helperText = '';
  @property({ type: Boolean }) compact = false;
  @property({ type: Boolean }) list = false;
  @property({ type: Array }) colors = MARKER_COLORS;

  private _handleColorSelect(color: { name: string; color: string; onColor: string }) {
    this.value = color.color;
    this.dispatchEvent(new CustomEvent('change', {
      detail: { 
        value: color.color,
        name: color.name,
        onColor: color.onColor,
        color: color
      },
      bubbles: true,
      composed: true
    }));
  }

  private _getSelectedColor() {
    return this.colors.find(c => c.color === this.value);
  }

  private _getWrapperClasses() {
    const classes = ['color-picker-wrapper'];
    if (this.compact) classes.push('compact');
    if (this.list) classes.push('list');
    return classes.join(' ');
  }

  render() {
    const selectedColor = this._getSelectedColor();

    return html`
      <div class="${this._getWrapperClasses()}">
        ${this.label ? html`
          <label>${this.label}</label>
        ` : ''}
        
        <div class="color-grid">
          ${this.colors.map(color => html`
            <div
              class="color-option ${this.value === color.color ? 'selected' : ''}"
              style="background-color: ${color.color}; color: ${color.onColor}"
              data-name="${color.name}"
              tabindex="0"
              role="button"
              aria-label="${color.name}"
              aria-selected="${this.value === color.color}"
              @click="${() => this._handleColorSelect(color)}"
              @keydown="${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this._handleColorSelect(color);
                }
              }}"
            ></div>
          `)}
        </div>

        ${selectedColor && !this.list ? html`
          <div class="selected-color-display">
            <div 
              class="selected-color-preview" 
              style="background-color: ${selectedColor.color};"
            ></div>
            <span>${selectedColor.name}</span>
          </div>
        ` : ''}

        ${this.helperText ? html`
          <div class="helper-text">
            ${this.helperText}
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-color-picker': TColorPicker;
  }
}
