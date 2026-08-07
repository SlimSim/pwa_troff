import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
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
  `;

  private static readonly CONTROLS_IDLE_TIMEOUT_MS = 3000;

  @state() private _mirrored = false;
  @state() private _isFullscreen = false;
  @state() private _isPlaying = false;
  @state() private _controlsVisible = true;

  private _controlsTimer?: ReturnType<typeof setTimeout>;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('fullscreenchange', this._onFullscreenChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('fullscreenchange', this._onFullscreenChange);
    this._clearControlsTimer();
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

  render() {
    return html`
      <div class="video-frame" @click=${this._onFrameClick}>
        <slot></slot>
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
      </div>
    `;
  }
}
