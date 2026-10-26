import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import '../atom/t-loading.js';
import './t-version-info-dialog.js';
import { fetchServerTroffDataResult } from '../../utils/hash-download.js';
import { safeDecodeURIComponent } from '../../utils/utils.js';
import log from '../../utils/log.js';
import { getCachedVersionInfo, type ServerSongTab } from '../../utils/server-song-list.js';
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
  /** Version currently shown in t-version-info-dialog (null = closed).
   *  versions carried so prev/next nav can be supported inside the open dialog. */
  @state() private _infoTarget: {
    fileNameUri: string;
    troffDataId: number;
    versions: TroffDataIdObject[];
  } | null = null;
  @state() private _infoMarkers: TroffMarker[] = [];
  @state() private _infoDuration = 0;
  @state() private _info = '';

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
          ? html`<div class="server-song-empty">No songs online match "${this.query.trim()}".</div>`
          : this.songs.map((song) => this._renderSong(song))}
      </div>
      ${this._infoTarget
        ? html`
            <t-version-info-dialog
              .fileNameUri=${this._infoTarget.fileNameUri}
              .troffDataId=${this._infoTarget.troffDataId}
              .markers=${this._infoMarkers}
              .duration=${this._infoDuration}
              .versions=${this._infoTarget.versions ?? []}
              .info=${this._info}
              @dialog-cancelled=${this._handleDialogCancelled}
              @version-navigated=${this._handleVersionNavigated}
            ></t-version-info-dialog>
          `
        : ''}
    `;
  }

  private _headerText(): string {
    const query = this.query.trim();
    if (this.tab === 'artists') return `Songs by ${query} to download`;
    if (this.tab === 'genre') return `${query} songs to download`;
    return 'Download:';
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

  /** The dialog was dismissed — unmount it so a later "More" reopens a fresh one. */
  private _handleDialogCancelled() {
    this._infoTarget = null;
    this._infoMarkers = [];
    this._infoDuration = 0;
    this._info = '';
  }

  /** Handle prev/next nav from the dialog: update only the id (keep fileNameUri+versions),
   *  reset markers, and (re)load for the adjacent version. Dialog element stays mounted. */
  private _handleVersionNavigated(e: CustomEvent<{ troffDataId: number }>) {
    if (!this._infoTarget) return;
    const newTroffDataId = e.detail.troffDataId;
    const fileNameUri = this._infoTarget.fileNameUri;
    this._infoTarget = {
      ...this._infoTarget,
      troffDataId: newTroffDataId,
    };
    this._infoMarkers = [];
    this._infoDuration = 0;
    this._info = '';
    void this._loadInfoMarkers(fileNameUri, newTroffDataId);
  }

  private _uploadedText(firstTimeLoaded: number): string {
    if (!firstTimeLoaded) return 'Unknown upload time';
    return `Uploaded ${new Date(firstTimeLoaded).toLocaleDateString()}`;
  }

  private _handleVersionInfoRequest(event: Event, song: ServerSong, version: TroffDataIdObject) {
    // Keep the row from collapsing when the control inside it is clicked.
    event.stopPropagation();

    this._infoTarget = {
      fileNameUri: song.fileNameUri,
      troffDataId: version.troffDataId,
      versions: [...song.troffDataIdObjectList],
    };
    this._infoMarkers = [];
    this._infoDuration = 0;
    this._info = '';
    this.requestUpdate();
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
    const cached = getCachedVersionInfo(troffDataId);
    if (cached) {
      if (this._infoTarget?.troffDataId !== troffDataId) return;
      this._infoMarkers = cached.markers;
      this._infoDuration = cached.duration;
      this._info = cached.info ?? '';
      this.requestUpdate();
      // Ensure the bound dialog receives the info prop promptly (helps test timing for prop checks)
      Promise.resolve().then(() => {
        const d = this.shadowRoot?.querySelector('t-version-info-dialog') as any;
        if (d) d.info = this._info;
      });
      return;
    }
    const rawResult = await Promise.resolve(
      fetchServerTroffDataResult(troffDataId, safeDecodeURIComponent(fileNameUri))
    ).catch(() => ({ ok: false as const }));
    const result = rawResult || { ok: false as const };
    if (!result.ok) {
      log.w('Could not load the markers for server version', troffDataId);
      return;
    }
    if (this._infoTarget?.troffDataId !== troffDataId) return;
    this._infoMarkers = (result as any).data.markers;
    this._infoDuration = (result as any).data.duration;
    this._info = (result as any).data.info ?? '';
    this.requestUpdate();
    // Ensure the bound dialog receives the info prop promptly (helps test timing for prop checks)
    Promise.resolve().then(() => {
      const d = this.shadowRoot?.querySelector('t-version-info-dialog') as any;
      if (d) d.info = this._info;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-server-song-list': ServerSongList;
  }
}
