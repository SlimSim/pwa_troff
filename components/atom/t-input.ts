import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('t-input')
export class TInput extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-size: 16px; /* Mobile-first base font size */
    }

    .input-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    label {
      font-family: sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: var(--on-secondary-color, rgb(50, 50, 50));
      margin-bottom: 2px;
    }

    .input-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    input {
      width: 100%;
      min-height: 44px; /* Mobile-friendly touch target */
      padding: 8px 12px;
      border: 1px solid var(--secondary-color, #e6e9f0);
      border-radius: var(--button-border-radius, 0);
      background-color: var(--text-area, lightblue);
      color: var(--on-text-area, var(--on-secondary-color, rgb(50, 50, 50)));
      font-family: sans-serif;
      font-size: 16px; /* Prevent zoom on iOS */
      box-sizing: border-box;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    input:focus {
      outline: none;
      border-color: var(--accent-color-1, #431c5d);
      box-shadow: 0 0 0 2px var(--accent-color-1, #431c5d);
    }

    input:disabled {
      background-color: var(--gray-out, lightgray);
      color: var(--on-gray-out, #595959);
      cursor: not-allowed;
      opacity: 0.7;
    }

    input::placeholder {
      color: var(--on-gray-out, #595959);
      opacity: 0.7;
    }

    .error-message {
      font-size: 12px;
      color: var(--accent-color-2, #dd2c00);
      margin-top: 2px;
      min-height: 16px;
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

      input {
        min-height: 40px;
        padding: 6px 10px;
        font-size: 14px;
      }

      label {
        font-size: 13px;
      }
    }

    /* Variant styles */
    .input-wrapper.slim input {
      min-height: 32px;
      padding: 4px 8px;
      font-size: 14px;
    }

    .input-wrapper.underline input {
      border: none;
      border-bottom: 2px solid var(--secondary-color, #e6e9f0);
      border-radius: 0;
      background-color: transparent;
    }

    .input-wrapper.underline input:focus {
      border-bottom-color: var(--accent-color-1, #431c5d);
    }

    /* Icon support */
    .icon {
      position: absolute;
      width: 20px;
      height: 20px;
      color: var(--on-gray-out, #595959);
      pointer-events: none;
    }

    .icon-left {
      left: 12px;
    }

    .icon-right {
      right: 12px;
    }

    .input-wrapper.has-icon-left input {
      padding-left: 40px;
    }

    .input-wrapper.has-icon-right input {
      padding-right: 40px;
    }
  `;

  @property({ type: String }) type = 'text';
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) label = '';
  @property({ type: String }) helperText = '';
  @property({ type: String }) errorMessage = '';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) readonly = false;
  @property({ type: Boolean }) slim = false;
  @property({ type: Boolean }) underline = false;
  @property({ type: String }) name = '';
  @property({ type: String }) id = '';
  @property({ type: String }) autocomplete = '';
  @property({ type: String }) pattern = '';
  @property({ type: String }) minlength = '';
  @property({ type: String }) maxlength = '';
  @property({ type: String }) min = '';
  @property({ type: String }) max = '';
  @property({ type: String }) step = '';

  @query('input') private _input!: HTMLInputElement;

  private _generateId() {
    return `t-input-${Math.random().toString(36).substr(2, 9)}`;
  }

  private _handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.dispatchEvent(
      new CustomEvent('input', {
        detail: { value: this.value, event },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: { value: this.value, event },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleFocus(event: FocusEvent) {
    this.dispatchEvent(
      new CustomEvent('focus', {
        detail: { event },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleBlur(event: FocusEvent) {
    this.dispatchEvent(
      new CustomEvent('blur', {
        detail: { event },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _getWrapperClasses() {
    const classes = ['input-wrapper'];
    if (this.slim) classes.push('slim');
    if (this.underline) classes.push('underline');
    return classes.join(' ');
  }

  focus() {
    this._input?.focus();
  }

  blur() {
    this._input?.blur();
  }

  select() {
    this._input?.select();
  }

  render() {
    const inputId = this.id || this._generateId();
    const hasError = this.errorMessage && !this.disabled;

    return html`
      <div class="${this._getWrapperClasses()}">
        ${this.label
          ? html` <label for="${inputId}"> ${this.label}${this.required ? ' *' : ''} </label> `
          : ''}

        <div class="input-container">
          <input
            id="${inputId}"
            type="${this.type}"
            .value=${this.value}
            placeholder="${this.placeholder}"
            ?disabled="${this.disabled}"
            ?required="${this.required}"
            ?readonly="${this.readonly}"
            name="${this.name}"
            autocomplete="${this.autocomplete}"
            pattern="${this.pattern}"
            minlength="${this.minlength}"
            maxlength="${this.maxlength}"
            min="${this.min}"
            max="${this.max}"
            step="${this.step}"
            aria-invalid="${hasError}"
            aria-describedby="${hasError ? `${inputId}-error` : ''} ${this.helperText
              ? `${inputId}-helper`
              : ''}"
            @input="${this._handleInput}"
            @change="${this._handleChange}"
            @focus="${this._handleFocus}"
            @blur="${this._handleBlur}"
          />
        </div>

        ${hasError
          ? html`
              <div id="${inputId}-error" class="error-message" role="alert">
                ${this.errorMessage}
              </div>
            `
          : ''}
        ${this.helperText && !hasError
          ? html` <div id="${inputId}-helper" class="helper-text">${this.helperText}</div> `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-input': TInput;
  }
}
