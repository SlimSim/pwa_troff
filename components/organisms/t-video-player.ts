import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { TroffMarker } from '../../types/troff.js';
import { formatDuration } from '../../utils/formatters.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';

@customElement('t-video-player')
export class TVideoPlayer extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }
    :host([hidden]) {
      display: none;
    }
    .video-frame {
      position: relative;
      width: 100%;
      height: 100%;
      background: #000;
    }
    ::slotted(video) {
      display: block;
      width: 100%;
      height: 100%;
    }
    .video-btn {
      position: absolute;
      top: 8px;
      z-index: 1;
      transition: opacity 0.2s ease;
      --regular-button-color: rgba(0, 0, 0, 0.6);
      --on-regular-buton-color: #fff;
    }
    .video-btn.controls-hidden {
      opacity: 0;
      pointer-events: none;
    }
    .video-btn.not-fullscreen {
      opacity: 0;
      pointer-events: none;
    }
    .mirror-btn {
      left: 8px;
    }
    .fullscreen-btn {
      right: 8px;
    }
    .play-pause-btn {
      top: auto;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
    }
    .marker-btn {
      top: auto;
      bottom: 8px;
      right: 8px;
    }
    .replay-btn {
      top: auto;
      bottom: 8px;
      left: calc(30% - 8px);
      transform: translateX(-50%);
    }
    .prev-marker-btn {
      top: auto;
      bottom: 8px;
      left: 8px;
    }
    .next-marker-btn {
      top: auto;
      bottom: 8px;
      right: calc(30% - 8px);
      transform: translateX(50%);
    }
    .marker-label {
      position: absolute;
      bottom: 40px;
      z-index: 1;
      padding: 2px 8px;
      border-radius: var(--button-border-radius);
      background-color: rgba(0, 0, 0, 0.6);
      color: #fff;
      font-size: 0.75rem;
      white-space: nowrap;
      max-width: 30%;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }
    .marker-label.controls-hidden,
    .marker-label.not-fullscreen {
      opacity: 0;
    }
    .gesture-indicator {
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: var(--button-border-radius);
      background-color: rgba(0, 0, 0, 0.6);
      color: #fff;
      font-size: 0.9rem;
      white-space: nowrap;
      pointer-events: none;
    }
    .prev-marker-label {
      left: 8px;
    }
    .replay-label {
      left: calc(30% - 8px);
      transform: translateX(-50%);
    }
    .next-marker-label {
      right: calc(30% - 8px);
      transform: translateX(50%);
    }
  `;

  private static readonly CONTROLS_IDLE_TIMEOUT_MS = 3000;
  private static readonly GESTURE_FEEDBACK_MS = 1500;
  private static readonly SCRUB_SECONDS_PER_PX = 0.05;
  private static readonly SPEED_PX_PER_STEP = 50;
  private static readonly SPEED_STEP_PERCENT = 5;

  @state() private _mirrored = false;
  @state() private _isFullscreen = false;
  @state() private _isPlaying = false;
  @state() private _controlsVisible = true;
  @state() private _gestureIcon = '';
  @state() private _gestureText = '';

  @property({ type: Array }) markers: TroffMarker[] = [];
  @property({ type: String }) startMarkerId = '';
  @property({ type: Number }) speed = 100;

  private _controlsTimer?: ReturnType<typeof setTimeout>;
  private _gestureTimer?: ReturnType<typeof setTimeout>;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('fullscreenchange', this._onFullscreenChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('fullscreenchange', this._onFullscreenChange);
    this._clearControlsTimer();
    this._clearGestureTimer();
  }

  private _clearControlsTimer() {
    if (this._controlsTimer !== undefined) {
      clearTimeout(this._controlsTimer);
      this._controlsTimer = undefined;
    }
  }

  private _scheduleControlsHide() {
    this._clearControlsTimer();
    if (this._isFullscreen && this._isPlaying && this._controlsVisible) {
      this._controlsTimer = setTimeout(() => {
        this._controlsVisible = false;
      }, TVideoPlayer.CONTROLS_IDLE_TIMEOUT_MS);
    }
  }

  private _showGestureFeedback(icon: string, text: string) {
    this._gestureIcon = icon;
    this._gestureText = text;
    this._clearGestureTimer();
    this._gestureTimer = setTimeout(() => {
      this._gestureText = '';
      this._gestureIcon = '';
    }, TVideoPlayer.GESTURE_FEEDBACK_MS);
  }

  private _clearGestureTimer() {
    if (this._gestureTimer !== undefined) {
      clearTimeout(this._gestureTimer);
      this._gestureTimer = undefined;
    }
  }

  private _onFullscreenChange = () => {
    this._isFullscreen = document.fullscreenElement === this;
    if (!this._isFullscreen) {
      this._clearControlsTimer();
      this._controlsVisible = true;
    } else {
      this._scheduleControlsHide();
    }
  };

  private _onVideoPlay = () => {
    this._isPlaying = true;
    this._scheduleControlsHide();
  };

  private _onVideoPause = () => {
    this._isPlaying = false;
    this._clearControlsTimer();
  };

  firstUpdated() {
    const video = this.querySelector('video');
    if (video) {
      video.controls = false; // we provide our own controls
      video.addEventListener('play', this._onVideoPlay);
      video.addEventListener('pause', this._onVideoPause);
    }
  }

  private _onMirrorClick() {
    this._mirrored = !this._mirrored;
    const video = this.querySelector('video');
    if (video) {
      video.style.transform = this._mirrored ? 'scaleX(-1)' : '';
    }
  }

  private _onFullScreenClick() {
    if (document.fullscreenElement === this) {
      void document.exitFullscreen?.();
    } else if (this.requestFullscreen) {
      void this.requestFullscreen();
    } else {
      // iOS Safari fallback (webkitEnterFullscreen is a legacy video-only API)
      const video = this.querySelector('video');
      (
        video as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
      )?.webkitEnterFullscreen?.();
    }
  }

  private _onPlayPauseClick() {
    const video = this.querySelector('video');
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
      if (this._isFullscreen) {
        // Starting playback from the controls in fullscreen: fade the controls
        // out directly instead of waiting out the idle timeout.
        this._clearControlsTimer();
        this._controlsVisible = false;
      }
    } else {
      video.pause();
    }
  }

  private _onMarkerClick() {
    this.dispatchEvent(
      new CustomEvent('video-marker-add-requested', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onReplayClick() {
    this.dispatchEvent(
      new CustomEvent('video-replay-requested', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onPrevMarkerClick() {
    this.dispatchEvent(
      new CustomEvent('video-prev-marker-requested', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onNextMarkerClick() {
    this.dispatchEvent(
      new CustomEvent('video-next-marker-requested', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onFrameClick(event: MouseEvent) {
    const path = event.composedPath();
    if (path.some((el) => el instanceof Element && el.tagName.toLowerCase() === 't-butt')) {
      // Interacting with a control button resets the idle timer.
      this._scheduleControlsHide();
      return;
    }
    this._controlsVisible = !this._controlsVisible;
    if (this._controlsVisible) {
      this._scheduleControlsHide();
    } else {
      this._clearControlsTimer();
    }
  }

  private _onFrameWheel(event: WheelEvent) {
    const video = this.querySelector('video');
    if (!video) {
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      // Trackpad pinch-zoom arrives as a ctrl/meta wheel event: let the
      // browser handle it instead of scrubbing or changing the speed.
      return;
    }
    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    if (absX > absY) {
      // Horizontal scroll: scrub (seek) the video.
      const duration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Infinity;
      const newTime = Math.min(
        Math.max(0, video.currentTime + event.deltaX * TVideoPlayer.SCRUB_SECONDS_PER_PX),
        duration
      );
      video.currentTime = newTime;
      this.dispatchEvent(
        new CustomEvent('video-scrub-requested', {
          detail: { time: newTime },
          bubbles: true,
          composed: true,
        })
      );
      const scrubLabel =
        Number.isFinite(duration) && duration > 0
          ? `${formatDuration(newTime)} / ${formatDuration(duration)}`
          : formatDuration(newTime);
      this._showGestureFeedback('time', scrubLabel);
      event.preventDefault();
    } else {
      // Vertical scroll: adjust the playback speed (v2Script applies it to the media).
      const steps = Math.round(event.deltaY / TVideoPlayer.SPEED_PX_PER_STEP);
      const newSpeed = Math.min(
        Math.max(50, this.speed - steps * TVideoPlayer.SPEED_STEP_PERCENT),
        200
      );
      this.dispatchEvent(
        new CustomEvent('speed-changed', {
          detail: { speed: newSpeed },
          bubbles: true,
          composed: true,
        })
      );
      this._showGestureFeedback('speed', `${newSpeed}%`);
      event.preventDefault();
    }
  }

  private get _markerIndex(): number {
    return this.markers.findIndex((m) => m.id === this.startMarkerId);
  }

  private get _replayMarkerName(): string {
    const index = this._markerIndex;
    return index === -1 ? '' : this.markers[index].name;
  }

  private get _prevMarkerName(): string {
    const index = this._markerIndex;
    if (index === -1) return '';
    return this.markers[index === 0 ? 0 : index - 1].name;
  }

  private get _nextMarkerName(): string {
    const index = this._markerIndex;
    if (index === -1) return '';
    return this.markers[index === this.markers.length - 1 ? this.markers.length - 1 : index + 1]
      .name;
  }

  render() {
    return html`
      <div class="video-frame" @click=${this._onFrameClick} @wheel=${this._onFrameWheel}>
        <slot></slot>
        ${this._gestureIcon && this._gestureText
          ? html`
              <div class="gesture-indicator">
                <t-icon name="${this._gestureIcon}"></t-icon>
                <span>${this._gestureText}</span>
              </div>
            `
          : ''}
        <t-butt
          class="video-btn mirror-btn ${this._controlsVisible ? '' : 'controls-hidden'}"
          slim
          title="Mirror video"
          @click=${this._onMirrorClick}
        >
          <t-icon name="mirror"></t-icon>
        </t-butt>
        <t-butt
          class="video-btn fullscreen-btn ${this._controlsVisible ? '' : 'controls-hidden'}"
          slim
          title="Fullscreen"
          @click=${this._onFullScreenClick}
        >
          <t-icon name="${this._isFullscreen ? 'resize-small' : 'resize-full'}"></t-icon>
        </t-butt>
        <t-butt
          class="video-btn play-pause-btn ${this._isFullscreen ? '' : 'not-fullscreen'} ${this
            ._controlsVisible
            ? ''
            : 'controls-hidden'}"
          slim
          title="Play/Pause"
          @click=${this._onPlayPauseClick}
        >
          <t-icon name="${this._isPlaying ? 'pause' : 'play'}"></t-icon>
        </t-butt>
        <t-butt
          class="video-btn marker-btn ${this._isFullscreen ? '' : 'not-fullscreen'} ${this
            ._controlsVisible
            ? ''
            : 'controls-hidden'}"
          slim
          title="Add marker"
          @click=${this._onMarkerClick}
        >
          <t-icon name="marker-plus"></t-icon>
        </t-butt>
        <t-butt
          class="video-btn replay-btn ${this._isFullscreen ? '' : 'not-fullscreen'} ${this
            ._controlsVisible
            ? ''
            : 'controls-hidden'}"
          slim
          title="Replay"
          @click=${this._onReplayClick}
        >
          <t-icon name="reload"></t-icon>
        </t-butt>
        ${this._replayMarkerName
          ? html`<span class="marker-label replay-label ${this._isFullscreen ? '' : 'not-fullscreen'} ${this._controlsVisible ? '' : 'controls-hidden'}">${this._replayMarkerName}</span>`
          : ''}
        <t-butt
          class="video-btn prev-marker-btn ${this._isFullscreen ? '' : 'not-fullscreen'} ${this
            ._controlsVisible
            ? ''
            : 'controls-hidden'}"
          slim
          title="Previous marker"
          @click=${this._onPrevMarkerClick}
        >
          <t-icon name="previous-marker"></t-icon>
        </t-butt>
        ${this._prevMarkerName
          ? html`<span class="marker-label prev-marker-label ${this._isFullscreen ? '' : 'not-fullscreen'} ${this._controlsVisible ? '' : 'controls-hidden'}">${this._prevMarkerName}</span>`
          : ''}
        <t-butt
          class="video-btn next-marker-btn ${this._isFullscreen ? '' : 'not-fullscreen'} ${this
            ._controlsVisible
            ? ''
            : 'controls-hidden'}"
          slim
          title="Next marker"
          @click=${this._onNextMarkerClick}
        >
          <t-icon name="next-marker"></t-icon>
        </t-butt>
        ${this._nextMarkerName
          ? html`<span class="marker-label next-marker-label ${this._isFullscreen ? '' : 'not-fullscreen'} ${this._controlsVisible ? '' : 'controls-hidden'}">${this._nextMarkerName}</span>`
          : ''}
      </div>
    `;
  }
}
