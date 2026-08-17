/**
 * Share song dialog: confirms the upload, shows upload progress and presents
 * the resulting shareable link.
 *
 * Events (bubbles, composed):
 *   - `share-confirmed`: fired when the user clicks "Upload song"
 *   - `dialog-cancelled`: fired when the dialog is closed/cancelled
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';

@customElement('t-share-song-dialog')
export class ShareSongDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* Overlay */
    .overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 10000;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .overlay.open {
      display: flex;
    }

    /* Dialog box */
    .dialog {
      background: var(--on-theme-color, #fff);
      color: var(--theme-color, #000);
      border-radius: 8px;
      width: 100%;
      max-width: 520px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .dialog-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .dialog-body {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 1;
      overflow-y: auto;
    }

    .info-text {
      font-size: 0.85rem;
      opacity: 0.8;
      line-height: 1.5;
    }

    .verify-list {
      font-size: 0.85rem;
      opacity: 0.8;
      line-height: 1.5;
      margin: 0;
      padding-left: 20px;
    }

    .verify-list a {
      color: var(--theme-color, #003366);
    }

    .song-name {
      font-weight: 600;
    }

    .share-url-input {
      width: 100%;
      padding: 12px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      font-size: 0.8rem;
      box-sizing: border-box;
      background: var(--text-area, #f5f5f5);
      color: var(--on-text-area, #000);
    }

    .button-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .btn-primary {
      --butt-bg-color: var(--theme-color, #003366);
    }

    .progress-bar-outer {
      width: 100%;
      height: 8px;
      background: var(--gray-out, #e0e0e0);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar-inner {
      height: 100%;
      background: var(--accent-color-1, #431c5d);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .progress-pct {
      text-align: right;
      font-size: 0.85rem;
      opacity: 0.8;
    }

    @media (min-width: 576px) {
      .dialog {
        max-width: 600px;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) songName = '';
  @property({ type: String }) shareUrl = '';
  @property({ type: Boolean }) alreadyUploaded = false;
  @property({ type: String }) state: 'confirm' | 'uploading' | 'done' = 'confirm';
  @property({ type: Number }) progress = 0;

  private _handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget && this.state !== 'uploading') {
      this._cancel();
    }
  }

  private _cancel() {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('dialog-cancelled', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleUploadClick() {
    this.dispatchEvent(
      new CustomEvent('share-confirmed', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _copyShareUrl() {
    void navigator.clipboard.writeText(this.shareUrl);
  }

  private _renderConfirm() {
    return html`
      <p class="info-text">By uploading this content you verify that:</p>
      <ul class="verify-list">
        <li>The content does not violate any law</li>
        <li>You have the right to submit the content to Troff</li>
        <li>
          You agree to, and the content does not violate, our
          <a target="_blank" rel="noopener" href="/terms.html">terms and conditions</a>
        </li>
      </ul>
      <p class="info-text">
        Note: Your song will be visible for others to find. If you do not want to have your song
        and your markers public, please contact slimsimapps@gmail.com before you upload.
      </p>
      <div class="button-group">
        <t-butt @click=${this._cancel}>Cancel</t-butt>
        <t-butt class="btn-primary" @click=${this._handleUploadClick}>Upload song</t-butt>
      </div>
    `;
  }

  private _renderUploading() {
    return html`
      <p class="info-text">Uploading your song and markers…</p>
      <div class="progress-bar-outer">
        <div class="progress-bar-inner" style="width: ${Math.round(this.progress)}%"></div>
      </div>
      <div class="progress-pct">${Math.round(this.progress)}%</div>
    `;
  }

  private _renderDone() {
    return html`
      <p class="info-text">
        Your song <span class="song-name">${this.songName}</span> is ready to share:
      </p>
      <input class="share-url-input" readonly .value=${this.shareUrl} aria-label="Share URL" />
      <div class="button-group">
        <t-butt class="copy-url-button" @click=${this._copyShareUrl}>Copy URL</t-butt>
        <t-butt @click=${this._cancel}>Close</t-butt>
      </div>
    `;
  }

  private _getTitle() {
    if (this.state === 'uploading') {
      return 'Upload in progress';
    }
    if (this.state === 'done') {
      return this.alreadyUploaded ? 'Song already uploaded' : 'Upload complete';
    }
    return 'Upload Song';
  }

  render() {
    return html`
      <div class="overlay ${this.open ? 'open' : ''}" @click=${this._handleOverlayClick}>
        <div class="dialog">
          <div class="dialog-header">
            <h2 class="dialog-title">${this._getTitle()}</h2>
          </div>
          <div class="dialog-body">
            ${this.state === 'uploading'
              ? this._renderUploading()
              : this.state === 'done'
                ? this._renderDone()
                : this._renderConfirm()}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-share-song-dialog': ShareSongDialog;
  }
}