/**
 * Icon picker component (V2).
 *
 * A dropdown button that lets the user pick from a grid of available SVG icons.
 * Modeled after <t-color-picker>.
 *
 * Events (bubbles, composed):
 *   - `change`: detail = { value: string } — the selected icon name ('' for none)
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './t-dropdown-button.js';
import './t-icon.js';
import './t-butt.js';
import type { DropdownButton } from './t-dropdown-button.js';

/** All available icon names (matching filenames in assets/icons/ without .svg). */
export const AVAILABLE_ICONS: string[] = [
  'group-plus',
  'note',
  'note-plus',
  'note-search',
  'notes-plus',
  'notes-search',
  'marker',
  'marker-plus',
  'edit',
  'delete',
  'share',
  'sort',
  'chevron-up',
  'chevron-down',
  'play',
  'pause',
  'pause-before',
  'stop-here',
  'speed',
  'volume',
  'time',
  'wait-between',
  'reset',
  'disable',
  'rotate',
  'rotate-flat',
];

/** Human-readable label for each icon (capitalized, dashes → spaces). */
function iconLabel(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

@customElement('t-icon-picker')
export class TIconPicker extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-size: 16px;
    }

    .icon-picker-wrapper {
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

    .trigger-content .icon-preview {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .trigger-content .icon-preview.no-icon {
      opacity: 0.35;
    }

    .trigger-content .icon-name {
      flex: 1;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    label {
      font-family: sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: var(--on-secondary-color, rgb(50, 50, 50));
      margin-bottom: 2px;
    }

    .icon-grid {
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

    .icon-grid .no-icon-option {
      grid-column: 1 / -1;
      justify-self: stretch;
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

    .icon-option {
      width: 48px;
      height: 48px;
      border: 2px solid transparent;
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
      background-color: var(--text-area, lightblue);
      padding: 4px;
    }

    .icon-option:hover {
      transform: translateY(-1px);
      border-color: var(--theme-color, #003366);
      box-shadow: 0 0 0 1px var(--theme-color, #003366);
    }

    .icon-option.selected {
      border-color: var(--accent-color-1, #431c5d);
      box-shadow: 0 0 0 2px var(--accent-color-1, #431c5d);
    }

    .icon-option.selected::after {
      content: '✓';
      position: absolute;
      top: -6px;
      right: -6px;
      font-size: 12px;
      font-weight: bold;
      color: var(--accent-color-1, #431c5d);
      background: var(--on-theme-color, #fff);
      border-radius: 50%;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    .no-icon-option.selected::after {
      right: 10px;
    }

    .icon-option:focus,
    .icon-option:focus-visible {
      outline: none;
      border-color: var(--accent-color-1, #431c5d);
      box-shadow: 0 0 0 2px var(--accent-color-1, #431c5d);
    }

    .helper-text {
      font-size: 12px;
      color: var(--on-gray-out, #595959);
      margin-top: 2px;
    }

    @media (min-width: 576px) {
      :host {
        font-size: 14px;
      }

      .trigger-content {
        font-size: 14px;
      }

      .icon-grid {
        gap: 6px;
        padding: 6px;
      }

      .icon-option {
        width: 44px;
        height: 44px;
      }

      label {
        font-size: 13px;
      }
    }
  `;

  @property({ type: String }) value = '';
  @property({ type: String }) label = '';
  @property({ type: String }) helperText = '';

  private _handleIconSelect(iconName: string) {
    this.value = iconName;
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: { value: iconName, name: iconName },
        bubbles: true,
        composed: true,
      })
    );

    // Close the dropdown after selection
    const dropdownButton = this.shadowRoot?.querySelector(
      't-dropdown-button'
    ) as DropdownButton | null;
    if (dropdownButton) {
      dropdownButton.open = false;
    }
  }

  private _getSelectedIcon(): string | undefined {
    if (!this.value) return undefined;
    return AVAILABLE_ICONS.find((name) => name === this.value);
  }

  render() {
    const selectedIcon = this._getSelectedIcon();

    return html`
      <div class="icon-picker-wrapper">
        ${this.label ? html` <label>${this.label}</label> ` : ''}

        <t-dropdown-button position="up">
          <t-butt class="trigger-button" slot="button" ellipsis>
            <span class="trigger-content">
              <span class="icon-preview ${!selectedIcon ? 'no-icon' : ''}">
                ${selectedIcon
                  ? html`<t-icon name=${selectedIcon}></t-icon>`
                  : html`<span style="font-size:18px; opacity:0.5;">?</span>`}
              </span>
              <span class="icon-name">${selectedIcon ? iconLabel(selectedIcon) : 'No icon'}</span>
            </span>
          </t-butt>

          <div class="icon-grid" slot="dropdown">
            <!-- No icon option -->
            <div
              class="no-icon-option ${this.value === '' ? 'selected' : ''}"
              tabindex="0"
              role="button"
              aria-label="No icon"
              aria-selected="${this.value === ''}"
              @click="${() => this._handleIconSelect('')}"
              @keydown="${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this._handleIconSelect('');
                }
              }}"
            >
              <span class="icon-preview no-icon" style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:16px; opacity:0.5;">?</span>
              </span>
              <span style="flex:1; text-align:left;">No icon</span>
            </div>

            <!-- Icon grid -->
            ${AVAILABLE_ICONS.map(
              (name) => html`
                <div
                  class="icon-option ${this.value === name ? 'selected' : ''}"
                  data-name="${name}"
                  title="${iconLabel(name)}"
                  tabindex="0"
                  role="button"
                  aria-label="${iconLabel(name)}"
                  aria-selected="${this.value === name}"
                  @click="${() => this._handleIconSelect(name)}"
                  @keydown="${(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      this._handleIconSelect(name);
                    }
                  }}"
                >
                  <t-icon name=${name}></t-icon>
                </div>
              `
            )}
          </div>
        </t-dropdown-button>

        ${this.helperText ? html` <div class="helper-text">${this.helperText}</div> ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-icon-picker': TIconPicker;
  }
}
