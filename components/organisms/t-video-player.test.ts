import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TVideoPlayer } from './t-video-player.js';

/**
 * Feature spec #32 (round 3): `t-video-player` is a dumb frame that hosts a
 * slotted <video> element. Its shadow DOM is
 * `<div class="video-frame"><slot></slot></div>` with
 * `:host([hidden]) { display: none; }` so the video player can be shown /
 * hidden by toggling the `hidden` attribute.
 *
 * Custom controls (round 2): the browser's native video controls are dropped.
 * `t-video-player` overlays buttons on the video frame and forces
 * `video.controls = false` on the slotted <video>.
 *
 * Fullscreen + custom control bar (round 3):
 * - Fullscreen targets the component HOST (`element.requestFullscreen()`), not
 *   the <video> element, so the browser never shows its native fullscreen
 *   video controls. A `fullscreenchange` listener on `document` (added in
 *   `connectedCallback`, removed in `disconnectedCallback`) drives a
 *   `_isFullscreen` state that swaps the fullscreen button's icon between
 *   `resize-full` and `resize-small`.
 * - A play/pause button (`.play-pause-btn`, bottom-center) drives the slotted
 *   video's play()/pause() and reflects its 'play'/'pause' events (listeners
 *   added in `firstUpdated`) via a `_isPlaying` state (icons play/pause).
 * - An add-marker button (`.marker-btn`, bottom-right) dispatches a
 *   `video-marker-add-requested` CustomEvent (bubbles + composed) from the
 *   component host.
 * - Clicking the frame toggles `_controlsVisible`, which adds a
 *   `controls-hidden` class to all `.video-btn` buttons. Clicks whose
 *   composedPath includes a `t-butt` element are ignored, so clicking the
 *   overlay buttons never toggles the controls.
 *
 * Fullscreen-only controls + idle auto-fade (round 4):
 * - Play/pause and add-marker are only relevant in fullscreen: the component
 *   adds a `not-fullscreen` class to `.play-pause-btn` and `.marker-btn`
 *   whenever `_isFullscreen` is false (removed in fullscreen). `.mirror-btn`
 *   and `.fullscreen-btn` never carry it. The actual fade is pure CSS
 *   (`opacity` transition on `.video-btn`) and is NOT tested here — happy-dom
 *   does not resolve stylesheet transitions.
 * - Auto-fade: while fullscreen AND playing, a 3000ms `setTimeout` hides the
 *   controls by setting `_controlsVisible = false` (all four buttons get
 *   `controls-hidden`). The timer is (re)started on entering fullscreen while
 *   playing, on the video's `play` event, on a frame tap that SHOWS the
 *   controls, and on any control-button click. It is cancelled on a frame tap
 *   that HIDES the controls, on the video's `pause` event, on leaving
 *   fullscreen, and on disconnect. No timer runs when not fullscreen or
 *   paused. These tests drive the timer with `vi.useFakeTimers()`.
 */
