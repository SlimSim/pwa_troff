import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('t-textarea')
export class TTextarea extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-size: 16px; /* Mobile-first base font size */
    }

    .textarea-wrapper {
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

    textarea {
      width: 100%;
      min-height: 120px; /* Mobile-friendly default height */
      padding: 12px;
      border: 1px solid var(--secondary-color, #e6e9f0);
      border-radius: var(--button-border-radius, 0);
      background-color: var(--text-area, lightblue);
      color: var(--on-text-area, var(--on-secondary-color, rgb(50, 50, 50)));
      font-family: sans-serif;
      font-size: 16px; /* Prevent zoom on iOS */
      line-height: 1.5;
      resize: vertical;
      box-sizing: border-box;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    textarea:focus {
      outline: none;
      border-color: var(--accent-color-1, #431c5d);
      box-shadow: 0 0 0 2px var(--accent-color-1, #431c5d);
    }

    textarea:disabled {
      background-color: var(--gray-out, lightgray);
      color: var(--on-gray-out, #595959);
      cursor: not-allowed;
      opacity: 0.7;
      resize: none;
    }

    textarea::placeholder {
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

    .character-count {
      font-size: 11px;
      color: var(--on-gray-out, #595959);
      text-align: right;
      margin-top: 2px;
    }

    .character-count.warning {
      color: var(--accent-color-3, #787b1e);
    }

    .character-count.error {
      color: var(--accent-color-2, #dd2c00);
    }

    /* Mobile-first responsive adjustments */
    @media (min-width: 576px) {
      :host {
        font-size: 14px;
      }
      
      textarea {
        min-height: 100px;
        padding: 10px;
        font-size: 14px;
      }
      
      label {
        font-size: 13px;
      }
    }

    /* Variant styles */
    .textarea-wrapper.compact textarea {
      min-height: 80px;
      padding: 8px;
      font-size: 14px;
    }

    .textarea-wrapper.underline textarea {
      border: none;
      border-bottom: 2px solid var(--secondary-color, #e6e9f0);
      border-radius: 0;
      background-color: transparent;
    }

    .textarea-wrapper.underline textarea:focus {
      border-bottom-color: var(--accent-color-1, #431c5d);
    }

    .textarea-wrapper.no-resize textarea {
      resize: none;
    }

    /* Auto-resize functionality */
    .textarea-wrapper.auto-resize textarea {
      resize: none;
      overflow: hidden;
    }
  `;

  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) label = '';
  @property({ type: String }) helperText = '';
  @property({ type: String }) errorMessage = '';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) readonly = false;
  @property({ type: Boolean }) compact = false;
  @property({ type: Boolean }) underline = false;
  @property({ type: Boolean }) noResize = false;
  @property({ type: Boolean }) autoResize = false;
  @property({ type: Boolean }) showCharCount = false;
  @property({ type: Number }) maxlength = 0;
  @property({ type: Number }) minlength = 0;
  @property({ type: String }) name = '';
  @property({ type: String }) id = '';
  @property({ type: String }) rows = '4';
  @property({ type: String }) cols = '';

  @query('textarea') private _textarea!: HTMLTextAreaElement;

  private _generateId() {
    return `t-textarea-${Math.random().toString(36).substr(2, 9)}`;
  }

  private _handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.value = target.value;
    
    if (this.autoResize) {
      this._autoResize();
    }
    
    this.dispatchEvent(new CustomEvent('input', {
      detail: { value: this.value, event },
      bubbles: true,
      composed: true
    }));
  }

  private _handleChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.value = target.value;
    this.dispatchEvent(new CustomEvent('change', {
      detail: { value: this.value, event },
      bubbles: true,
      composed: true
    }));
  }

  private _handleFocus(event: FocusEvent) {
    this.dispatchEvent(new CustomEvent('focus', {
      detail: { event },
      bubbles: true,
      composed: true
    }));
  }

  private _handleBlur(event: FocusEvent) {
    this.dispatchEvent(new CustomEvent('blur', {
      detail: { event },
      bubbles: true,
      composed: true
    }));
  }

  private _autoResize() {
    if (this._textarea) {
      this._textarea.style.height = 'auto';
      this._textarea.style.height = this._textarea.scrollHeight + 'px';
    }
  }

  private _getWrapperClasses() {
    const classes = ['textarea-wrapper'];
    if (this.compact) classes.push('compact');
    if (this.underline) classes.push('underline');
    if (this.noResize) classes.push('no-resize');
    if (this.autoResize) classes.push('auto-resize');
    return classes.join(' ');
  }

  private _getCharacterCountClass() {
    if (!this.showCharCount || this.maxlength === 0) return '';
    
    const remaining = this.maxlength - this.value.length;
    if (remaining <= 0) return 'error';
    if (remaining <= this.maxlength * 0.1) return 'warning';
    return '';
  }

  focus() {
    this._textarea?.focus();
  }

  blur() {
    this._textarea?.blur();
  }

  select() {
    this._textarea?.select();
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    
    if (this.autoResize && changedProperties.has('value')) {
      this._autoResize();
    }
  }

  render() {
    const textareaId = this.id || this._generateId();
    const hasError = this.errorMessage && !this.disabled;
    const characterCount = this.showCharCount && this.maxlength > 0 
      ? `${this.value.length}/${this.maxlength}` 
      : '';

    return html`
      <div class="${this._getWrapperClasses()}">
        ${this.label ? html`
          <label for="${textareaId}">
            ${this.label}${this.required ? ' *' : ''}
          </label>
        ` : ''}
        
        <textarea
          id="${textareaId}"
          value="${this.value}"
          placeholder="${this.placeholder}"
          ?disabled="${this.disabled}"
          ?required="${this.required}"
          ?readonly="${this.readonly}"
          name="${this.name}"
          rows="${this.rows}"
          cols="${this.cols}"
          maxlength="${this.maxlength > 0 ? this.maxlength : ''}"
          minlength="${this.minlength > 0 ? this.minlength : ''}"
          aria-invalid="${hasError}"
          aria-describedby="${hasError ? `${textareaId}-error` : ''} ${this.helperText ? `${textareaId}-helper` : ''} ${characterCount ? `${textareaId}-count` : ''}"
          @input="${this._handleInput}"
          @change="${this._handleChange}"
          @focus="${this._handleFocus}"
          @blur="${this._handleBlur}"
        >${this.value}</textarea>

        ${hasError ? html`
          <div id="${textareaId}-error" class="error-message" role="alert">
            ${this.errorMessage}
          </div>
        ` : ''}

        ${this.helperText && !hasError ? html`
          <div id="${textareaId}-helper" class="helper-text">
            ${this.helperText}
          </div>
        ` : ''}

        ${characterCount ? html`
          <div id="${textareaId}-count" class="character-count ${this._getCharacterCountClass()}">
            ${characterCount}
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-textarea': TTextarea;
  }
}
