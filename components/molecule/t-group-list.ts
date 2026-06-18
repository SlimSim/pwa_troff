import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-media.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import '../atom/t-input.js';
import type { TroffFirebaseGroupIdentifyer } from '../../types/troff.d.js';

// Re-export so group-list can double as barrel if needed
export type { TroffFirebaseGroupIdentifyer };

interface Group extends TroffFirebaseGroupIdentifyer {
  tracks: any[];
}

@customElement('t-group-list')
export class GroupList extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .group-list-container {
      padding: 0;
    }

    .group-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: filter 0.2s ease;
    }

    .group-item:hover {
      filter: brightness(1.15);
    }

    .group-info {
      flex: 1;
    }

    .group-name {
      font-size: 0.95rem;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .group-track-count {
      font-size: 0.8rem;
      opacity: 0.7;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .group-stat {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }

    .group-stat + .group-stat {
      margin-left: 8px;
    }

    .detail-view {
      padding: 0;
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background-color: rgba(255, 255, 255, 0.05);
    }

    .back-arrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .back-arrow t-icon {
      transform: rotate(-90deg);
      font-size: 1.3rem;
    }

    .shared-with {
      font-size: 0.65rem;
      opacity: 0.5;
      line-height: 1.2;
    }

    .detail-title-group {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .detail-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
    }

    .detail-info-text {
      font-size: 0.7rem;
      opacity: 0.6;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
      line-height: 1.3;
      transition: opacity 0.15s;
    }

    .detail-info-text:hover {
      opacity: 0.9;
    }

    .detail-info-text.expanded {
      white-space: normal;
      overflow: visible;
    }

    .detail-edit-btn {
      flex-shrink: 0;
      margin-left: auto;
    }

    /* Track row — relative container for absolute delete overlay */
    .track-row {
      position: relative;
    }

    .track-row t-media {
      display: block;
    }

    /* Delete button overlaid on top of t-media, right-aligned */
    .track-remove-overlay {
      position: absolute;
      right: 4px;
      top: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      opacity: 0.5;
      transition: opacity 0.15s;
    }

    .track-remove-overlay:hover {
      opacity: 1;
    }

    /* Add songs section */
    .add-songs-section {
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .add-songs-label {
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 8px;
      opacity: 0.8;
    }

    .add-songs-search {
      margin-bottom: 8px;
    }

    .add-songs-list {
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      padding: 4px;
    }

    .add-songs-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      cursor: pointer;
      border-radius: 4px;
      font-size: 0.85rem;
      transition: background-color 0.15s;
    }

    .add-songs-item:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    .add-songs-item.added {
      opacity: 0.4;
      pointer-events: none;
    }

    .empty-text {
      font-size: 0.85rem;
      opacity: 0.6;
      font-style: italic;
      padding: 8px 0;
    }

    .section-divider {
      border: none;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      margin: 0;
    }

    .manage-toggle-wrap {
      display: flex;
      justify-content: center;
      padding: 8px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Mobile responsive adjustments */
    @media (min-width: 576px) {
      .group-item {
        padding: 14px 20px;
      }

      .group-name {
        font-size: 1rem;
      }

      .detail-header {
        padding: 14px 20px;
      }

      .detail-title {
        font-size: 1.1rem;
      }
    }
  `;

  @property({ type: Array }) tracks: any[] = [];
  @property({ type: Array }) groups: Group[] = [];
  @property({ type: String }) currentSongKey = '';
  @property({ type: String }) groupTrackSearch = '';

  /**
   * Key of the currently open group detail view.
   * Built from firebaseGroupDocId || String(id) — whichever is available first.
   * Empty string means list view (no detail open).
   */
  @state() private _selectedGroupKey: string = '';

  /** Whether the group info text in the header is expanded. */
  @state() private _infoExpanded = false;

  /** Search query for filtering songs to add. */
  @state() private _addSongQuery = '';

  /** Whether song management (remove buttons + add songs section) is visible. */
  @state() private _songManagementOpen = false;

  /** Return black or white text color depending on background luminance. */
  private _contrastColor(bg: string | undefined): string {
    if (!bg) return 'inherit';
    const hex = bg.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#111111' : '#ffffff';
  }

  /** Derive a stable string key for a group (firebaseGroupDocId or id or index). */
  private _groupKey(group: { firebaseGroupDocId?: string; id?: number }): string {
    if (group.firebaseGroupDocId) return group.firebaseGroupDocId;
    if (group.id != null) return String(group.id);
    return '';
  }

  /** Public method to programmatically open a group's detail view. */
  public openGroup(key: string) {
    this._selectedGroupKey = key;
    this._addSongQuery = '';
    this._infoExpanded = false;
    this._songManagementOpen = false;
    this.dispatchEvent(
      new CustomEvent('group-detail-opened', {
        detail: { groupKey: key },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleGroupClick(group: Group) {
    this.openGroup(this._groupKey(group));
  }

  private _handleBack() {
    this._selectedGroupKey = '';
    this.dispatchEvent(
      new CustomEvent('group-detail-closed', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleEditGroup(event: Event, group: Group) {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('group-edit-requested', {
        detail: { group },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleRemoveSong(songKey: string) {
    this.dispatchEvent(
      new CustomEvent('group-song-removed', {
        detail: {
          groupKey: this._selectedGroupKey,
          songKey,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleAddSong(songKey: string, title: string) {
    // Don't dispatch if song is already in the group
    const selectedGroup = this.groups.find(
      (g) => this._groupKey(g) === this._selectedGroupKey
    );
    if (!selectedGroup) return;
    if (selectedGroup.songs.some((s) => s.fullPath === songKey)) return;

    this.dispatchEvent(
      new CustomEvent('group-song-added', {
        detail: {
          groupKey: this._selectedGroupKey,
          songKey,
          title,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /** Songs from `tracks` that are NOT already in the selected group. */
  private _getAvailableSongs(): any[] {
    const selectedGroup = this.groups.find(
      (g) => this._groupKey(g) === this._selectedGroupKey
    );
    if (!selectedGroup) return [];

    const inGroup = new Set(selectedGroup.songs.map((s) => s.fullPath));
    const query = this._addSongQuery.trim().toLowerCase();

    return this.tracks.filter((t) => {
      if (inGroup.has(t.songKey)) return false;
      if (!query) return true;
      return (t.title || '').toLowerCase().includes(query);
    });
  }

  render() {
    const isDetailView = this._selectedGroupKey !== '';
    const selectedGroup = this.groups.find(
      (g) => this._groupKey(g) === this._selectedGroupKey
    );

    if (isDetailView && selectedGroup) {
      const availableSongs = this._getAvailableSongs();
      const infoText = selectedGroup.info || '';
      const trackQuery = this.groupTrackSearch.trim().toLowerCase();
      const filteredTracks = trackQuery
        ? selectedGroup.tracks.filter((t: any) => (t.title || '').toLowerCase().includes(trackQuery))
        : selectedGroup.tracks;

      return html`
        <div class="detail-view">
          <div
            class="detail-header"
            style=${selectedGroup.color
              ? `background-color: ${selectedGroup.color}; color: ${this._contrastColor(selectedGroup.color)}; border-bottom-color: color-mix(in srgb, ${this._contrastColor(selectedGroup.color)} 15%, transparent);`
              : ''}
          >
            <span class="back-arrow" @click=${this._handleBack}>
              <t-icon name="chevron-up"></t-icon>
            </span>
            <div class="detail-title-group">
              <h2 class="detail-title">${selectedGroup.name}</h2>
              ${infoText
                ? html`<span
                    class="detail-info-text ${this._infoExpanded ? 'expanded' : ''}"
                    @click=${() => { this._infoExpanded = !this._infoExpanded; }}
                    title="${this._infoExpanded ? 'Collapse' : 'Expand info'}"
                  >${infoText}</span>`
                : ''}
              ${selectedGroup.owners && selectedGroup.owners.length > 0
                ? html`<span class="shared-with">Shared with ${selectedGroup.owners.length} ${selectedGroup.owners.length === 1 ? 'person' : 'people'}</span>`
                : ''}
            </div>
            <t-butt class="detail-edit-btn" icon @click=${(e: Event) => this._handleEditGroup(e, selectedGroup)} title="Edit group">
              <t-icon name="edit"></t-icon>
            </t-butt>
          </div>

          <!-- Current songs: with delete overlay when management is open -->
          ${filteredTracks.map(
            (track) => html`
              <div class="track-row">
                <t-media
                  .active=${track.songKey === this.currentSongKey}
                  title=${track.title}
                  artist=${track.artist}
                  album=${track.album}
                  genre=${track.genre}
                  year=${track.year}
                  comment=${track.comment}
                  duration=${track.duration}
                  .rating=${track.rating}
                  tempo=${track.tempo}
                  .playsMonth=${track.playsMonth}
                  .playsTotal=${track.playsTotal}
                  .songKey=${track.songKey}
                ></t-media>
                ${this._songManagementOpen
                  ? html`
                      <div class="track-remove-overlay">
                        <t-butt
                          icon
                          confirm
                          confirmText="Remove?"
                          @click=${() => this._handleRemoveSong(track.songKey)}
                          title="Remove from group"
                        >
                          <t-icon name="delete"></t-icon>
                        </t-butt>
                      </div>
                    `
                  : ''}
              </div>
            `
          )}

          ${filteredTracks.length === 0 && !trackQuery && !this._songManagementOpen
            ? html`<div class="empty-text" style="padding: 16px;">No songs in this group.</div>`
            : ''}

          ${filteredTracks.length === 0 && !trackQuery && this._songManagementOpen
            ? html`<div class="empty-text" style="padding: 16px;">No songs in this group yet. Add some below!</div>`
            : ''}

          ${filteredTracks.length === 0 && trackQuery
            ? html`<div class="empty-text" style="padding: 16px;">No songs match "${this.groupTrackSearch}".</div>`
            : ''}

          <!-- Add songs section + toggle at the bottom -->
          ${this._songManagementOpen
            ? html`
              <div class="add-songs-section">
                <div class="add-songs-label">Add songs</div>
                <t-input
                  class="add-songs-search"
                  .value=${this._addSongQuery}
                  placeholder="Search songs..."
                  slim
                  clearable
                  @input=${(e: CustomEvent) => {
                    if (e.detail && typeof e.detail.value === 'string') {
                      this._addSongQuery = e.detail.value;
                    }
                  }}
                ></t-input>

                ${this.tracks.length === 0
                  ? html`<div class="empty-text">No songs in library</div>`
                  : ''}
                ${availableSongs.length > 0
                  ? html`
                      <div class="add-songs-list">
                        ${availableSongs.map(
                          (s) => html`
                            <div
                              class="add-songs-item"
                              @click=${() => this._handleAddSong(s.songKey, s.title)}
                            >
                              <span>${s.title}</span>
                              <t-icon name="note-plus"></t-icon>
                            </div>
                          `
                        )}
                      </div>
                    `
                  : this._addSongQuery.trim()
                    ? html`<div class="empty-text">No songs match "${this._addSongQuery}"</div>`
                    : html`<div class="empty-text">All songs are already in this group</div>`}
              </div>
            `
            : ''}

          <!-- Toggle button at the bottom -->
          <div class="manage-toggle-wrap">
            <t-butt slim @click=${() => { this._songManagementOpen = !this._songManagementOpen; this._addSongQuery = ''; this._infoExpanded = false; }}>
              ${this._songManagementOpen ? 'Done' : 'Add / Remove songs'}
            </t-butt>
          </div>
        </div>
      `;
    }

    if (this.groups.length === 0) {
      return html`
        <div style="padding: 16px; text-align: center; opacity: 0.6;">
          No groups yet. Create your first group!
        </div>
      `;
    }

    return html`
      <div class="group-list-container">
        ${this.groups.map(
          (group) => html`
            <div
              class="group-item"
              style=${group.color
                ? `background-color: ${group.color}; color: ${this._contrastColor(group.color)}; border-bottom-color: color-mix(in srgb, ${this._contrastColor(group.color)} 15%, transparent);`
                : ''}
              @click=${() => this._handleGroupClick(group)}
            >
              <div class="group-info">
                <div class="group-name">${group.name}</div>
                <div class="group-track-count">
                  <span class="group-stat">
                    <t-icon name="note"></t-icon>
                    ${group.tracks.length}
                  </span>
                  ${group.owners && group.owners.length > 0
                    ? html`
                        <span class="group-stat">
                          <t-icon name="group-plus"></t-icon>
                          ${group.owners.length}
                        </span>
                      `
                    : ''}
                </div>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }
}
