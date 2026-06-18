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
      transition: background-color 0.2s ease;
    }

    .group-item:hover {
      background-color: rgba(255, 255, 255, 0.1);
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
      font-size: 1.2rem;
      cursor: pointer;
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
  }

  private _handleGroupClick(group: Group) {
    this.openGroup(this._groupKey(group));
  }

  private _handleBack() {
    this._selectedGroupKey = '';
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

      return html`
        <div class="detail-view">
          <div class="detail-header">
            <span class="back-arrow" @click=${this._handleBack}>←</span>
            <div class="detail-title-group">
              <h2 class="detail-title">${selectedGroup.name}</h2>
              ${infoText
                ? html`<span
                    class="detail-info-text ${this._infoExpanded ? 'expanded' : ''}"
                    @click=${() => { this._infoExpanded = !this._infoExpanded; }}
                    title="${this._infoExpanded ? 'Collapse' : 'Expand info'}"
                  >${infoText}</span>`
                : ''}
            </div>
            <t-butt class="detail-edit-btn" icon @click=${(e: Event) => this._handleEditGroup(e, selectedGroup)} title="Edit group">
              <t-icon name="edit"></t-icon>
            </t-butt>
          </div>

          <!-- Current songs: with delete overlay when management is open -->
          ${selectedGroup.tracks.map(
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

          ${selectedGroup.tracks.length === 0 && !this._songManagementOpen
            ? html`<div class="empty-text" style="padding: 16px;">No songs in this group.</div>`
            : ''}

          ${selectedGroup.tracks.length === 0 && this._songManagementOpen
            ? html`<div class="empty-text" style="padding: 16px;">No songs in this group yet. Add some below!</div>`
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
            <div class="group-item" @click=${() => this._handleGroupClick(group)}>
              <div class="group-info">
                <div class="group-name">${group.name}</div>
                <div class="group-track-count">
                  ${group.tracks.length} track${group.tracks.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }
}