describe('t-video-player', () => {
  let element: TVideoPlayer;
  const freshElements: TVideoPlayer[] = [];
  const cleanups: Array<() => void> = [];

  beforeEach(() => {
    element = new TVideoPlayer();
    document.body.appendChild(element);
  });

  afterEach(() => {
    // Defensive: fake-timer tests restore real timers in a finally block, but
    // if one throws before that, real-timer tests that follow must not run
    // against a faked setTimeout. Restore BEFORE restoreAllMocks.
    vi.useRealTimers();
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    for (const el of freshElements) {
      if (document.body.contains(el)) {
        document.body.removeChild(el);
      }
    }
    freshElements.length = 0;
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
    vi.restoreAllMocks();
  });

  it('renders a shadow root containing a .video-frame with a slot element', async () => {
    await element.updateComplete;
    expect(element.shadowRoot).not.toBeNull();
    const frame = element.shadowRoot?.querySelector('.video-frame');
    expect(frame).not.toBeNull();
    expect(frame?.querySelector('slot')).not.toBeNull();
  });

  it('projects a <video> element placed in light DOM into the slot', async () => {
    const video = document.createElement('video');
    element.appendChild(video);
    await element.updateComplete;

    const slot = element.shadowRoot?.querySelector('slot') as HTMLSlotElement | null;
    expect(slot).not.toBeNull();
    expect(Array.from(slot?.assignedNodes() ?? [])).toContain(video);
  });

  it('reflects the hidden property to the host attribute (pairs with :host([hidden]))', async () => {
    element.hidden = true;
    await element.updateComplete;
    expect(element.hasAttribute('hidden')).toBe(true);

    element.hidden = false;
    await element.updateComplete;
    expect(element.hasAttribute('hidden')).toBe(false);
  });

  /**
   * Creates a fresh player, appends a <video> as a light-DOM child BEFORE the
   * element is connected to the document, then connects it. Appending before
   * connecting guarantees the slotted video is present on the first render, so
   * `firstUpdated()` (which must set `video.controls = false` and attach the
   * play/pause listeners) can find it.
   */
  const createPlayerWithVideo = (
    controls = false,
  ): { el: TVideoPlayer; video: HTMLVideoElement } => {
    const el = new TVideoPlayer();
    const video = document.createElement('video');
    video.controls = controls;
    el.appendChild(video);
    document.body.appendChild(el);
    freshElements.push(el);
    return { el, video };
  };

  /**
   * Returns the button element for a selector, throwing a descriptive error if
   * the component does not render it (so failures are readable).
   */
  const getButton = (el: TVideoPlayer, selector: string): HTMLElement => {
    const button = el.shadowRoot?.querySelector(selector);
    if (!button) {
      throw new Error(`Expected shadow root to contain <${selector}>`);
    }
    return button as HTMLElement;
  };

  /**
   * Returns the `name` attribute of the <t-icon> slotted inside the given
   * button, or null if there is no icon.
   */
  const getIconName = (el: TVideoPlayer, selector: string): string | null =>
    getButton(el, selector).querySelector('t-icon')?.getAttribute('name') ?? null;

  /**
   * happy-dom does not implement Element#requestFullscreen (it only exists in
   * the TypeScript DOM *types*), so `vi.spyOn` on the instance would throw
   * "requestFullscreen does not exist". Define the mock on the given host
   * element instance instead. If a future happy-dom version does implement it,
   * fall back to vi.spyOn.
   */
  const mockRequestFullscreen = (target: HTMLElement) => {
    if (typeof target.requestFullscreen === 'function') {
      return vi.spyOn(target, 'requestFullscreen').mockResolvedValue(undefined);
    }
    const spy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(target, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: spy,
    });
    cleanups.push(() => {
      delete (target as { requestFullscreen?: unknown }).requestFullscreen;
    });
    return spy;
  };

  /**
   * happy-dom does not implement document.exitFullscreen either; same strategy
   * as mockRequestFullscreen.
   */
  const mockExitFullscreen = () => {
    if (typeof document.exitFullscreen === 'function') {
      return vi.spyOn(document, 'exitFullscreen').mockResolvedValue(undefined);
    }
    const spy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      writable: true,
      value: spy,
    });
    cleanups.push(() => {
      delete (document as { exitFullscreen?: unknown }).exitFullscreen;
    });
    return spy;
  };

  /**
   * happy-dom does not define document.fullscreenElement at all, so stub it to
   * return the given element. Returns a setter so a test can flip the stubbed
   * value while the stub is installed (the fullscreenchange listener reads it
   * live). Restored in afterEach.
   */
  const stubFullscreenElement = (
    initial: Element | null,
  ): ((next: Element | null) => void) => {
    let value: Element | null = initial;
    const original = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => value,
    });
    cleanups.push(() => {
      if (original) {
        Object.defineProperty(document, 'fullscreenElement', original);
      } else {
        delete (document as { fullscreenElement?: unknown }).fullscreenElement;
      }
    });
    return (next: Element | null) => {
      value = next;
    };
  };

  it('renders the overlay control buttons inside the video frame', async () => {
    await element.updateComplete;

    const frame = element.shadowRoot?.querySelector('.video-frame');
    expect(frame).not.toBeNull();

    // CSS class-name contract: every overlay control uses .video-btn + a
    // position class (fullscreen top-right, mirror top-left, play/pause
    // bottom-center, marker bottom-right). Computed styles are unreliable in
    // happy-dom, so assert on class names only.
    const buttonSpecs = [
      { selector: '.fullscreen-btn', positionClass: 'fullscreen-btn' },
      { selector: '.mirror-btn', positionClass: 'mirror-btn' },
      { selector: '.play-pause-btn', positionClass: 'play-pause-btn' },
      { selector: '.marker-btn', positionClass: 'marker-btn' },
    ];
    for (const { selector, positionClass } of buttonSpecs) {
      const button = frame?.querySelector(selector);
      expect(button).not.toBeNull();
      expect(button?.classList.contains('video-btn')).toBe(true);
      expect(button?.classList.contains(positionClass)).toBe(true);
    }
  });

  it('forces the slotted video to have native controls disabled', async () => {
    // Video is appended BEFORE the element is connected, so it is present when
    // firstUpdated() runs (the contract under test).
    const { el, video } = createPlayerWithVideo(true);
    await el.updateComplete;

    expect(video.controls).toBe(false);
  });

  it('mirror button toggles scaleX(-1) on the slotted video', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    const mirrorBtn = getButton(el, '.mirror-btn');
    mirrorBtn.click();
    await el.updateComplete;
    expect(video.style.transform).toBe('scaleX(-1)');

    mirrorBtn.click();
    await el.updateComplete;
    expect(video.style.transform).toBe('');
  });

  it('fullscreen button requests fullscreen on the component host, not the video', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const requestFullscreenSpy = mockRequestFullscreen(el);
    const fullscreenBtn = getButton(el, '.fullscreen-btn');
    fullscreenBtn.click();
    await el.updateComplete;

    expect(requestFullscreenSpy).toHaveBeenCalled();
  });

  it('fullscreen button exits fullscreen when the host is already fullscreen', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    // document.fullscreenElement must report the HOST (not the video) for the
    // button to exit fullscreen instead of requesting it again.
    stubFullscreenElement(el);
    const exitFullscreenSpy = mockExitFullscreen();
    const fullscreenBtn = getButton(el, '.fullscreen-btn');
    fullscreenBtn.click();
    await el.updateComplete;

    expect(exitFullscreenSpy).toHaveBeenCalled();
  });

  it('renders a play/pause button with a play icon', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const playPauseBtn = getButton(el, '.play-pause-btn');
    expect(playPauseBtn.classList.contains('video-btn')).toBe(true);
    expect(playPauseBtn.classList.contains('play-pause-btn')).toBe(true);
    expect(getIconName(el, '.play-pause-btn')).toBe('play');
  });

  it('play/pause button toggles playback on the slotted video', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    // happy-dom exposes `video.paused` as a prototype getter over internal
    // symbol state, and its real play()/pause() mutate that state and dispatch
    // 'play'/'pause' events. Replacing them with spies means the internal state
    // never flips, so `video.paused` would stay `true` forever and the button
    // would always call play(). Shadow the getter with an instance-level getter
    // backed by a mutable flag to make the click-toggle deterministic.
    let isPaused = true;
    Object.defineProperty(video, 'paused', {
      configurable: true,
      get: () => isPaused,
    });
    cleanups.push(() => {
      delete (video as { paused?: unknown }).paused;
    });

    const playSpy = vi.spyOn(video, 'play').mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => undefined);

    const playPauseBtn = getButton(el, '.play-pause-btn');

    // Video is paused → clicking calls video.play()
    playPauseBtn.click();
    await el.updateComplete;
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(pauseSpy).not.toHaveBeenCalled();

    // The browser fires 'play' once playback actually starts; the icon follows.
    isPaused = false;
    video.dispatchEvent(new Event('play'));
    await el.updateComplete;
    expect(getIconName(el, '.play-pause-btn')).toBe('pause');

    // Video is now "playing" → clicking calls video.pause()
    playPauseBtn.click();
    await el.updateComplete;
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalledTimes(1);

    // The browser fires 'pause'; the icon follows.
    isPaused = true;
    video.dispatchEvent(new Event('pause'));
    await el.updateComplete;
    expect(getIconName(el, '.play-pause-btn')).toBe('play');
  });

  it('marker button dispatches a video-marker-add-requested event from the host', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const addMarkerSpy = vi.fn();
    el.addEventListener('video-marker-add-requested', addMarkerSpy);

    getButton(el, '.marker-btn').click();
    await el.updateComplete;

    expect(addMarkerSpy).toHaveBeenCalledTimes(1);
    const event = addMarkerSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('video-marker-add-requested');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    // The event must be dispatched from the component host itself.
    expect(event.target).toBe(el);
  });

  it('clicking the video frame toggles the controls-hidden class on all buttons', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const frame = el.shadowRoot?.querySelector('.video-frame') as HTMLElement | null;
    expect(frame).not.toBeNull();

    const buttonSelectors = ['.mirror-btn', '.fullscreen-btn', '.play-pause-btn', '.marker-btn'];

    // Clicking the frame (not a button) hides the controls.
    frame?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await el.updateComplete;
    for (const selector of buttonSelectors) {
      expect(getButton(el, selector).classList.contains('controls-hidden')).toBe(true);
    }

    // Clicking the frame again restores them.
    frame?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await el.updateComplete;
    for (const selector of buttonSelectors) {
      expect(getButton(el, selector).classList.contains('controls-hidden')).toBe(false);
    }
  });

  it('clicking a control button does not toggle controls visibility', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    const frame = el.shadowRoot?.querySelector('.video-frame') as HTMLElement | null;
    expect(frame).not.toBeNull();
    const buttonSelectors = ['.mirror-btn', '.fullscreen-btn', '.play-pause-btn', '.marker-btn'];

    // Hide the controls first, so we can prove a button click does NOT restore
    // them (i.e. the frame handler ignores clicks whose composedPath includes a
    // t-butt element).
    frame?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await el.updateComplete;
    for (const selector of buttonSelectors) {
      expect(getButton(el, selector).classList.contains('controls-hidden')).toBe(true);
    }

    // Clicking a control button still fires its action...
    const mirrorBtn = getButton(el, '.mirror-btn');
    mirrorBtn.click();
    await el.updateComplete;
    expect(video.style.transform).toBe('scaleX(-1)');

    // ...but the controls stay hidden — the button click must not toggle them.
    for (const selector of buttonSelectors) {
      expect(getButton(el, selector).classList.contains('controls-hidden')).toBe(true);
    }
  });

  it('fullscreen button icon reflects the fullscreen state via fullscreenchange', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    expect(getIconName(el, '.fullscreen-btn')).toBe('resize-full');

    // Enter fullscreen: document.fullscreenElement reports the host and the
    // browser fires fullscreenchange on document.
    const setFullscreenElement = stubFullscreenElement(el);
    document.dispatchEvent(new Event('fullscreenchange'));
    await el.updateComplete;
    expect(getIconName(el, '.fullscreen-btn')).toBe('resize-small');

    // Exit fullscreen: fullscreenElement is cleared again.
    setFullscreenElement(null);
    document.dispatchEvent(new Event('fullscreenchange'));
    await el.updateComplete;
    expect(getIconName(el, '.fullscreen-btn')).toBe('resize-full');
  });

  // ---- Round 4: fullscreen-only buttons + idle auto-fade -------------------
  //
  // Feature 2 (short fade) is pure CSS (`transition: opacity 0.2s` on
  // `.video-btn`) and is deliberately NOT asserted: happy-dom's
  // getComputedStyle does not resolve stylesheet transitions reliably, so only
  // the class contracts that drive the fade are tested.

  const buttonSelectorsAll = [
    '.mirror-btn',
    '.fullscreen-btn',
    '.play-pause-btn',
    '.marker-btn',
  ] as const;

  /**
   * Stubs document.fullscreenElement to the given host and dispatches
   * fullscreenchange so the component's document listener picks it up. Returns
   * the stub setter so the test can flip the value later (e.g. to leave
   * fullscreen) and dispatch again. Mirror of the existing
   * 'fullscreen button icon' test's protocol.
   */
  const enterFullscreen = (target: TVideoPlayer): ((next: Element | null) => void) => {
    const setter = stubFullscreenElement(target);
    setter(target);
    document.dispatchEvent(new Event('fullscreenchange'));
    return setter;
  };

  /**
   * Flips the stubbed fullscreenElement to null and dispatches
   * fullscreenchange, i.e. leaves fullscreen.
   */
  const leaveFullscreen = (setter: (next: Element | null) => void) => {
    setter(null);
    document.dispatchEvent(new Event('fullscreenchange'));
  };

  /** Dispatches the video's play event (component listens in firstUpdated). */
  const playVideo = (video: HTMLVideoElement) => {
    video.dispatchEvent(new Event('play'));
  };

  /** Dispatches the video's pause event. */
  const pauseVideo = (video: HTMLVideoElement) => {
    video.dispatchEvent(new Event('pause'));
  };

  /** Clicks the .video-frame itself (the "tap to show/hide controls" gesture). */
  const clickFrame = (target: TVideoPlayer) => {
    const frame = target.shadowRoot?.querySelector('.video-frame') as HTMLElement | null;
    frame?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  };

  /** Asserts every control button does or does not carry a given class. */
  const expectButtonsClass = (target: TVideoPlayer, className: string, present: boolean) => {
    for (const selector of buttonSelectorsAll) {
      expect(
        getButton(target, selector).classList.contains(className),
        `button ${selector} should${present ? '' : ' not'} carry "${className}"`
      ).toBe(present);
    }
  };

  it('play-pause and marker buttons carry not-fullscreen outside fullscreen; mirror and fullscreen buttons do not', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    expect(getButton(el, '.play-pause-btn').classList.contains('not-fullscreen')).toBe(true);
    expect(getButton(el, '.marker-btn').classList.contains('not-fullscreen')).toBe(true);
    // These two are useful in normal (windowed) mode too, so they never fade out.
    expect(getButton(el, '.mirror-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.fullscreen-btn').classList.contains('not-fullscreen')).toBe(false);
  });

  it('entering fullscreen removes not-fullscreen from play-pause and marker buttons', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    // Precondition: outside fullscreen both buttons carry the class...
    expect(getButton(el, '.play-pause-btn').classList.contains('not-fullscreen')).toBe(true);
    expect(getButton(el, '.marker-btn').classList.contains('not-fullscreen')).toBe(true);

    // ...and entering fullscreen strips it.
    enterFullscreen(el);
    await el.updateComplete;

    expect(getButton(el, '.play-pause-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.marker-btn').classList.contains('not-fullscreen')).toBe(false);
    // Mirror and fullscreen never carry it, in either state.
    expect(getButton(el, '.mirror-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.fullscreen-btn').classList.contains('not-fullscreen')).toBe(false);
  });

  it('leaving fullscreen restores not-fullscreen on play-pause and marker buttons', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const setter = enterFullscreen(el);
    await el.updateComplete;
    expect(getButton(el, '.play-pause-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.marker-btn').classList.contains('not-fullscreen')).toBe(false);

    leaveFullscreen(setter);
    await el.updateComplete;

    expect(getButton(el, '.play-pause-btn').classList.contains('not-fullscreen')).toBe(true);
    expect(getButton(el, '.marker-btn').classList.contains('not-fullscreen')).toBe(true);
  });

  it('auto-hides the control buttons after idle while fullscreen and playing', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;

      enterFullscreen(el);
      playVideo(video);
      await el.updateComplete;

      // All four buttons start visible...
      expectButtonsClass(el, 'controls-hidden', false);

      // ...and the 3s idle timer hides them all.
      vi.advanceTimersByTime(3000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not auto-hide while paused even in fullscreen', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;

      enterFullscreen(el);
      playVideo(video);
      await el.updateComplete;

      // Positive control: while playing, the idle timer hides the controls.
      vi.advanceTimersByTime(3000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', true);

      // Pausing cancels the timer. Show the controls again (frame tap), then
      // let the whole idle window pass — they must stay visible.
      pauseVideo(video);
      await el.updateComplete;
      clickFrame(el);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', false);

      vi.advanceTimersByTime(3000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not auto-hide when not in fullscreen even while playing', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;

      // Positive control: fullscreen + playing does auto-hide after 3s.
      const setter = enterFullscreen(el);
      playVideo(video);
      await el.updateComplete;
      vi.advanceTimersByTime(3000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', true);

      // Leaving fullscreen cancels the timer and restores the controls. Even
      // though the video is still "playing", no idle timer may run outside
      // fullscreen.
      leaveFullscreen(setter);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', false);

      vi.advanceTimersByTime(3000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tapping the frame to show controls restarts the auto-hide timer', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;

      enterFullscreen(el);
      playVideo(video);
      await el.updateComplete;

      // Idle timer fires → controls hidden.
      vi.advanceTimersByTime(3000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', true);

      // Tap the frame to show them: the timer restarts, so the buttons stay
      // visible for a fresh 3s window.
      clickFrame(el);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', false);

      vi.advanceTimersByTime(2000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', false);

      // The restarted timer fires after its own 3s.
      vi.advanceTimersByTime(2000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('manually hiding the controls cancels the auto-hide timer', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;

      enterFullscreen(el);
      playVideo(video);
      await el.updateComplete;

      // Positive control: the idle timer is genuinely running (hides at 3s).
      vi.advanceTimersByTime(3000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', true);

      // Show the controls again, then hide them manually with a frame tap. The
      // manual hide must cancel the pending timer: after a window longer than
      // the idle delay nothing may re-show them (the timer only ever hides, so
      // "still hidden past 3s" proves the cancelled timer cannot fire later).
      clickFrame(el);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', false);
      clickFrame(el);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', true);

      vi.advanceTimersByTime(5000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clicking a control button restarts the auto-hide timer', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;

      enterFullscreen(el);
      playVideo(video);
      await el.updateComplete;

      // 2s into the 3s idle window the controls are still visible.
      vi.advanceTimersByTime(2000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', false);

      // A control-button click (mirror) counts as user interaction: the timer
      // restarts from the click, so the controls survive another full window.
      getButton(el, '.mirror-btn').click();
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', false);

      vi.advanceTimersByTime(2000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', false);

      // The reset timer (3s from the click) fires after its own window.
      vi.advanceTimersByTime(2000);
      await el.updateComplete;
      expectButtonsClass(el, 'controls-hidden', true);
    } finally {
      vi.useRealTimers();
    }
  });

  // ---- Round 5: immediate controls fade when pressing play in fullscreen ----
  //
  // Feature: when the user is fullscreen, paused, and presses the play/pause
  // button, the controls fade out DIRECTLY (immediately) instead of waiting the
  // 3s idle timeout — the user already told the app "I'm here" by clicking.
  // The immediate hide must only happen in fullscreen: in the embedded view the
  // mirror/fullscreen buttons stay as they are. The pause branch (controls stay
  // visible so the user can resume) and all round-4 behaviors are unchanged.
  //
  // No fake timers needed here: the immediate hide is synchronous on click.

  it('pressing play while fullscreen fades the controls out immediately', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    // Same `video.paused` instance-getter override as the round-3 toggle test:
    // happy-dom's real getter reads internal symbol state that the play() spy
    // never flips, so without the override the component would always take the
    // play branch anyway (and this test could pass for the wrong reason).
    const isPaused = true;
    Object.defineProperty(video, 'paused', {
      configurable: true,
      get: () => isPaused,
    });
    cleanups.push(() => {
      delete (video as { paused?: unknown }).paused;
    });

    const playSpy = vi.spyOn(video, 'play').mockResolvedValue(undefined);

    // Enter fullscreen: document.fullscreenElement reports the host and the
    // browser fires fullscreenchange on document (round-3 protocol).
    const setFullscreen = stubFullscreenElement(el);
    setFullscreen(el);
    document.dispatchEvent(new Event('fullscreenchange'));
    await el.updateComplete;

    // Precondition: controls are visible (none of the four buttons is hidden).
    expectButtonsClass(el, 'controls-hidden', false);

    getButton(el, '.play-pause-btn').click();
    await el.updateComplete;

    expect(playSpy).toHaveBeenCalledTimes(1);
    // The controls must fade out DIRECTLY from the click — no fake timers, no
    // 3s idle wait. This round-5 behavior does not exist yet (RED today).
    expectButtonsClass(el, 'controls-hidden', true);
  });

  it('pressing play outside fullscreen does not hide the controls immediately', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    const isPaused = true;
    Object.defineProperty(video, 'paused', {
      configurable: true,
      get: () => isPaused,
    });
    cleanups.push(() => {
      delete (video as { paused?: unknown }).paused;
    });

    const playSpy = vi.spyOn(video, 'play').mockResolvedValue(undefined);

    // NOT in fullscreen — the immediate hide must be gated on `_isFullscreen`,
    // so the mirror/fullscreen buttons in the embedded view stay as they are.
    getButton(el, '.play-pause-btn').click();
    await el.updateComplete;

    expect(playSpy).toHaveBeenCalledTimes(1);
    // Controls stay visible outside fullscreen.
    expectButtonsClass(el, 'controls-hidden', false);
  });

  it('pressing pause does not hide the controls in fullscreen', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    const isPaused = false;
    Object.defineProperty(video, 'paused', {
      configurable: true,
      get: () => isPaused,
    });
    cleanups.push(() => {
      delete (video as { paused?: unknown }).paused;
    });

    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => undefined);

    // Fullscreen, but the video is "playing" → click takes the pause branch.
    const setFullscreen = stubFullscreenElement(el);
    setFullscreen(el);
    document.dispatchEvent(new Event('fullscreenchange'));
    await el.updateComplete;
    expectButtonsClass(el, 'controls-hidden', false);

    getButton(el, '.play-pause-btn').click();
    await el.updateComplete;

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    // The pause branch is unchanged: controls stay visible so the user can
    // resume playback.
    expectButtonsClass(el, 'controls-hidden', false);
  });
});
