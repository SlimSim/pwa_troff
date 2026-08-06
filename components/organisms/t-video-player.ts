import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('t-video-player')
export class TVideoPlayer extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }
    :host([hidden]) {
      display: none;
    }
    .video-frame {
      position: relative;
      width: 100%;
      height: 100%;
      background: #000;
    }
    ::slotted(video) {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  render() {
    return html`<div class="video-frame"><slot></slot></div>`;
  }
}
