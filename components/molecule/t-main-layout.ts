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
      min-width: 0;
    }

    /* Left sidebar for current song controls on wide screens */
    .sidebar {
      display: none;
      flex-direction: column;
      flex-shrink: 0;
      width: 275px;
      max-width: 100%;
      border-right: 1px solid var(--border-color, #333);
      background-color: var(--tertiary-color);
      overflow-y: auto;
    }

    /* Responsive: show sidebar on wide screens */
    @media (min-width: 768px) {
      .sidebar {
        display: flex;
      }
    }
  `;

  render() {
    return html`
      <slot name="header"></slot>
      <div class="main-content-parent">
        <slot name="song-list"></slot>
        <!-- Left sidebar for current song controls (visible on wide screens) -->
        <aside class="sidebar" aria-label="Current song controls">
          <slot name="sidebar"></slot>
        </aside>
        <div class="main-content">
          <slot name="main-content"></slot>
        </div>
        <slot name="settings-panel"></slot>
      </div>
      <slot name="footer"></slot>
    `;
  }
}
