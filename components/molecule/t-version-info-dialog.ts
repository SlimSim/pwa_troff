/**
 * Version info dialog.
 *
 * A modal overlay showing the info for one server-song version: the version's
 * markers on a t-marker-slider timeline (placement by min/max seconds, colors,
 * formatted times, marker names and — for markers with info — the info
 * t-popover rendered by t-marker) that respects the user's global
 * "extended marker color" / "extra extended" fill settings (via the same
 * logic as the player), plus a download link for exactly this
 * version (#id&fileNameUri). Almost full screen (max-width 900px,
 * max-height 90vh) so the timeline stays readable while the dimmed backdrop
 * keeps it reading as a dialog.
 *
 * The host (t-server-song-list) mounts it only when the dialog should be shown
 * (`open` defaults to true) and feeds fileNameUri / troffDataId / markers /
 * duration / versions as properties. Dismissing (cancel button, backdrop click, Escape)
 * closes the overlay and notifies the host via `dialog-cancelled` so it can
 * unmount. Navigation via prev/next keeps the dialog open and emits
 * `version-navigated`.
 *
 * Events (bubbles, composed):
 *   - `dialog-cancelled`: no detail
 *   - `version-navigated`: detail { troffDataId: number } — emitted by
 *     Previous version / Next version buttons (when enabled)
 *
 * Properties:
 *   .versions: TroffDataIdObject[] — the list of versions for this song
 *     (used to compute prev/next from current .troffDataId); defaults to []
 *   .info: string — per-version song info text for the read-only snapshot
 *     shown in the header dropdown; defaults to ''
 *
 * Header (inside .dialog-header):
 *   <t-icon> + <h2 class="dialog-title">${decoded fileName from fileNameUri}</h2>
 *   + (only if truthy/non-empty on current version): p's for artist, title (song title),
 *     choreography, choreographer (some floated right, modeled after find.html
 *     moreAboutVersionDialog structure)
 *   + <t-dropdown-button class="info-dropdown${hasInfo ? ' has-info' : ''}">
 *       (ghost info button; dropdown shows <div class="song-info-text">...</div>)
 *
 * Buttons in .dialog-footer (same row as the download):
 *   .prev-version <t-butt>  ("Previous version (N markers)" — only nrMarkers of the prev target;
 *     no displayName; disabled when no prev)
 *   .next-version <t-butt>  ("Next version (N markers)" — only nrMarkers of the next target;
 *     no displayName; disabled when no next)
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import '../atom/t-dropdown-button.js';
import '../organisms/t-marker-slider.js';
import type { TroffDataIdObject, TroffMarker } from '../../types/troff.d.js';
import { getMarkerFillColor } from '../../utils/troff-settings.js';
import { safeDecodeURIComponent } from '../../utils/utils.js';

@customElement('t-version-info-dialog')
export class VersionInfoDialog extends LitElement {
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

    /* Dialog box — almost full screen, still visibly a dialog */
    .dialog {
      background: var(--on-theme-color, #fff);
      color: var(--theme-color, #000);
      border-radius: var(--button-border-radius, 8px);
      width: 100%;
      max-width: 900px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      position: relative;
    }

    .dialog-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      flex: 1;
      min-width: 0;
    }

    .dialog-header .header-content {
      flex: 1;
      min-width: 0;
    }

    .dialog-header .header-meta {
      font-size: 0.8rem;
      color: var(--on-gray-out, #666);
      margin-top: 2px;
      line-height: 1.25;
    }

    .dialog-header t-dropdown-button {
      flex-shrink: 0;
    }

    t-dropdown-button.info-dropdown.has-info::after {
      content: '';
      position: absolute;
      top: 4px;
      right: 8px;
      width: 8px;
      height: 8px;
      background-color: var(--info-indicator-color, var(--accent-color-2, #dd2c00));
      border-radius: 50%;
      pointer-events: none;
    }

    .info-dropdown-content {
      padding: 16px 8px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
      width: min(280px, calc(100vw - 24px));
    }

    .song-info-text {
      font-size: 0.8rem;
      line-height: 1.35;
      white-space: pre-wrap;
      word-break: break-word;
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

    .marker-slider-wrap {
      height: 50vh;
    }
  `;

  /**
   * True while the dialog is shown. Defaults to true because the parent
   * (t-server-song-list) only mounts this element when the dialog should show.
   */
  @property({ type: Boolean, reflect: true }) open = true;

  @property({ type: String }) fileNameUri = '';
  @property({ type: Number }) troffDataId = 0;
  @property({ type: Array }) markers: TroffMarker[] = [];
  /** Song duration in seconds — the slider timeline max (0 = unknown). */
  @property({ type: Number }) duration = 0;
  @property({ type: Array }) versions: TroffDataIdObject[] = [];
  @property({ type: String }) info = '';

  /**
   * Ensure that `await dialog.updateComplete` (as used in tests that mutate
   * nDB between awaits on a reused instance) always schedules a render so the
   * live `getMarkerFillColor()` binding is re-evaluated. Harmless in normal
   * one-shot usage of the dialog.
   */
  get updateComplete() {
    this.requestUpdate();
    return super.updateComplete;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Slider range end: the largest of the duration and the numeric marker
   * times. The stored duration can be missing (0) or stale in old marker
   * JSON — the player never trusts it, it uses the real audio duration —
   * and a last-marker fallback breaks on `time: 'max'` End markers
   * (Number('max') is NaN) and on unsorted marker arrays. The markers
   * themselves are the reliable source; 'max'-sentinel markers still
   * render at 100% because t-marker-slider maps them to this.max.
   */
  private _maxTime(): number {
    let maxMarkerTime = 0;
    for (const marker of this.markers) {
      const time = Number(marker.time);
      if (Number.isFinite(time) && time > maxMarkerTime) {
        maxMarkerTime = time;
      }
    }
    return Math.max(this.duration, maxMarkerTime, 1);
  }

  // ── Version navigation helpers (use .troffDataId to locate in .versions) ────

  private _currentIndex(): number {
    if (!this.versions || this.versions.length === 0) return -1;
    return this.versions.findIndex((v) => v.troffDataId === this.troffDataId);
  }

  private _currentVersion(): TroffDataIdObject | null {
    const idx = this._currentIndex();
    return idx >= 0 ? (this.versions[idx] ?? null) : null;
  }

  private _prevVersion(): TroffDataIdObject | null {
    const idx = this._currentIndex();
    return idx > 0 ? (this.versions[idx - 1] ?? null) : null;
  }

  private _nextVersion(): TroffDataIdObject | null {
    const idx = this._currentIndex();
    return idx >= 0 && idx < this.versions.length - 1 ? (this.versions[idx + 1] ?? null) : null;
  }

  private _canGoPrev(): boolean {
    const idx = this._currentIndex();
    return idx > 0;
  }

  private _canGoNext(): boolean {
    const idx = this._currentIndex();
    return idx >= 0 && idx < this.versions.length - 1;
  }

  private _goPrev() {
    if (!this._canGoPrev()) return;
    const idx = this._currentIndex();
    const prevId = this.versions[idx - 1].troffDataId;
    this.dispatchEvent(
      new CustomEvent('version-navigated', {
        detail: { troffDataId: prevId },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _goNext() {
    if (!this._canGoNext()) return;
    const idx = this._currentIndex();
    const nextId = this.versions[idx + 1].troffDataId;
    this.dispatchEvent(
      new CustomEvent('version-navigated', {
        detail: { troffDataId: nextId },
        bubbles: true,
        composed: true,
      })
    );
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private _handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this._cancel();
    }
  }

  private _handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
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

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    const current = this._currentVersion();
    const prev = this._prevVersion();
    const next = this._nextVersion();
    const fileName = safeDecodeURIComponent(this.fileNameUri);

    return html`
      <div
        class="overlay ${this.open ? 'open' : ''}"
        @click=${this._handleOverlayClick}
        @keydown=${this._handleKeydown}
      >
        <div class="dialog">
          <div class="dialog-header">
            <t-icon name="info"></t-icon>
            <div class="header-content">
              <h2 class="dialog-title">${fileName}</h2>
              ${current
                ? html`
                    <div class="header-meta">
                      ${current.artist ? html`<div>Artist: ${current.artist}</div>` : ''}
                      ${current.title ? html`<div>Title: ${current.title}</div>` : ''}
                      ${current.choreography
                        ? html`<div>Choreography: ${current.choreography}</div>`
                        : ''}
                      ${current.choreographer
                        ? html`<div>Choreographer: ${current.choreographer}</div>`
                        : ''}
                    </div>
                  `
                : ''}
            </div>
            <t-dropdown-button
              position="down"
              align="right"
              class="info-dropdown${this.info.trim() ? ' has-info' : ''}"
            >
              <t-butt ghost slot="button" title="Song info">
                <t-icon name="info"></t-icon>
              </t-butt>
              <div slot="dropdown" class="info-dropdown-content">
                <div class="song-info-text">${this.info || 'No song info for this version.'}</div>
              </div>
            </t-dropdown-button>
          </div>

          <div class="dialog-body">
            <div class="marker-slider-wrap">
              <t-marker-slider
                .markers=${this.markers}
                .min=${0}
                .max=${this._maxTime()}
                .value=${0}
                .fillColor=${getMarkerFillColor()}
              ></t-marker-slider>
            </div>
          </div>

          <div class="dialog-footer">
            <t-butt class="cancel-btn" @click=${this._cancel}>Cancel</t-butt>
            <t-butt class="prev-version" .disabled=${!this._canGoPrev()} @click=${this._goPrev}
              >${prev ? html`<span>Previous<br /><t-icon slim name="marker"></t-icon> ${prev.nrMarkers}</span>` : 'Previous'}</t-butt
            >
            <t-butt class="version-info-download" href="#${this.troffDataId}&${this.fileNameUri}">
              <t-icon name="download-song"></t-icon>
              <span>Download</span>
            </t-butt>
            <t-butt class="next-version" .disabled=${!this._canGoNext()} @click=${this._goNext}
              >${next ? html`<span>Next<br /><t-icon slim name="marker"></t-icon> ${next.nrMarkers}</span>` : 'Next'}</t-butt
            >
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-version-info-dialog': VersionInfoDialog;
  }
}
