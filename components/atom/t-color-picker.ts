import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { MARKER_COLORS } from '../../constants/constants.js';
import { DropdownButton } from './t-dropdown-button.js';
import './t-dropdown-button.js';
import './t-butt.js';

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

    t-dropdown-button {
      display: block;
      width: 100%;
    }

    .trigger-button {
      display: block;
      width: 100%;
    }

    .trigger-content {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 28px;
      font-family: sans-serif;
      font-size: 16px;
      color: var(--on-regular-buton-color, var(--on-secondary-color, rgb(50, 50, 50)));
      box-sizing: border-box;
    }

    .trigger-content .color-preview {
      width: 24px;
      height: 24px;
      border-radius: var(--button-border-radius, 2px);
      border: 1px solid var(--secondary-color, #e6e9f0);
      flex-shrink: 0;
    }

    .trigger-content .no-color,
    .option-preview.no-color {
      background: repeating-linear-gradient(
        45deg,
        var(--gray-out, #ccc),
        var(--gray-out, #ccc) 3px,
        var(--text-area, #fff) 3px,
        var(--text-area, #fff) 6px
      );
    }

    .trigger-content .color-name {
      flex: 1;
      text-align: left;
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
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      padding: 10px;
      background-color: var(--secondary-color, #e6e9f0);
      border-radius: var(--button-border-radius, 0);
      border: 1px solid var(--theme-color, #003366);
      max-height: 300px;
      overflow-y: auto;
      box-sizing: border-box;
    }

    .color-grid .no-color-option {
      grid-column: 1 / -1; /* Span all columns */
      justify-self: stretch; /* Stretch to full width */
      width: auto;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      padding: 0 12px;
      font-size: 14px;
      font-family: sans-serif;
      color: var(--on-secondary-color, rgb(50, 50, 50));
      background-color: var(--text-area, lightblue);
      border: 1px solid var(--secondary-color, #e6e9f0);
    }

    .option-preview {
      width: 20px;
      height: 20px;
      border-radius: var(--button-border-radius, 2px);
      border: 1px solid var(--secondary-color, #e6e9f0);
      flex-shrink: 0;
    }

    .option-label {
      flex: 1;
      text-align: left;
    }

    .color-option {
      width: 40px;
      height: 40px;
      border: 1px solid transparent;
      border-radius: var(--button-border-radius, 4px);
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.2s ease;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }

    .color-option:hover {
      transform: translateY(-1px);
      border-color: var(--theme-color, #003366);
      box-shadow: 0 0 0 1px var(--theme-color, #003366);
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
      color: currentColor;
      text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
      line-height: 1;
    }

    .no-color-option.selected::after {
      right: 10px;
    }

    .color-option:focus,
    .color-option:focus-visible {
      outline: none;
      border-color: var(--accent-color-1, #431c5d);
      box-shadow: 0 0 0 2px var(--accent-color-1, #431c5d);
    }

    .selected-color-display {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      min-height: 40px;
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

      .trigger-content {
        font-size: 14px;
      }

      .color-grid {
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
  @property({ type: Boolean }) dropdown = true;
  @property({ type: Array }) colors = [
    { name: 'No color', color: '', onColor: '#000' },
    ...MARKER_COLORS,
  ];

  private _handleColorSelect(color: { name: string; color: string; onColor: string }) {
    this.value = color.color;
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: {
          value: color.color,
          name: color.name,
          onColor: color.onColor,
          color: color,
        },
        bubbles: true,
        composed: true,
      })
    );

    // Close dropdown after selection
    const dropdownButton = this.shadowRoot?.querySelector(
      't-dropdown-button'
    ) as DropdownButton | null;
    if (dropdownButton) {
      dropdownButton.open = false;
    }
  }

  private _getSelectedColor() {
    if (this.value === '') {
      return { name: 'No color', color: '', onColor: '#000' };
    }
    return MARKER_COLORS.find((c) => c.color === this.value);
  }

  private _getNoColorOption() {
    return (
      this.colors.find((color) => color.color === '') ?? {
        name: 'No color',
        color: '',
        onColor: '#000',
      }
    );
  }

  private _getWrapperClasses() {
    const classes = ['color-picker-wrapper'];
    if (this.compact) classes.push('compact');
    if (this.list) classes.push('list');
    return classes.join(' ');
  }

  render() {
    const selectedColor = this._getSelectedColor();
    const noColorOption = this._getNoColorOption();

    if (this.dropdown) {
      return html`
        <div class="color-picker-wrapper">
          ${this.label ? html` <label>${this.label}</label> ` : ''}

          <t-dropdown-button position="up">
            <t-butt class="trigger-button" slot="button" ellipsis>
              <span class="trigger-content">
                <span
                  class="color-preview ${!selectedColor?.color ? 'no-color' : ''}"
                  style="background-color: ${selectedColor?.color || 'transparent'};"
                ></span>
                <span class="color-name">${selectedColor?.name || 'No color'}</span>
              </span>
            </t-butt>

            <div class="color-grid" slot="dropdown">
              <!-- No color option on separate row -->
              <div
                class="color-option no-color-option ${this.value === '' ? 'selected' : ''}"
                style="color: ${noColorOption.onColor}"
                data-name="${noColorOption.name}"
                tabindex="0"
                role="button"
                aria-label="${noColorOption.name}"
                aria-selected="${this.value === ''}"
                @click="${() => this._handleColorSelect(noColorOption)}"
                @keydown="${(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._handleColorSelect(noColorOption);
                  }
                }}"
              >
                <span class="option-preview no-color"></span>
                <span class="option-label">${noColorOption.name}</span>
              </div>

              <!-- Other colors in 5-column grid -->
              ${MARKER_COLORS.map(
                (color) => html`
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
                `
              )}
            </div>
          </t-dropdown-button>

          ${this.helperText ? html` <div class="helper-text">${this.helperText}</div> ` : ''}
        </div>
      `;
    }

    // Original layout for non-dropdown mode
    return html`
      <div class="${this._getWrapperClasses()}">
        ${this.label ? html` <label>${this.label}</label> ` : ''}

        <div class="color-grid">
          ${this.colors.map(
            (color) => html`
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
            `
          )}
        </div>

        ${selectedColor && !this.list
          ? html`
              <div class="selected-color-display">
                <div
                  class="selected-color-preview"
                  style="background-color: ${selectedColor.color};"
                ></div>
                <span>${selectedColor.name}</span>
              </div>
            `
          : ''}
        ${this.helperText ? html` <div class="helper-text">${this.helperText}</div> ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-color-picker': TColorPicker;
  }
}
