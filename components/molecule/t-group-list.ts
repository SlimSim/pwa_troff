import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-media.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
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

    .detail-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
    }

    .detail-edit-btn {
      flex-shrink: 0;
      margin-left: auto;
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

  /** Derive a stable string key for a group (firebaseGroupDocId or id or index). */
  private _groupKey(group: { firebaseGroupDocId?: string; id?: number }): string {
    if (group.firebaseGroupDocId) return group.firebaseGroupDocId;
    if (group.id != null) return String(group.id);
    return '';
  }

  private _handleGroupClick(group: Group) {
    this._selectedGroupKey = this._groupKey(group);
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

  render() {
    const isDetailView = this._selectedGroupKey !== '';
    const selectedGroup = this.groups.find(
      (g) => this._groupKey(g) === this._selectedGroupKey
    );

    if (isDetailView && selectedGroup) {
      return html`
        <div class="detail-view">
          <div class="detail-header">
            <span class="back-arrow" @click=${this._handleBack}>←</span>
            <h2 class="detail-title">${selectedGroup.name}</h2>
            <t-butt class="detail-edit-btn" icon @click=${(e: Event) => this._handleEditGroup(e, selectedGroup)} title="Edit group">
              <t-icon name="edit"></t-icon>
            </t-butt>
          </div>
          ${selectedGroup.tracks.map(
            (track) => html`
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
            `
          )}
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
