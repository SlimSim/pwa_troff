import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import '../atom/t-loading.js';
import './t-version-info-dialog.js';
import { fetchServerTroffDataResult } from '../../utils/hash-download.js';
import { safeDecodeURIComponent } from '../../utils/utils.js';
import log from '../../utils/log.js';
import type { ServerSongTab } from '../../utils/server-song-list.js';
import type { ServerSong, TroffDataIdObject, TroffMarker } from '../../types/troff.d.js';

/**
 * "On Troff's server" — the server-side half of the merged song search.
 *
 * The parent filters the songs (see filterServerSongs) and passes them in;
 * this component only renders the section: one collapsible row per song,
 * version cards (download + "more about version") while expanded, a loading
 * state while the fetch is in flight, and an empty state when nothing on the
 * server matches. Nothing renders while the query is empty/whitespace.
 */
@customElement('t-server-song-list')
export class ServerSongList extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--on-primary-color);
    }

    .server-song-section {
      border-top: 1px solid var(--list-border-color);
    }

    .server-song-section-header {
      padding: 8px var(--container-padding-x);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .server-song-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px var(--container-padding-x);
      cursor: pointer;
      border-top: 1px solid var(--list-border-color);
    }

    .server-song-row:hover {
      background-color: var(--list-hover-bg);
    }

    .server-song-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .server-song-version-count {
      font-size: 0.8rem;
      color: var(--on-gray-out);
      white-space: nowrap;
    }

    .server-version-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px var(--container-padding-x) 12px calc(var(--container-padding-x) + 16px);
      background-color: var(--list-hover-bg);
      border-top: 1px solid var(--list-border-color);
    }

    .version-display-name {
      font-weight: 600;
    }

    .version-nr-markers,
    .version-uploaded,
    .version-genre-tags {
      font-size: 0.85rem;
      color: var(--on-gray-out);
    }

    .version-card-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }

    .server-song-empty {
      padding: 12px var(--container-padding-x);
      color: var(--on-gray-out);
    }

    .server-song-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px var(--container-padding-x);
    }
  `;

  /** Songs already filtered by the parent — see filterServerSongs. */
  @property({ type: Array }) songs: ServerSong[] = [];
  @property({ type: String }) query = '';
  @property({ type: String }) tab: ServerSongTab = 'tracks';
  @property({ type: Boolean }) loading = false;

  /** fileNameUri of the expanded song (accordion: one open at a time). */
  @state() private _expandedFileNameUri = '';
  /** Version currently shown in t-version-info-dialog (null = closed). */
  @state() private _infoTarget: { fileNameUri: string; troffDataId: number } | null = null;
  @state() private _infoMarkers: TroffMarker[] = [];

  render() {
    if (this.query.trim() === '') return html``;

    if (this.loading) {
      return html`
        <div class="server-song-loading">
          <t-loading label="Loading server songs"></t-loading>
          <span>Loading server songs…</span>
        </div>
      `;
    }

    return html`
      <div class="server-song-section">
        <div class="server-song-section-header">${this._headerText()}</div>
        ${this.songs.length === 0
          ? html`<div class="server-song-empty">
              No songs on Troff's server match "${this.query.trim()}".
            </div>`
          : this.songs.map((song) => this._renderSong(song))}
      </div>
      ${this._infoTarget
        ? html`
            <t-version-info-dialog
              .fileNameUri=${this._infoTarget.fileNameUri}
              .troffDataId=${this._infoTarget.troffDataId}
              .markers=${this._infoMarkers}
            ></t-version-info-dialog>
          `
        : ''}
    `;
  }

  private _headerText(): string {
    const query = this.query.trim();
    if (this.tab === 'artists') return `Songs by ${query} on Troff's server`;
    if (this.tab === 'genre') return `${query} songs on Troff's server`;
    return "On Troff's server";
  }

  private _renderSong(song: ServerSong) {
    const expanded = this._expandedFileNameUri === song.fileNameUri;
    const nrVersions = song.troffDataIdObjectList.length;

    return html`
      <div class="server-song-row" @click=${() => this._toggleExpanded(song.fileNameUri)}>
        <span class="server-song-name">${safeDecodeURIComponent(song.fileNameUri)}</span>
        <span class="server-song-version-count">
          ${nrVersions} ${nrVersions === 1 ? 'version' : 'versions'}
        </span>
        <t-icon name="${expanded ? 'chevron-up' : 'chevron-down'}"></t-icon>
      </div>
      ${expanded
        ? song.troffDataIdObjectList.map((version) => this._renderVersion(song, version))
        : ''}
    `;
  }

  private _renderVersion(song: ServerSong, version: TroffDataIdObject) {
    const genreTags = [version.genre, version.tags].filter((value) => value !== '').join(' · ');

    return html`
      <div class="server-version-card">
        <div class="version-display-name">${version.displayName}</div>
        <div class="version-nr-markers">${version.nrMarkers} markers</div>
        <div class="version-uploaded">${this._uploadedText(version.firstTimeLoaded)}</div>
        <div class="version-genre-tags">${genreTags}</div>
        <div class="version-card-actions">
          <t-butt
            class="download-version"
            href="#${version.troffDataId}&${song.fileNameUri}"
            @click=${(event: Event) => event.stopPropagation()}
          >
            <t-icon name="download-song"></t-icon>
            <span>Download</span>
          </t-butt>
          <t-butt
            class="more-about-version"
            @click=${(event: Event) => this._handleVersionInfoRequest(event, song, version)}
          >
            <t-icon name="info"></t-icon>
            <span>More</span>
          </t-butt>
        </div>
      </div>
    `;
  }

  private _toggleExpanded(fileNameUri: string) {
    this._expandedFileNameUri = this._expandedFileNameUri === fileNameUri ? '' : fileNameUri;
  }

  private _uploadedText(firstTimeLoaded: number): string {
    if (!firstTimeLoaded) return 'Unknown upload time';
    return `Uploaded ${new Date(firstTimeLoaded).toLocaleDateString()}`;
  }

  private _handleVersionInfoRequest(
    event: Event,
    song: ServerSong,
    version: TroffDataIdObject
  ) {
    // Keep the row from collapsing when the control inside it is clicked.
    event.stopPropagation();

    this._infoTarget = { fileNameUri: song.fileNameUri, troffDataId: version.troffDataId };
    this._infoMarkers = [];
    this.dispatchEvent(
      new CustomEvent<{ troffDataId: number }>('version-info-requested', {
        detail: { troffDataId: version.troffDataId },
        bubbles: true,
        composed: true,
      })
    );
    void this._loadInfoMarkers(song.fileNameUri, version.troffDataId);
  }

  private async _loadInfoMarkers(fileNameUri: string, troffDataId: number): Promise<void> {
    const result = await fetchServerTroffDataResult(
      troffDataId,
      safeDecodeURIComponent(fileNameUri)
    );
    if (!result.ok) {
      log.w('Could not load the markers for server version', troffDataId);
      return;
    }
    if (this._infoTarget?.troffDataId !== troffDataId) return;
    this._infoMarkers = result.data.markers;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-server-song-list': ServerSongList;
  }
}
