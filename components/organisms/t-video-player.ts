import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { TroffMarker } from '../../types/troff.js';
import { formatDuration } from '../../utils/formatters.js';
import { isAndroid } from '../../utils/browserEnv.js';
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
      --on-regular-buton-color: var(--on-theme-color, #fff);
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
    .mirror-btn[active] {
      --toggle-button-active-color: color-mix(
        in srgb,
        var(--accent-color-1, #431c5d) 60%,
        transparent
      );
      --on-toggle-button-active-color: var(--on-accent-color-1, #fff);
    }
    .fullscreen-btn {
      right: 8px;
    }
    .bottom-controls {
      position: absolute;
      bottom: var(--bottom-safe-offset);
      left: 0;
      right: 0;
      display: flex;
      z-index: 1;
      align-items: end;
    }
    .bottom-controls-cell {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .bottom-controls .video-btn {
      position: static;
      top: auto;
      bottom: auto;
      left: auto;
      right: auto;
      transform: none;
    }
    .bottom-controls .marker-label {
      position: static;
      bottom: auto;
      left: auto;
      right: auto;
      transform: none;
      white-space: normal;
      max-width: 100%;
      text-align: center;
    }
    .marker-label {
      z-index: 1;
      padding: 2px 8px;
      border-radius: var(--button-border-radius);
      background-color: rgba(0, 0, 0, 0.6);
      color: var(--on-theme-color, #fff);
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
      color: var(--on-theme-color, #fff);
      font-size: 0.9rem;
      white-space: nowrap;
      pointer-events: none;
    }

    .video-frame {
      position: relative;
      width: 100%;
      height: 100%;
      background: #000;
      touch-action: none;
      --bottom-safe-offset: 8px;
    }
    /* Temporarily pushes the bottom-row buttons/labels up on entering
       fullscreen so Android's "swipe from top / press back to exit
       fullscreen" system hint — a native overlay we can't detect or
       suppress from the page — doesn't sit on top of them. See
       FULLSCREEN_HINT_BUFFER_MS. */
    .video-frame.fullscreen-hint-buffer {
      --bottom-safe-offset: 84px;
    }
    /* Fallback "fullscreen" for elements where the real Fullscreen API
       isn't available — on iPhone Safari this is always the case for a
       non-<video> element (only <video> can go fullscreen there, via the
       legacy webkitEnterFullscreen, which hands off to iOS's own
       uncustomizable native player). Instead of using that, we stretch this
       component itself over the viewport with plain CSS, so the video stays
       in our own DOM and every one of our controls/gestures keeps working.
       See _enterCssFullscreenFallback. */
    :host(.css-fullscreen-fallback) {
      position: fixed;
      inset: 0;
      z-index: 999999;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      background: #000;
    }
  `;

  private static readonly CONTROLS_IDLE_TIMEOUT_MS = 3000;
  private static readonly GESTURE_FEEDBACK_MS = 1500;
  private static readonly SCRUB_SECONDS_PER_PX = 0.01;
  // Minimum time between committed seeks (~20fps): even when the video's
  // 'seeked' completes instantly, back-to-back seeks leave no time for the
  // browser to paint the intermediate frame. See _requestSeek below.
  private static readonly SCRUB_SEEK_INTERVAL_MS = 50;
  private static readonly SPEED_PX_PER_STEP = 10;
  private static readonly SPEED_STEP_PERCENT = 1;
  // Safety net for the seek-completion gate below: if the video element
  // never fires 'seeked' for some reason (rare, but seen on a handful of
  // Android media-engine versions), this makes sure scrubbing un-wedges
  // itself instead of freezing for the rest of the drag.
  private static readonly SEEK_WATCHDOG_MS = 400;
  // How long to keep the bottom-row buttons pushed up after entering
  // fullscreen. Android doesn't expose the hint's actual visibility or
  // duration to the page — there's no event or API for it — so this is a
  // best-effort timed buffer, not something we can react to precisely. 5s is
  // a reasonable starting point; test on your actual devices and adjust if
  // the hint lingers longer (or clears sooner) than that.
  private static readonly FULLSCREEN_HINT_BUFFER_MS = 4000;

  private static readonly DRAG_THRESHOLD_PX = 5;

  private _dragPointerId: number | null = null;
  private _dragStartX = 0;
  private _dragStartY = 0;
  private _dragLastX = 0;
  private _dragLastY = 0;
  private _dragAxis: 'horizontal' | 'vertical' | null = null;
  private _dragMoved = false;
  private _dragSpeedAccum = 0;
  private _dragScrubAccumX = 0;
  private _wheelSpeedAccum = 0;
  private _wheelSpeedAccumTimer?: ReturnType<typeof setTimeout>;
  private _wheelScrubAccumX = 0;
  private _wheelScrubAccumTimer?: ReturnType<typeof setTimeout>;
  private _scrubTarget: number | null = null;

  // Seek-completion gate (see _requestSeek below): tracks whether the video
  // element is currently mid-seek, and the latest scrub target we still owe
  // it once that seek finishes.
  private _seekInFlight = false;
  private _pendingSeekTime: number | null = null;
  // True when _pendingSeekTime is the end-of-gesture pointerup flush, which
  // must land even inside the cadence window (the gesture is over — waiting
  // would drop the final position).
  private _flushStash = false;
  // Cadence gate (see _requestSeek below): timestamp of the last committed
  // seek — requests inside SCRUB_SEEK_INTERVAL_MS are stashed, not applied.
  private _lastSeekAt = 0;
  private _seekWatchdogTimer?: ReturnType<typeof setTimeout>;

  @state() private _mirrored = false;
  @state() private _isFullscreen = false;
  @state() private _isPlaying = false;
  @state() private _controlsVisible = true;
  @state() private _gestureIcon = '';
  @state() private _gestureText = '';
  @state() private _fullscreenHintBuffer = false;
  @state() private _cssFullscreenFallback = false;

  @property({ type: Array }) markers: TroffMarker[] = [];
  @property({ type: String }) startMarkerId = '';
  @property({ type: Number }) speed = 100;

  private _controlsTimer?: ReturnType<typeof setTimeout>;
  private _gestureTimer?: ReturnType<typeof setTimeout>;
  private _fullscreenHintBufferTimer?: ReturnType<typeof setTimeout>;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('fullscreenchange', this._onFullscreenChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('fullscreenchange', this._onFullscreenChange);
    this._clearControlsTimer();
    this._clearGestureTimer();
    this._clearSeekWatchdog();
    this._clearFullscreenHintBufferTimer();
    if (this._cssFullscreenFallback) {
      document.body.style.overflow = '';
    }
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

  private _clearFullscreenHintBufferTimer() {
    if (this._fullscreenHintBufferTimer !== undefined) {
      clearTimeout(this._fullscreenHintBufferTimer);
      this._fullscreenHintBufferTimer = undefined;
    }
  }

  private _onFullscreenChange = () => {
    this._isFullscreen = document.fullscreenElement === this;
    if (!this._isFullscreen) {
      this._clearControlsTimer();
      this._controlsVisible = true;
      this._clearFullscreenHintBufferTimer();
      this._fullscreenHintBuffer = false;
    } else {
      this._scheduleControlsHide();
      // Give Android's exit-fullscreen system hint room to appear without
      // covering the bottom-row buttons, then relax back to normal spacing.
      // iOS doesn't show this hint, so only buffer on Android.
      if (isAndroid) {
        this._fullscreenHintBuffer = true;
        this._clearFullscreenHintBufferTimer();
        this._fullscreenHintBufferTimer = setTimeout(() => {
          this._fullscreenHintBuffer = false;
        }, TVideoPlayer.FULLSCREEN_HINT_BUFFER_MS);
      }
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

  /**
   * Fires once the video element has actually finished (decoded + painted)
   * the seek we last issued. This is the completion signal the scrub gate
   * waits on — see _requestSeek for why time-based throttling isn't enough
   * on slower Android devices.
   */
  private _onVideoSeeked = () => {
    this._clearSeekWatchdog();
    this._seekInFlight = false;
    if (this._pendingSeekTime !== null) {
      const next = this._pendingSeekTime;
      const isFlush = this._flushStash;
      // Respect the SCRUB_SEEK_INTERVAL_MS cadence here too: on fast devices
      // 'seeked' fires inside the window, and committing unconditionally would
      // chain seeks at the seeked rate instead of the ~20fps cap. When the
      // window isn't open yet, leave the target stashed — the next pointermove
      // re-requests the accumulated target and the pointerup force-flush
      // guarantees the final landing. On slow devices the window has always
      // elapsed by the time 'seeked' fires, so this stays a no-op there and
      // the self-tuning flush is unchanged. An end-of-gesture flush must
      // always land — the gesture is over, so waiting would drop the final
      // position.
      if (!isFlush && Date.now() - this._lastSeekAt < TVideoPlayer.SCRUB_SEEK_INTERVAL_MS) {
        return; // cadence window not open yet — stay stashed; a move/pointerup lands it
      }
      this._pendingSeekTime = null;
      this._flushStash = false;
      this._commitSeek(next);
    }
  };

  private _clearSeekWatchdog() {
    if (this._seekWatchdogTimer !== undefined) {
      clearTimeout(this._seekWatchdogTimer);
      this._seekWatchdogTimer = undefined;
    }
  }

  /** Actually assigns video.currentTime. Only call via _requestSeek. */
  private _commitSeek(time: number) {
    const video = this.querySelector('video');
    if (!video) {
      this._seekInFlight = false;
      return;
    }
    this._seekInFlight = true;
    this._lastSeekAt = Date.now();
    // A commit always represents the latest target, so any stashed target is
    // superseded — clearing it prevents a stale stash from re-landing (and
    // re-dispatching video-scrub-requested) after a later commit completes.
    this._pendingSeekTime = null;
    video.currentTime = time;
    this.dispatchEvent(
      new CustomEvent('video-scrub-requested', {
        detail: { time },
        bubbles: true,
        composed: true,
      })
    );
    this._clearSeekWatchdog();
    this._seekWatchdogTimer = setTimeout(() => {
      this._onVideoSeeked();
    }, TVideoPlayer.SEEK_WATCHDOG_MS);
  }

  /**
   * Requests a seek to `time`, gated on BOTH the previous seek having
   * actually finished (the video 'seeked' event) AND a minimum cadence since
   * the last committed seek.
   *
   * - The 'seeked' event-gate self-tunes to slow Android devices: on many of
   *   them, issuing a new `currentTime` write while the browser is still
   *   decoding/painting the previous seek cancels that in-flight seek, so
   *   under a steady stream of pointermove events nothing would ever finish
   *   rendering until the drag stops. Waiting for confirmation lets each
   *   frame paint before the next seek starts, at whatever rate the device
   *   can manage.
   * - The SCRUB_SEEK_INTERVAL_MS cadence caps the seek rate at ~20fps even
   *   when seeks complete instantly, so fast devices also give intermediate
   *   frames time to paint instead of overwriting them back-to-back.
   *
   * A request that fails either gate is stashed in _pendingSeekTime (only the
   * latest target survives) and lands when the gate reopens — via the next
   * 'seeked', the next pointermove, or the pointerup flush. _scrubTarget keeps
   * accumulating meanwhile, so no scrub distance is lost.
   *
   * `bypassCadence` is used by the pointerup/pointercancel flush, which must
   * land the exact final position even inside the cadence window — it still
   * defers to a genuinely in-flight seek.
   */
  private _requestSeek(time: number, bypassCadence = false) {
    if (this._seekInFlight) {
      this._pendingSeekTime = time; // only the latest target survives
      this._flushStash = bypassCadence; // an end-of-gesture flush must survive the cadence too
      return;
    }
    if (!bypassCadence && Date.now() - this._lastSeekAt < TVideoPlayer.SCRUB_SEEK_INTERVAL_MS) {
      this._pendingSeekTime = time; // cadence window not open yet — keep the latest target
      this._flushStash = false;
      return;
    }
    this._flushStash = false;
    this._commitSeek(time);
  }

  firstUpdated() {
    const video = this.querySelector('video');
    if (video) {
      video.controls = false; // we provide our own controls
      video.addEventListener('play', this._onVideoPlay);
      video.addEventListener('pause', this._onVideoPause);
      video.addEventListener('seeked', this._onVideoSeeked);
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
    } else if (this._cssFullscreenFallback) {
      this._exitCssFullscreenFallback();
    } else if (this.requestFullscreen) {
      try {
        this.requestFullscreen().catch(() => this._enterCssFullscreenFallback());
      } catch {
        // Some browsers advertise requestFullscreen but throw/reject when
        // it's actually called on this element — fall back the same way as
        // when the method isn't present at all.
        this._enterCssFullscreenFallback();
      }
    } else {
      this._enterCssFullscreenFallback();
    }
  }

  /**
   * Fallback used whenever the real Fullscreen API isn't available for this
   * element. On iPhone Safari that's unconditional: only <video> elements
   * can enter real fullscreen there, and only via the legacy
   * webkitEnterFullscreen(), which hands control to iOS's own native video
   * player — a system UI layer we can't draw over or query, so our controls
   * and drag gestures would simply stop existing as far as the user can
   * tell. Simulating fullscreen with CSS instead keeps the video as a
   * normal element in our own DOM, so everything keeps working. The
   * trade-off is this isn't true OS fullscreen — Safari's own chrome can
   * still show — but on iPhone it's the only way to keep custom controls.
   */
  private _enterCssFullscreenFallback() {
    this._cssFullscreenFallback = true;
    this._isFullscreen = true;
    this.classList.add('css-fullscreen-fallback');
    document.body.style.overflow = 'hidden'; // keep the page from scrolling behind the overlay
    this._scheduleControlsHide();
  }

  private _exitCssFullscreenFallback() {
    this._cssFullscreenFallback = false;
    this._isFullscreen = false;
    this.classList.remove('css-fullscreen-fallback');
    document.body.style.overflow = '';
    this._clearControlsTimer();
    this._controlsVisible = true;
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
    if (this._isFullscreen) {
      // The marker dialog lives in the footer, OUTSIDE the fullscreen element.
      // Real fullscreen renders the host in the browser's top layer above the
      // whole page, and the CSS fallback covers the viewport at z-index 999999 —
      // either way the dialog would be painted behind the video. Leave fullscreen
      // first so the dialog can appear above it.
      this._onFullScreenClick();
    }
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
    if (this._dragMoved) {
      this._dragMoved = false;
      return;
    }
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

  private _onFrameDoubleClick(event: MouseEvent) {
    const path = event.composedPath();
    // Same guard as _onFrameClick: double-tapping a control button must not
    // toggle fullscreen via the frame.
    if (path.some((el) => el instanceof Element && el.tagName.toLowerCase() === 't-butt')) {
      return;
    }
    // Double-tap toggles fullscreen exactly like the fullscreen button.
    this._onFullScreenClick();
  }

  private _onFramePointerDown(event: PointerEvent) {
    const path = event.composedPath();
    if (path.some((el) => el instanceof Element && el.tagName.toLowerCase() === 't-butt')) {
      return; // let button clicks behave normally
    }
    if (event.button !== 0) return; // primary button / touch only

    this._dragPointerId = event.pointerId;
    this._dragStartX = this._dragLastX = event.clientX;
    this._dragStartY = this._dragLastY = event.clientY;
    this._dragAxis = null;
    this._dragMoved = false;
    this._dragSpeedAccum = 0;
    this._dragScrubAccumX = 0;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  private _onFramePointerMove(event: PointerEvent) {
    if (this._dragPointerId === null || event.pointerId !== this._dragPointerId) return;

    const deltaX = event.clientX - this._dragLastX;
    const deltaY = event.clientY - this._dragLastY;

    if (!this._dragAxis) {
      const totalX = event.clientX - this._dragStartX;
      const totalY = event.clientY - this._dragStartY;
      if (
        Math.abs(totalX) < TVideoPlayer.DRAG_THRESHOLD_PX &&
        Math.abs(totalY) < TVideoPlayer.DRAG_THRESHOLD_PX
      ) {
        return; // not enough movement yet to decide the axis
      }
      this._dragAxis = Math.abs(totalX) > Math.abs(totalY) ? 'horizontal' : 'vertical';
      this._dragMoved = true; // suppress the click-to-toggle-controls on pointerup
    }

    this._dragLastX = event.clientX;
    this._dragLastY = event.clientY;

    const video = this.querySelector('video');
    if (!video) return;

    if (this._dragAxis === 'horizontal') {
      const duration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Infinity;
      if (this._scrubTarget === null) {
        this._scrubTarget = video.currentTime; // base the accumulation on the real position
      }
      const scrubMultiplier = this._getScrubMultiplier(this._dragScrubAccumX);
      this._dragScrubAccumX += deltaX;
      this._scrubTarget = Math.min(
        Math.max(
          0,
          this._scrubTarget + deltaX * TVideoPlayer.SCRUB_SECONDS_PER_PX * scrubMultiplier
        ),
        duration
      );

      // Update the on-screen time label on every move — text is cheap. The
      // actual video frame is gated by _requestSeek, since decoding/painting
      // is the part that can't always keep up with the pointer on mobile.
      const scrubLabel =
        Number.isFinite(duration) && duration > 0
          ? `${formatDuration(this._scrubTarget)} / ${formatDuration(duration)}`
          : formatDuration(this._scrubTarget);
      this._showGestureFeedback('time', scrubLabel);

      this._requestSeek(this._scrubTarget);
    } else {
      this._dragSpeedAccum += deltaY;
      // Round half away from zero: upward drags (negative deltas) at a .5px-step
      // boundary must round to a full step just like downward drags (Math.round
      // rounds -0.5 → -0 and -1.5 → -1, which would lose those steps).
      const steps =
        Math.sign(this._dragSpeedAccum) *
        Math.round(Math.abs(this._dragSpeedAccum) / TVideoPlayer.SPEED_PX_PER_STEP);
      if (steps === 0) {
        return; // accumulate more pixels before emitting a whole-number step
      }
      this._dragSpeedAccum -= steps * TVideoPlayer.SPEED_PX_PER_STEP;
      const effectiveStep = this._getSpeedStep(this._dragSpeedAccum);
      const newSpeed = Math.min(
        Math.max(50, Math.round(Math.round(this.speed) - steps * effectiveStep)),
        200
      );
      this.speed = newSpeed; // keep the drag's running base in sync (v2Script also sets it via the event)
      this.dispatchEvent(
        new CustomEvent('speed-changed', {
          detail: { speed: newSpeed },
          bubbles: true,
          composed: true,
        })
      );
      this._showGestureFeedback('speed', `${newSpeed}%`);
    }
  }

  private _onFramePointerUp(event: PointerEvent) {
    if (this._dragPointerId !== event.pointerId) return;
    if (this._scrubTarget !== null) {
      // The gesture is over, so flush the exact accumulated target even
      // inside the cadence window — waiting would drop the final position.
      // A seek genuinely in flight is still deferred to (see _requestSeek):
      // the target becomes pending and lands the instant that seek completes,
      // guaranteeing we always end up exactly where the user released.
      this._requestSeek(this._scrubTarget, true);
      this._scrubTarget = null;
    }
    this._dragPointerId = null;
    this._dragAxis = null;
  }

  /**
   * Returns the effective speed step percent based on accumulated scroll
   * distance. Starts at SPEED_STEP_PERCENT (1%) and grows to 3× that over
   * ~200px of accumulated movement — fine control at first, then coarser.
   */
  private _getSpeedStep(accumulatedPx: number): number {
    const multiplier = 1 + Math.min(Math.abs(accumulatedPx) / 40, 5);
    return TVideoPlayer.SPEED_STEP_PERCENT * multiplier;
  }

  private _getScrubMultiplier(accumulatedPx: number): number {
    return 1 + Math.min(Math.abs(accumulatedPx) / 100, 3);
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
      // Accumulate across consecutive wheel events so that rapid scroll bursts
      // produce accelerating scrub (slow at first, faster as you go).
      const scrubMultiplier = this._getScrubMultiplier(this._wheelScrubAccumX);
      this._wheelScrubAccumX += event.deltaX;
      const duration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Infinity;
      const newTime = Math.min(
        Math.max(
          0,
          video.currentTime + event.deltaX * TVideoPlayer.SCRUB_SECONDS_PER_PX * scrubMultiplier
        ),
        duration
      );
      video.currentTime = newTime;
      // Reset the accumulator after a brief pause so a new gesture starts slow.
      clearTimeout(this._wheelScrubAccumTimer);
      this._wheelScrubAccumTimer = setTimeout(() => {
        this._wheelScrubAccumX = 0;
      }, 300);
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
      // Accumulate across consecutive wheel events so that rapid scroll bursts
      // produce accelerating speed changes (slow at first, faster as you go).
      this._wheelSpeedAccum += event.deltaY;
      const steps =
        Math.sign(this._wheelSpeedAccum) *
        Math.round(Math.abs(this._wheelSpeedAccum) / TVideoPlayer.SPEED_PX_PER_STEP);
      if (steps === 0) {
        return; // accumulate more pixels before emitting a whole-number step
      }
      this._wheelSpeedAccum -= steps * TVideoPlayer.SPEED_PX_PER_STEP;
      const effectiveStep = this._getSpeedStep(this._wheelSpeedAccum);
      const newSpeed = Math.min(
        Math.max(50, Math.round(Math.round(this.speed) - steps * effectiveStep)),
        200
      );
      // Reset the accumulator after a brief pause so a new gesture starts slow.
      clearTimeout(this._wheelSpeedAccumTimer);
      this._wheelSpeedAccumTimer = setTimeout(() => {
        this._wheelSpeedAccum = 0;
      }, 300);
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
      <div
        class="video-frame ${this._fullscreenHintBuffer ? 'fullscreen-hint-buffer' : ''}"
        @click=${this._onFrameClick}
        @wheel=${this._onFrameWheel}
        @dblclick=${this._onFrameDoubleClick}
        @pointerdown=${this._onFramePointerDown}
        @pointermove=${this._onFramePointerMove}
        @pointerup=${this._onFramePointerUp}
        @pointercancel=${this._onFramePointerUp}
      >
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
          .active=${this._mirrored}
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
        <div class="bottom-controls">
          <div class="bottom-controls-cell">
            ${this._prevMarkerName
              ? html`<span
                  class="marker-label prev-marker-label ${this._isFullscreen
                    ? ''
                    : 'not-fullscreen'} ${this._controlsVisible ? '' : 'controls-hidden'}"
                  >${this._prevMarkerName}</span
                >`
              : ''}
            <t-butt
              class="video-btn prev-marker-btn ${this._controlsVisible ? '' : 'controls-hidden'}"
              slim
              title="Previous marker"
              @click=${this._onPrevMarkerClick}
            >
              <t-icon name="previous-marker"></t-icon>
            </t-butt>
          </div>
          <div class="bottom-controls-cell">
            ${this._replayMarkerName
              ? html`<span
                  class="marker-label replay-label ${this._isFullscreen
                    ? ''
                    : 'not-fullscreen'} ${this._controlsVisible ? '' : 'controls-hidden'}"
                  >${this._replayMarkerName}</span
                >`
              : ''}
            <t-butt
              class="video-btn replay-btn ${this._controlsVisible ? '' : 'controls-hidden'}"
              slim
              title="Replay"
              @click=${this._onReplayClick}
            >
              <t-icon name="reload"></t-icon>
            </t-butt>
          </div>
          <div class="bottom-controls-cell">
            <t-butt
              class="video-btn play-pause-btn ${this._controlsVisible ? '' : 'controls-hidden'}"
              slim
              title="Play/Pause"
              @click=${this._onPlayPauseClick}
            >
              <t-icon name="${this._isPlaying ? 'pause' : 'play'}"></t-icon>
            </t-butt>
          </div>
          <div class="bottom-controls-cell">
            ${this._nextMarkerName
              ? html`<span
                  class="marker-label next-marker-label ${this._isFullscreen
                    ? ''
                    : 'not-fullscreen'} ${this._controlsVisible ? '' : 'controls-hidden'}"
                  >${this._nextMarkerName}</span
                >`
              : ''}
            <t-butt
              class="video-btn next-marker-btn ${this._controlsVisible ? '' : 'controls-hidden'}"
              slim
              title="Next marker"
              @click=${this._onNextMarkerClick}
            >
              <t-icon name="next-marker"></t-icon>
            </t-butt>
          </div>
          <div class="bottom-controls-cell">
            <t-butt
              class="video-btn marker-btn ${this._controlsVisible ? '' : 'controls-hidden'}"
              slim
              title="Add marker"
              @click=${this._onMarkerClick}
            >
              <t-icon name="marker-plus"></t-icon>
            </t-butt>
          </div>
        </div>
      </div>
    `;
  }
}
