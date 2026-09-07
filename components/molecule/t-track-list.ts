import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-media.js';

const ts = () => new Date().toLocaleTimeString();

@customElement('t-track-list')
export class TrackList extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .tracks-container {
      padding: 0;
    }
  `;

  @property({ type: Array }) tracks: any[] = [];
  @property({ type: String }) currentSongKey = '';
  @property({ type: Number }) highlightedIndex = -1;
  @property({ type: Object }) downloadProgressMap: Record<string, number> = {};

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('highlightedIndex')) {
      const highlighted = this.renderRoot.querySelector<HTMLElement>('t-media[highlighted]');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
    if (changedProperties.has('tracks')) {
      const prev = changedProperties.get('tracks') as any[] | undefined;
      if (!prev || prev.length !== this.tracks.length) {
        const pending = this.tracks.filter((t) => t.downloaded === false);
        console.log(
          `${ts()} [t-track-list] render: ${this.tracks.length} track rows` +
            `${pending.length > 0 ? ` (${pending.length} pending download)` : ''}`
        );
        for (const t of this.tracks) {
          const icon = t.downloaded === false ? '⏳' : '✓';
          console.log(`${ts()} [t-track-list]   ${icon} "${t.title || t.songKey}"`);
        }
      }
    }
  }

  render() {
    return html`
      <div class="tracks-container">
        ${this.tracks.map(
          (track, index) => html`
            <t-media
              .active=${track.songKey === this.currentSongKey}
              ?highlighted=${index === this.highlightedIndex}
              title=${track.title}
              artist=${track.artist}
              album=${track.album}
              genre=${track.genre}
              year=${track.year}
              comment=${track.comment}
              duration=${track.duration}
              .rating=${track.rating}
              tempo=${track.tempo}
              albumArt=${track.albumArt}
              .isVideo=${track.isVideo}
              .playsMonth=${track.playsMonth}
              .playsTotal=${track.playsTotal}
              .songKey=${track.songKey}
              .downloaded=${track.downloaded !== false}
              .downloadProgress=${this.downloadProgressMap[track.songKey] ?? -2}
            ></t-media>
          `
        )}
      </div>
    `;
  }
}
