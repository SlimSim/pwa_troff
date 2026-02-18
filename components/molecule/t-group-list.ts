import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-media.js';

interface Group {
  id: string;
  name: string;
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
  @property({ type: String }) selectedGroupId: string = '';
  @property({ type: String }) currentSongKey = '';

  private _handleGroupClick(groupId: string) {
    this.selectedGroupId = groupId;
  }

  private _handleBack() {
    this.selectedGroupId = '';
  }

  render() {
    const isDetailView = this.selectedGroupId !== '';
    const selectedGroup = this.groups.find((g) => g.id === this.selectedGroupId);

    if (isDetailView && selectedGroup) {
      return html`
        <div class="detail-view">
          <div class="detail-header">
            <span class="back-arrow" @click=${this._handleBack}>←</span>
            <h2 class="detail-title">${selectedGroup.name}</h2>
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
                .playsWeek=${track.playsWeek}
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
            <div class="group-item" @click=${() => this._handleGroupClick(group.id)}>
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
