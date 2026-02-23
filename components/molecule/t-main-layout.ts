import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('t-main-layout')
export class MainLayout extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      max-height: 100dvh;
      overflow: hidden;
      margin: 0;
      font-family: Arial, 'Open Sans', sans-serif;
    }

    .main-content-parent {
      position: relative;
      display: flex;
      flex: 1;
      overflow-y: hidden;
    }

    .main-content {
      overflow: auto;
      flex: 1;
      padding: 0;
    }
  `;

  render() {
    return html`
      <slot name="header"></slot>
      <div class="main-content-parent">
        <slot name="song-list"></slot>
        <div class="main-content">
          <slot name="main-content"></slot>
        </div>
        <slot name="settings-panel"></slot>
      </div>
      <slot name="footer"></slot>
    `;
  }
}
