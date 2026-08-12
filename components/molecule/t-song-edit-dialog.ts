/**
 * Song edit dialog (V2).
 *
 * A modal overlay for editing a song's metadata (custom name, choreography,
 * choreographer, title, artist, album, genre, tags) and saving it back to nDB.
 * Pure UI component: it receives the song via properties (`songKey`, `songData`)
 * and reports results via events. Does NOT import nDB or Firebase — persistence
 * is the parent's job (v2Script.ts wiring).
 *
 * Events (bubbles, composed):
 *   - `song-saved`: detail = { songKey: string, fileData: TroffFileData-like }
 *   - `dialog-cancelled`: no detail
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { TroffFileData } from '../../types/troff.d.js';
import '../atom/t-input.js';
import '../atom/t-butt.js';

/** Editable fileData fields (v1 editSongDialog set, minus the readonly ones). */
type SongEditFields = Pick<
  TroffFileData,
  'customName' | 'choreography' | 'choreographer' | 'title' | 'artist' | 'album' | 'genre' | 'tags'
>;

@customElement('t-song-edit-dialog')
export class SongEditDialog extends LitElement {
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
      max-width: 480px;
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

    .dialog-footer {
      display: flex;
      gap: 8px;
      padding: 12px 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      justify-content: flex-end;
      flex-wrap: wrap;
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) songKey = '';
  /** Raw song object with `.fileData` — the source for prefilling the editable fields. */
  @property({ type: Object }) songData: { fileData: Partial<TroffFileData> } | null = null;

  // ── Internal editing state (cloned from `songData.fileData` when opened) ──

  @state() private _editFields: SongEditFields = {
    customName: '',
    choreography: '',
    choreographer: '',
    title: '',
    artist: '',
    album: '',
    genre: '',
    tags: '',
  };

  private _boundKeyHandler?: (event: KeyboardEvent) => void;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    super.connectedCallback();
    this._boundKeyHandler = (event: KeyboardEvent) => this._handleKeydown(event);
    document.addEventListener('keydown', this._boundKeyHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler);
      this._boundKeyHandler = undefined;
    }
  }

  protected override willUpdate(changedProperties: Map<string, unknown>) {
    super.willUpdate(changedProperties);
    if (changedProperties.has('open') && this.open) {
      this._prefillFromSongData();
    }
  }

  private _prefillFromSongData() {
    const fd: Partial<TroffFileData> = this.songData?.fileData ?? {};
    this._editFields = {
      customName: fd.customName ?? '',
      choreography: fd.choreography ?? '',
      choreographer: fd.choreographer ?? '',
      title: fd.title ?? '',
      artist: fd.artist ?? '',
      album: fd.album ?? '',
      genre: fd.genre ?? '',
      tags: fd.tags ?? '',
    };
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private _handleKeydown(event: KeyboardEvent) {
    if (!this.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this._cancel();
    }
  }

  private _handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
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

  private _save() {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('song-saved', {
        detail: { songKey: this.songKey, fileData: { ...this._editFields } },
        bubbles: true,
        composed: true,
      })
    );
  }

  // ── Field handler ──────────────────────────────────────────────────────────

  private _handleFieldInput(field: keyof SongEditFields, event: CustomEvent) {
    // Only accept the custom event from t-input (has detail.value);
    // ignore the native InputEvent that also bubbles through the shadow DOM.
    if (event.detail && typeof event.detail.value === 'string') {
      this._editFields = { ...this._editFields, [field]: event.detail.value };
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    const { customName, choreography, title } = this._editFields;
    const displayName = customName || choreography || title || this.songKey;

    return html`
      <div class="overlay ${this.open ? 'open' : ''}" @click=${this._handleOverlayClick}>
        <div class="dialog">
          <div class="dialog-header">
            <h2 class="dialog-title">Edit song</h2>
          </div>

          <div class="dialog-body">
            <t-input name="file" .value=${this.songKey} label="File" readonly></t-input>
            <t-input name="displayName" .value=${displayName} label="Display name" readonly></t-input>
            <t-input
              name="customName"
              .value=${this._editFields.customName}
              label="Custom name"
              @input=${(e: CustomEvent) => this._handleFieldInput('customName', e)}
            ></t-input>
            <t-input
              name="choreography"
              .value=${this._editFields.choreography}
              label="Choreography"
              @input=${(e: CustomEvent) => this._handleFieldInput('choreography', e)}
            ></t-input>
            <t-input
              name="choreographer"
              .value=${this._editFields.choreographer}
              label="Choreographer"
              @input=${(e: CustomEvent) => this._handleFieldInput('choreographer', e)}
            ></t-input>
            <t-input
              name="title"
              .value=${this._editFields.title}
              label="Title"
              @input=${(e: CustomEvent) => this._handleFieldInput('title', e)}
            ></t-input>
            <t-input
              name="artist"
              .value=${this._editFields.artist}
              label="Artist"
              @input=${(e: CustomEvent) => this._handleFieldInput('artist', e)}
            ></t-input>
            <t-input
              name="album"
              .value=${this._editFields.album}
              label="Album"
              @input=${(e: CustomEvent) => this._handleFieldInput('album', e)}
            ></t-input>
            <t-input
              name="genre"
              .value=${this._editFields.genre}
              label="Genre"
              @input=${(e: CustomEvent) => this._handleFieldInput('genre', e)}
            ></t-input>
            <t-input
              name="tags"
              .value=${this._editFields.tags}
              label="Tags"
              @input=${(e: CustomEvent) => this._handleFieldInput('tags', e)}
            ></t-input>
          </div>

          <div class="dialog-footer">
            <t-butt class="cancel-btn" @click=${this._cancel}>Cancel</t-butt>
            <t-butt class="save-btn" @click=${this._save}>Save</t-butt>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-song-edit-dialog': SongEditDialog;
  }
}
