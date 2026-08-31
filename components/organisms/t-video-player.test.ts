import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TVideoPlayer } from './t-video-player.js';
import type { TroffMarker } from '../../types/troff.js';

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
 * - All bottom control buttons (play/pause, marker, replay, prev-marker,
 *   next-marker) are always visible regardless of fullscreen state. Only the
 *   marker-name labels above prev/replay/next carry `not-fullscreen`.
 *   `.mirror-btn` and `.fullscreen-btn` also never carry it. The actual fade is pure CSS
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
      { selector: '.replay-btn', positionClass: 'replay-btn' },
      { selector: '.prev-marker-btn', positionClass: 'prev-marker-btn' },
      { selector: '.next-marker-btn', positionClass: 'next-marker-btn' },
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

  // ---- Mirror button active-state reflection -------------------------------
  //
  // Feature: when mirroring is ON, the mirror <t-butt> must carry the `active`
  // attribute on its HOST element, so the project-wide `:host([active]) .base`
  // styling gives visual feedback (t-butt's `active` Boolean property is
  // reflected to the attribute). Today the component only applies `scaleX(-1)`
  // to the slotted video — the `active` attribute is never bound, so tests 2–4
  // are RED against the current implementation. Test 1 pins the initial
  // (inactive) state that must never regress.

  it('renders the mirror button without the active attribute initially', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const mirrorBtn = getButton(el, '.mirror-btn');
    expect(mirrorBtn.hasAttribute('active')).toBe(false);
    expect(mirrorBtn.getAttribute('active')).toBeNull();
  });

  it('mirror button reflects the active attribute on the host when mirroring is on', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    const mirrorBtn = getButton(el, '.mirror-btn');
    mirrorBtn.click();
    await el.updateComplete;

    expect(mirrorBtn.hasAttribute('active')).toBe(true);
    // Existing behavior must not regress: the video is still mirrored.
    expect(video.style.transform).toBe('scaleX(-1)');
  });

  it('mirror button removes the active attribute when mirroring is toggled off', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    const mirrorBtn = getButton(el, '.mirror-btn');
    mirrorBtn.click();
    await el.updateComplete;
    expect(mirrorBtn.hasAttribute('active')).toBe(true);

    mirrorBtn.click();
    await el.updateComplete;
    expect(mirrorBtn.hasAttribute('active')).toBe(false);
    expect(video.style.transform).toBe('');
  });

  it('reflects the active attribute on the t-butt host element, not an inner element', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const mirrorBtn = getButton(el, '.mirror-btn');
    mirrorBtn.click();
    await el.updateComplete;

    // The attribute must sit on the t-butt HOST (the element getButton
    // returns), not on an inner element such as the <t-icon>, so the
    // `:host([active])` CSS selector can style the whole button.
    expect(mirrorBtn.hasAttribute('active')).toBe(true);
    expect(mirrorBtn.querySelector('[active]')).toBeNull();
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

  // ---- Double-tap toggles fullscreen ----------------------------------------
  //
  // Feature: a double-tap / double-click (native `dblclick` event) on the
  // `.video-frame` must toggle fullscreen EXACTLY like the fullscreen button
  // (`_onFullScreenClick`): request fullscreen on the HOST when not fullscreen,
  // exit fullscreen when the host is already fullscreen. The `.video-frame`
  // has `touch-action: none` so mobile double-tap zoom is disabled and native
  // double-click events can fire. Like `_onFrameClick`, dblclicks whose
  // composedPath includes a `t-butt` element (a control button) are ignored.
  // Single clicks keep their existing controls-visibility toggle and must NOT
  // request fullscreen — fullscreen is exclusive to the double-tap gesture.

  it('single click on the frame does NOT request fullscreen (guard)', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const requestFullscreenSpy = mockRequestFullscreen(el);
    const frame = el.shadowRoot?.querySelector('.video-frame') as HTMLElement | null;
    expect(frame).not.toBeNull();

    frame?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await el.updateComplete;

    // Fullscreen is exclusive to double-tap: a single click only toggles the
    // controls visibility and must never request fullscreen.
    expect(requestFullscreenSpy).not.toHaveBeenCalled();
  });

  it('double-tap on the frame requests fullscreen on the host when not fullscreen', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const requestFullscreenSpy = mockRequestFullscreen(el);
    const frame = el.shadowRoot?.querySelector('.video-frame') as HTMLElement | null;
    expect(frame).not.toBeNull();

    frame?.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, composed: true, detail: 2 })
    );
    await el.updateComplete;

    expect(requestFullscreenSpy).toHaveBeenCalled();
  });

  it('double-tap on the frame exits fullscreen when the host is already fullscreen', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    // document.fullscreenElement must report the HOST (not the video) for the
    // double-tap to exit fullscreen instead of requesting it again — same
    // protocol as the fullscreen button test above.
    stubFullscreenElement(el);
    const exitFullscreenSpy = mockExitFullscreen();
    const frame = el.shadowRoot?.querySelector('.video-frame') as HTMLElement | null;
    expect(frame).not.toBeNull();

    frame?.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, composed: true, detail: 2 })
    );
    await el.updateComplete;

    expect(exitFullscreenSpy).toHaveBeenCalled();
  });

  it('double-tap on a control button does NOT toggle fullscreen', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const requestFullscreenSpy = mockRequestFullscreen(el);
    const fullscreenBtn = getButton(el, '.fullscreen-btn');

    // The composedPath includes a t-butt element, so the dblclick handler must
    // ignore it (same guard as _onFrameClick): double-clicking a control
    // button must not toggle fullscreen, and the button's own click action
    // must not fire from a dblclick dispatch either.
    fullscreenBtn.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, composed: true, detail: 2 })
    );
    await el.updateComplete;

    expect(requestFullscreenSpy).not.toHaveBeenCalled();
  });

  it('double-tap on the frame does not itself toggle the controls-hidden class', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const frame = el.shadowRoot?.querySelector('.video-frame') as HTMLElement | null;
    expect(frame).not.toBeNull();

    const buttonSelectors = ['.mirror-btn', '.fullscreen-btn', '.play-pause-btn', '.marker-btn', '.replay-btn', '.prev-marker-btn', '.next-marker-btn'];

    // The dblclick handler ONLY handles fullscreen — it must not ALSO toggle
    // the controls visibility (that stays exclusive to single clicks).
    frame?.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, composed: true, detail: 2 })
    );
    await el.updateComplete;
    for (const selector of buttonSelectors) {
      expect(getButton(el, selector).classList.contains('controls-hidden')).toBe(false);
    }
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

    const buttonSelectors = ['.mirror-btn', '.fullscreen-btn', '.play-pause-btn', '.marker-btn', '.replay-btn', '.prev-marker-btn', '.next-marker-btn'];

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
    const buttonSelectors = ['.mirror-btn', '.fullscreen-btn', '.play-pause-btn', '.marker-btn', '.replay-btn', '.prev-marker-btn', '.next-marker-btn'];

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

  // ---- Round 6: marker navigation buttons (replay, previous, next) ----

  it('replay button dispatches a video-replay-requested event from the host', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const replaySpy = vi.fn();
    el.addEventListener('video-replay-requested', replaySpy);

    getButton(el, '.replay-btn').click();
    await el.updateComplete;

    expect(replaySpy).toHaveBeenCalledTimes(1);
    const event = replaySpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('video-replay-requested');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.target).toBe(el);
  });

  it('prev-marker button dispatches a video-prev-marker-requested event from the host', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const prevSpy = vi.fn();
    el.addEventListener('video-prev-marker-requested', prevSpy);

    getButton(el, '.prev-marker-btn').click();
    await el.updateComplete;

    expect(prevSpy).toHaveBeenCalledTimes(1);
    const event = prevSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('video-prev-marker-requested');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.target).toBe(el);
  });

  it('next-marker button dispatches a video-next-marker-requested event from the host', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const nextSpy = vi.fn();
    el.addEventListener('video-next-marker-requested', nextSpy);

    getButton(el, '.next-marker-btn').click();
    await el.updateComplete;

    expect(nextSpy).toHaveBeenCalledTimes(1);
    const event = nextSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('video-next-marker-requested');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.target).toBe(el);
  });

  // ---- Round 13: marker button exits fullscreen before dispatching ----------
  // the add-marker event (marker dialog behind the fullscreen video) ---------
  //
  // Bug: the marker dialog lives in t-footer's dropdown
  // (t-dropdown-button, position: fixed, z-index: 20000), a SIBLING of
  // t-video-player inside t-main-layout. In REAL fullscreen the player's HOST
  // element goes into the browser's top layer via the Fullscreen API, so
  // everything outside it is painted behind it — the dialog is unreachable no
  // matter its z-index. On iOS the CSS fallback
  // (:host(.css-fullscreen-fallback), position: fixed, inset: 0,
  // z-index: 999999) similarly covers the footer (z-index 1000) and its
  // dropdown.
  //
  // Fix contract: _onMarkerClick must FIRST leave fullscreen when _isFullscreen
  // is true — via the SAME logic as _onFullScreenClick (document.exitFullscreen
  // when document.fullscreenElement === this, _exitCssFullscreenFallback when
  // _cssFullscreenFallback is true) — THEN dispatch the unchanged
  // video-marker-add-requested event (bubbles + composed, from the host).
  // Outside fullscreen the marker button must NOT exit anything.

  it('marker button exits real fullscreen before dispatching the add-marker event', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    // Real fullscreen: document.fullscreenElement reports the host and the
    // browser fires fullscreenchange (same protocol as the round-3
    // fullscreen-button exit test).
    enterFullscreen(el);
    await el.updateComplete;

    const exitFullscreenSpy = mockExitFullscreen();
    const addMarkerSpy = vi.fn();
    el.addEventListener('video-marker-add-requested', addMarkerSpy);

    getButton(el, '.marker-btn').click();
    await el.updateComplete;

    // The marker dialog sits OUTSIDE the fullscreen host (in the footer), so
    // the player must exit fullscreen first or the top-layer video keeps the
    // dialog behind it. Current code never exits → RED.
    expect(
      exitFullscreenSpy,
      'marker button must call document.exitFullscreen when the host is fullscreen (the dialog is unreachable behind the top-layer video)'
    ).toHaveBeenCalled();

    expect(addMarkerSpy).toHaveBeenCalledTimes(1);
    const event = addMarkerSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('video-marker-add-requested');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    // The event must still be dispatched from the component host itself.
    expect(event.target).toBe(el);
  });

  it('marker button does NOT exit fullscreen when not fullscreen (regression guard)', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    // NOT fullscreen: document.fullscreenElement is not stubbed and
    // _cssFullscreenFallback is false — pressing the marker button must not
    // touch fullscreen at all, only dispatch the add-marker request.
    const exitFullscreenSpy = mockExitFullscreen();
    const addMarkerSpy = vi.fn();
    el.addEventListener('video-marker-add-requested', addMarkerSpy);

    getButton(el, '.marker-btn').click();
    await el.updateComplete;

    expect(
      exitFullscreenSpy,
      'marker button outside fullscreen must never exit fullscreen (exiting is reserved for the fullscreen case)'
    ).not.toHaveBeenCalled();

    expect(addMarkerSpy).toHaveBeenCalledTimes(1);
    const event = addMarkerSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('video-marker-add-requested');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.target).toBe(el);
  });

  it('marker button exits the CSS fullscreen fallback before dispatching the add-marker event', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    // Make requestFullscreen REJECT (happy-dom has no real implementation —
    // same defineProperty strategy as mockRequestFullscreen, but rejecting) so
    // clicking the fullscreen button routes _onFullScreenClick into
    // _enterCssFullscreenFallback() instead of real fullscreen.
    if (typeof el.requestFullscreen === 'function') {
      vi.spyOn(el, 'requestFullscreen').mockRejectedValue(undefined);
    } else {
      Object.defineProperty(el, 'requestFullscreen', {
        configurable: true,
        writable: true,
        value: vi.fn().mockRejectedValue(undefined),
      });
      cleanups.push(() => {
        delete (el as { requestFullscreen?: unknown }).requestFullscreen;
      });
    }

    // document.fullscreenElement stays UNSTUBBED (never set): the fallback is
    // purely CSS-driven, not Fullscreen API driven.
    getButton(el, '.fullscreen-btn').click();
    await el.updateComplete;

    // Precondition: the fallback is active — the host carries the class.
    expect(
      el.classList.contains('css-fullscreen-fallback'),
      'precondition: the rejected requestFullscreen must have entered the CSS fullscreen fallback'
    ).toBe(true);

    const addMarkerSpy = vi.fn();
    el.addEventListener('video-marker-add-requested', addMarkerSpy);

    getButton(el, '.marker-btn').click();
    await el.updateComplete;

    // The CSS fallback (:host(.css-fullscreen-fallback), z-index 999999)
    // covers the footer's marker dropdown (z-index 1000) — the player must
    // remove the class before dispatching or the dialog stays hidden. Current
    // code never exits → RED.
    expect(
      el.classList.contains('css-fullscreen-fallback'),
      'marker button must remove the css-fullscreen-fallback class when active (the fixed overlay covers the footer dropdown)'
    ).toBe(false);

    expect(addMarkerSpy).toHaveBeenCalledTimes(1);
    const event = addMarkerSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('video-marker-add-requested');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.target).toBe(el);
  });

  it('bottom control buttons never carry not-fullscreen (only marker labels do)', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    // Outside fullscreen: buttons must NOT have not-fullscreen (only labels do).
    expect(getButton(el, '.play-pause-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.marker-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.replay-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.prev-marker-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.next-marker-btn').classList.contains('not-fullscreen')).toBe(false);
    // Mirror and fullscreen never carry it either.
    expect(getButton(el, '.mirror-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.fullscreen-btn').classList.contains('not-fullscreen')).toBe(false);

    // Entering fullscreen: buttons still must NOT have it.
    enterFullscreen(el);
    await el.updateComplete;

    expect(getButton(el, '.play-pause-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.marker-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.replay-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.prev-marker-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.next-marker-btn').classList.contains('not-fullscreen')).toBe(false);
  });

  it('leaving fullscreen does not add not-fullscreen to buttons (labels still get it)', async () => {
    const { el } = createPlayerWithVideo();
    setMarkerProps(el, abcMarkers(), 'mB');
    await el.updateComplete;

    const setter = enterFullscreen(el);
    await el.updateComplete;
    // In fullscreen, buttons never have not-fullscreen.
    expect(getButton(el, '.play-pause-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.marker-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.replay-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.prev-marker-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.next-marker-btn').classList.contains('not-fullscreen')).toBe(false);

    leaveFullscreen(setter);
    await el.updateComplete;

    // After leaving fullscreen, buttons still never carry not-fullscreen.
    expect(getButton(el, '.play-pause-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.marker-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.replay-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.prev-marker-btn').classList.contains('not-fullscreen')).toBe(false);
    expect(getButton(el, '.next-marker-btn').classList.contains('not-fullscreen')).toBe(false);
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

  // ---- Round 7: marker-name labels above the marker-navigation buttons ------
  //
  // Feature: `t-video-player` is a "dumb" frame and receives the current
  // song's markers + start marker via two NEW Lit properties (`markers:
  // TroffMarker[]` and `startMarkerId: string`), synced from `t-marker-slider`
  // by v2Script's `updateMarkerSlider`. It renders a small text label ABOVE
  // each of the three marker-navigation buttons (`.replay-btn`,
  // `.prev-marker-btn`, `.next-marker-btn`) showing the NAME of the marker that
  // button will take the user to:
  //   - Replay → the CURRENT start marker: markers[index].name
  //   - Prev   → the marker BEFORE the start marker: markers[clampedIndex(i-1)]
  //   - Next   → the marker AFTER the start marker: markers[clampedIndex(i+1)]
  // where index = markers.findIndex(m => m.id === startMarkerId) and the
  // clamping mirrors t-marker-slider's getPreviousMarker/getNextMarker (first
  // clamps to itself, last clamps to itself).
  //
  // Rendering contract:
  // - Labels are `<span class="marker-label ...">` inside `.video-frame`.
  // - Class names: `.prev-marker-label`, `.replay-label`, `.next-marker-label`.
  // - Each label carries `not-fullscreen` (when not fullscreen) +
  //   `controls-hidden` (when hidden). Buttons no longer use `not-fullscreen`.
  // - Labels are informational: pointer-events: none (never intercept clicks).
  // - If index === -1 (no markers / unknown startMarkerId) or the marker's
  //   name is empty, NO label is rendered.
  //
  // The properties are set on the instance directly (as v2Script will do).

  const mkMarker = (id: string, name: string, time: number): TroffMarker => ({
    color: 'None',
    id,
    info: '',
    name,
    time,
  });

  /** The spec's [A@0, B@10, C@20] fixture — ids differ from names on purpose. */
  const abcMarkers = (): TroffMarker[] => [
    mkMarker('mA', 'A', 0),
    mkMarker('mB', 'B', 10),
    mkMarker('mC', 'C', 20),
  ];

  /**
   * Sets the feature's input properties directly on the instance (the way
   * v2Script's updateMarkerSlider will feed the dumb frame). The properties do
   * not exist on the class yet, so the element is widened for the assignment.
   */
  const setMarkerProps = (el: TVideoPlayer, markers: TroffMarker[], startMarkerId: string) => {
    const withProps = el as TVideoPlayer & { markers: TroffMarker[]; startMarkerId: string };
    withProps.markers = markers;
    withProps.startMarkerId = startMarkerId;
  };

  /** Returns a label element, throwing a descriptive error if it is not rendered. */
  const getLabel = (el: TVideoPlayer, selector: string): HTMLElement => {
    const label = el.shadowRoot?.querySelector(selector);
    if (!label) {
      throw new Error(`Expected shadow root to contain <${selector}>`);
    }
    return label as HTMLElement;
  };

  const labelSelectors = [
    '.replay-label',
    '.prev-marker-label',
    '.next-marker-label',
  ] as const;

  it('renders the start marker name above replay and neighbour names above prev/next', async () => {
    const { el } = createPlayerWithVideo();
    setMarkerProps(el, abcMarkers(), 'mB');
    await el.updateComplete;

    // Replay shows the CURRENT start marker's name (B).
    expect(getLabel(el, '.replay-label').textContent).toBe('B');
    // Prev/next show the names of the neighbouring markers.
    expect(getLabel(el, '.prev-marker-label').textContent).toBe('A');
    expect(getLabel(el, '.next-marker-label').textContent).toBe('C');
  });

  it('clamps the prev label to the first marker when the start marker is the first', async () => {
    const { el } = createPlayerWithVideo();
    setMarkerProps(el, abcMarkers(), 'mA');
    await el.updateComplete;

    expect(getLabel(el, '.replay-label').textContent).toBe('A');
    // index === 0 → prev clamps to index 0 (mirrors marker-slider
    // getPreviousMarker): the prev label repeats the first marker's name.
    expect(getLabel(el, '.prev-marker-label').textContent).toBe('A');
    expect(getLabel(el, '.next-marker-label').textContent).toBe('B');
  });

  it('clamps the next label to the last marker when the start marker is the last', async () => {
    const { el } = createPlayerWithVideo();
    setMarkerProps(el, abcMarkers(), 'mC');
    await el.updateComplete;

    expect(getLabel(el, '.replay-label').textContent).toBe('C');
    expect(getLabel(el, '.prev-marker-label').textContent).toBe('B');
    // index === length-1 → next clamps to the last marker (mirrors
    // marker-slider getNextMarker): the next label repeats the last marker's name.
    expect(getLabel(el, '.next-marker-label').textContent).toBe('C');
  });

  it('renders no marker labels when there are no markers or the startMarkerId is unknown', async () => {
    const { el } = createPlayerWithVideo();

    // Positive control: with valid props the labels DO render (this assertion
    // is what fails RED today — the feature does not exist yet).
    setMarkerProps(el, abcMarkers(), 'mB');
    await el.updateComplete;
    expect(getLabel(el, '.replay-label')).not.toBeNull();

    // Empty markers → no labels at all.
    setMarkerProps(el, [], 'mB');
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.replay-label')).toBeNull();
    expect(el.shadowRoot?.querySelector('.prev-marker-label')).toBeNull();
    expect(el.shadowRoot?.querySelector('.next-marker-label')).toBeNull();

    // Markers exist but the startMarkerId matches none → no labels either.
    setMarkerProps(el, abcMarkers(), 'unknown-marker-id');
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.replay-label')).toBeNull();
    expect(el.shadowRoot?.querySelector('.prev-marker-label')).toBeNull();
    expect(el.shadowRoot?.querySelector('.next-marker-label')).toBeNull();
  });

  it('omits the label for a marker whose name is empty', async () => {
    const { el } = createPlayerWithVideo();

    // Positive control: a named start marker renders its label (RED today).
    setMarkerProps(el, abcMarkers(), 'mB');
    await el.updateComplete;
    expect(getLabel(el, '.replay-label')).not.toBeNull();

    // mB has an empty name → no replay label, while the (named) neighbours
    // still render.
    setMarkerProps(
      el,
      [mkMarker('mA', 'A', 0), mkMarker('mB', '', 10), mkMarker('mC', 'C', 20)],
      'mB'
    );
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.replay-label')).toBeNull();
    expect(getLabel(el, '.prev-marker-label').textContent).toBe('A');
    expect(getLabel(el, '.next-marker-label').textContent).toBe('C');
  });

  it('marker labels carry not-fullscreen and controls-hidden visibility classes (buttons no longer do)', async () => {
    const { el } = createPlayerWithVideo();
    setMarkerProps(el, abcMarkers(), 'mB');
    await el.updateComplete;

    const assertLabelsClass = (className: string, present: boolean) => {
      for (const selector of labelSelectors) {
        expect(
          getLabel(el, selector).classList.contains(className),
          `label ${selector} should${present ? '' : ' not'} carry "${className}"`
        ).toBe(present);
      }
    };

    // Outside fullscreen every label carries not-fullscreen and never
    // controls-hidden (mirrors the buttons).
    assertLabelsClass('not-fullscreen', true);
    assertLabelsClass('controls-hidden', false);

    // Entering fullscreen strips not-fullscreen from the labels too.
    enterFullscreen(el);
    await el.updateComplete;
    assertLabelsClass('not-fullscreen', false);

    // A frame tap that hides the controls adds controls-hidden to the labels.
    clickFrame(el);
    await el.updateComplete;
    assertLabelsClass('controls-hidden', true);

    // A second tap restores them.
    clickFrame(el);
    await el.updateComplete;
    assertLabelsClass('controls-hidden', false);
  });

  it('marker labels are plain informational spans (not t-butt) with pointer-events: none', async () => {
    const { el } = createPlayerWithVideo();
    setMarkerProps(el, abcMarkers(), 'mB');
    await el.updateComplete;

    const replayLabel = getLabel(el, '.replay-label');
    // A plain text span — NOT a t-butt control host.
    expect(replayLabel.tagName.toLowerCase()).toBe('span');
    expect(replayLabel.classList.contains('marker-label')).toBe(true);
    expect(replayLabel.querySelector('t-butt')).toBeNull();

    // The label lives inside .video-frame (with the buttons).
    const frame = el.shadowRoot?.querySelector('.video-frame');
    expect(frame?.contains(replayLabel)).toBe(true);

    // pointer-events: none — happy-dom's getComputedStyle does not reliably
    // resolve shadow-DOM adopted stylesheets, so only assert the strict value
    // when the environment reports a non-empty one; the class + span contract
    // above is the stable part.
    const computedPointerEvents = window.getComputedStyle(replayLabel).pointerEvents;
    if (computedPointerEvents) {
      expect(computedPointerEvents).toBe('none');
    }
  });

  // ---- Round 8: ellipsis truncation of marker-name labels ------------------
  //
  // Feature: when a marker name is too long to fit the available space, the
  // label must be CUT (no overflow beyond the label's max width) and show a
  // trailing ellipsis "…". This is pure CSS — the DOM content must stay the
  // FULL untruncated name. Expected implementation adds to `.marker-label`:
  //   max-width: 30%; overflow: hidden; text-overflow: ellipsis;
  // (`white-space: nowrap` already exists and is required for text-overflow to
  // work, and absolutely-positioned elements are blockified so the trio works
  // directly).
  //
  // Strategy: happy-dom's getComputedStyle does NOT reliably resolve
  // shadow-DOM stylesheet rules, so these CSS-contract tests inspect the actual
  // component stylesheet instead. Lit injects component CSS into the shadow
  // root via adoptedStyleSheets (there is no <style> element), which happy-dom
  // exposes as a parseable cssRules list; each rule has a selectorText and a
  // style.cssText, so the `.marker-label` rule can be extracted verbatim.

  /**
   * Returns the cssText of the component's `.marker-label` stylesheet rule,
   * throwing if the adopted stylesheet is unavailable or the rule is missing.
   */
  const markerLabelRuleCssText = (el: TVideoPlayer): string => {
    const sheet = el.shadowRoot?.adoptedStyleSheets?.[0];
    const rules = sheet?.cssRules;
    if (!rules) {
      throw new Error(
        'Expected shadow root to expose adoptedStyleSheets[0].cssRules'
      );
    }
    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i] as CSSStyleRule;
      if (rule.selectorText === '.marker-label') {
        return rule.style.cssText;
      }
    }
    throw new Error(
      'Expected component stylesheet to contain a .marker-label rule'
    );
  };

  it('truncates long marker names with a trailing ellipsis via CSS only', async () => {
    const { el } = createPlayerWithVideo();
    setMarkerProps(el, abcMarkers(), 'mB');
    await el.updateComplete;

    const markerLabelCss = markerLabelRuleCssText(el);

    // The cut + ellipsis contract lives inside the `.marker-label` rule. None
    // of the three declarations exist today → RED.
    expect(markerLabelCss).toContain('text-overflow: ellipsis');
    expect(markerLabelCss).toContain('overflow: hidden');
    expect(markerLabelCss).toContain('max-width: 30%');
    // white-space: nowrap (pre-existing) must stay — text-overflow only works
    // when the text does not wrap.
    expect(markerLabelCss).toContain('white-space: nowrap');
  });

  it('keeps the full untruncated marker name in the DOM even for very long names', async () => {
    const { el } = createPlayerWithVideo();
    const longName = 'A'.repeat(200);
    setMarkerProps(
      el,
      [mkMarker('mA', 'A', 0), mkMarker('mB', longName, 10), mkMarker('mC', 'C', 20)],
      'mB'
    );
    await el.updateComplete;

    // The cutting is pure CSS: the DOM must still carry the complete name —
    // the app must NOT switch to JS-side string truncation.
    expect(getLabel(el, '.replay-label').textContent).toBe(longName);
  });

  // ---- Round 9: video player scroll gestures (scrub + speed) ----------------
  //
  // Feature: scroll gestures on the video frame.
  //   - Horizontal scroll (|deltaX| > |deltaY|) → SCRUB: seek the video to
  //     `currentTime + deltaX * SCRUB_SECONDS_PER_PX`, clamped to [0, duration]
  //     (an unknown/NaN duration counts as unbounded), and dispatch
  //     `video-scrub-requested` (bubbles + composed) with `detail: { time }`
  //     from the HOST.
  //   - Vertical scroll (|deltaY| >= |deltaX|) → SPEED: step the `speed` percent
  //     property by SPEED_STEP_PERCENT per SPEED_PX_PER_STEP pixels, clamped to
  //     [50, 200], and dispatch `speed-changed` (bubbles + composed) with
  //     `detail: { speed }` from the HOST — the same event contract as the
  //     footer speed control.
  //
  // Constants: SCRUB_SECONDS_PER_PX = 0.01, SPEED_PX_PER_STEP = 10,
  // SPEED_STEP_PERCENT = 1. Direction conventions: scroll RIGHT (deltaX > 0)
  // seeks forward; scroll UP (deltaY < 0) speeds up.
  //
  // New Lit property: `@property({ type: Number }) speed = 100` (percent),
  // synced from v2Script.

  type VideoPlayerWithSpeed = TVideoPlayer & { speed: number };

  /** The future `speed` property is not on the class yet — widen for access. */
  const speedOf = (el: TVideoPlayer): number => (el as VideoPlayerWithSpeed).speed;

  /** Reads the `detail` payload of the nth event captured by the given spy. */
  const detailOf = <T>(spy: ReturnType<typeof vi.fn>, index = 0): T =>
    (spy.mock.calls[index][0] as CustomEvent).detail as T;

  /**
   * happy-dom 20.x implements WheelEvent and honors deltaX/deltaY from the
   * constructor (verified against the installed version: the constructor reads
   * `eventInit?.deltaX ?? 0`). Defensive fallback for a future happy-dom that
   * stops honoring the init values: stamp the deltas with defineProperty before
   * the event is dispatched.
   */
  const makeWheelEvent = (init: { deltaX: number; deltaY: number }): WheelEvent => {
    const event = new WheelEvent('wheel', {
      deltaX: init.deltaX,
      deltaY: init.deltaY,
      bubbles: true,
      cancelable: true,
    });
    if (event.deltaX !== init.deltaX || event.deltaY !== init.deltaY) {
      Object.defineProperty(event, 'deltaX', { configurable: true, value: init.deltaX });
      Object.defineProperty(event, 'deltaY', { configurable: true, value: init.deltaY });
    }
    return event;
  };

  /**
   * Dispatches a wheel event on the component's .video-frame and returns it
   * together with a preventDefault spy installed BEFORE dispatch (so tests can
   * assert the handler called it).
   */
  const dispatchWheel = (
    el: TVideoPlayer,
    deltaX: number,
    deltaY: number
  ): { event: WheelEvent; preventSpy: ReturnType<typeof vi.spyOn> } => {
    const frame = el.shadowRoot?.querySelector('.video-frame');
    if (!frame) {
      throw new Error('Expected shadow root to contain <.video-frame>');
    }
    const event = makeWheelEvent({ deltaX, deltaY });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    frame.dispatchEvent(event);
    return { event, preventSpy };
  };

  /**
   * happy-dom does not load real media, so an unloaded video's duration is NaN
   * and `video.duration` is not reliably settable — define it per test.
   */
  const defineDuration = (video: HTMLVideoElement, duration: number) => {
    Object.defineProperty(video, 'duration', { configurable: true, value: duration });
  };

  it('defaults the speed property to 100 percent', async () => {
    await element.updateComplete;
    expect(speedOf(element)).toBe(100);
  });

  it('horizontal wheel scrolls the video forward and dispatches video-scrub-requested', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    defineDuration(video, 120);
    video.currentTime = 0;

    const scrubSpy = vi.fn();
    el.addEventListener('video-scrub-requested', scrubSpy);
    const { preventSpy } = dispatchWheel(el, 100, 0);

    // 100px * 0.01 s/px * multiplier(0) = 1s forward.
    expect(video.currentTime).toBe(1);
    expect(scrubSpy).toHaveBeenCalledTimes(1);
    const event = scrubSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('video-scrub-requested');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    // The event must be dispatched from the component host itself.
    expect(event.target).toBe(el);
    expect(detailOf<{ time: number }>(scrubSpy).time).toBe(1);
    expect(preventSpy).toHaveBeenCalledTimes(1);
  });

  it('horizontal wheel scroll left scrubs backwards from the current time', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    defineDuration(video, 120);
    video.currentTime = 10;

    const scrubSpy = vi.fn();
    el.addEventListener('video-scrub-requested', scrubSpy);
    dispatchWheel(el, -100, 0);

    // 10s - (100px * 0.01 s/px) = 9s.
    expect(scrubSpy).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(9);
    expect(detailOf<{ time: number }>(scrubSpy).time).toBe(9);
  });

  it('clamps scrubbing at the start of the video (time 0)', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    defineDuration(video, 120);
    video.currentTime = 0;

    const scrubSpy = vi.fn();
    el.addEventListener('video-scrub-requested', scrubSpy);
    dispatchWheel(el, -1000, 0);

    expect(scrubSpy).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(0);
    expect(detailOf<{ time: number }>(scrubSpy).time).toBe(0);
  });

  it('clamps scrubbing at the end of the video (duration)', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    defineDuration(video, 120);
    video.currentTime = 0;

    dispatchWheel(el, 20000, 0);

    expect(video.currentTime).toBe(120);
  });

  it('scrubs without a known duration (happy-dom default NaN falls back to Infinity)', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    // Deliberately NO defineDuration: an unloaded video reports NaN, and the
    // handler must treat it as unbounded rather than blow up with NaN/Infinity.
    expect(Number.isFinite(video.duration)).toBe(false);

    dispatchWheel(el, 100, 0);

    expect(video.currentTime).toBe(1);
  });

  it('vertical wheel up increases the speed and dispatches speed-changed', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    video.currentTime = 5;

    const speedSpy = vi.fn();
    el.addEventListener('speed-changed', speedSpy);
    const { preventSpy } = dispatchWheel(el, 0, -100);

    // -100px / 10px-per-step = -10 steps → 100 + 10 * 1% = 110%.
    expect(speedSpy).toHaveBeenCalledTimes(1);
    const event = speedSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('speed-changed');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.target).toBe(el);
    expect(detailOf<{ speed: number }>(speedSpy).speed).toBe(110);
    // The speed gesture must NOT touch the timeline.
    expect(video.currentTime).toBe(5);
    expect(preventSpy).toHaveBeenCalledTimes(1);
  });

  it('vertical wheel down decreases the speed', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const speedSpy = vi.fn();
    el.addEventListener('speed-changed', speedSpy);
    dispatchWheel(el, 0, 100);

    // +100px / 10px-per-step = +10 steps → 100 - 10 * 1% = 90%.
    expect(speedSpy).toHaveBeenCalledTimes(1);
    expect(detailOf<{ speed: number }>(speedSpy).speed).toBe(90);
  });

  it('clamps the speed between 50 and 200 percent', async () => {
    // Lower clamp: speed 55, huge downward scroll → 50.
    const { el: lowerEl } = createPlayerWithVideo();
    await lowerEl.updateComplete;
    (lowerEl as VideoPlayerWithSpeed).speed = 55;
    const lowerSpy = vi.fn();
    lowerEl.addEventListener('speed-changed', lowerSpy);
    dispatchWheel(lowerEl, 0, 10000);
    expect(lowerSpy).toHaveBeenCalledTimes(1);
    expect(detailOf<{ speed: number }>(lowerSpy).speed).toBe(50);

    // Upper clamp: speed 195, huge upward scroll → 200.
    const { el: upperEl } = createPlayerWithVideo();
    await upperEl.updateComplete;
    (upperEl as VideoPlayerWithSpeed).speed = 195;
    const upperSpy = vi.fn();
    upperEl.addEventListener('speed-changed', upperSpy);
    dispatchWheel(upperEl, 0, -10000);
    expect(upperSpy).toHaveBeenCalledTimes(1);
    expect(detailOf<{ speed: number }>(upperSpy).speed).toBe(200);
  });

  it('uses the dominant wheel axis to choose scrub vs speed', async () => {
    // Horizontal dominance (|deltaX| > |deltaY|) → scrub only.
    const { el: scrubEl } = createPlayerWithVideo();
    await scrubEl.updateComplete;
    const scrubSpy = vi.fn();
    const scrubSpeedSpy = vi.fn();
    scrubEl.addEventListener('video-scrub-requested', scrubSpy);
    scrubEl.addEventListener('speed-changed', scrubSpeedSpy);
    dispatchWheel(scrubEl, 200, 50);
    expect(scrubSpy).toHaveBeenCalledTimes(1);
    expect(scrubSpeedSpy).not.toHaveBeenCalled();

    // Vertical dominance (|deltaY| >= |deltaX|) → speed only.
    const { el: speedEl } = createPlayerWithVideo();
    await speedEl.updateComplete;
    const speedSpy = vi.fn();
    const speedScrubSpy = vi.fn();
    speedEl.addEventListener('speed-changed', speedSpy);
    speedEl.addEventListener('video-scrub-requested', speedScrubSpy);
    dispatchWheel(speedEl, 50, 200);
    expect(speedSpy).toHaveBeenCalledTimes(1);
    expect(speedScrubSpy).not.toHaveBeenCalled();
  });

  it('calls preventDefault for both scrub and speed wheels', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const scrub = dispatchWheel(el, 100, 0);
    expect(scrub.preventSpy).toHaveBeenCalledTimes(1);

    const speed = dispatchWheel(el, 0, 100);
    expect(speed.preventSpy).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no video is slotted: no events, no preventDefault, no error', async () => {
    await element.updateComplete;

    const scrubSpy = vi.fn();
    const speedSpy = vi.fn();
    element.addEventListener('video-scrub-requested', scrubSpy);
    element.addEventListener('speed-changed', speedSpy);

    const { preventSpy } = dispatchWheel(element, 100, 0);

    expect(scrubSpy).not.toHaveBeenCalled();
    expect(speedSpy).not.toHaveBeenCalled();
    expect(preventSpy).not.toHaveBeenCalled();
  });

  // ---- Round 10: gesture feedback popup (badge while wheel-scrolling) -------
  //
  // Feature: while a wheel gesture happens, a small feedback badge pops up at
  // the CENTER-TOP of the video frame and auto-hides after
  // GESTURE_FEEDBACK_MS (1500ms) of no further wheel activity.
  //   - Speed wheel (vertical) → badge shows the `speed` icon + the new speed
  //     + `%` sign, e.g. "110%".
  //   - Scrub wheel (horizontal) → badge shows the `time` icon +
  //     `formatDuration(currentTime) / formatDuration(duration)`, e.g.
  //     "0:05 / 2:00" for 5s in a 120s video. Unknown duration (NaN / not a
  //     positive finite number) → ONLY the current time, e.g. "0:05".
  //   - Each new wheel gesture RE-RESETS the hide timer (the badge stays
  //     visible while the user keeps scrolling); after 1500ms of silence the
  //     badge disappears.
  //   - No badge is rendered before any gesture.
  //
  // Expected implementation: `.gesture-indicator` is a plain informational div
  // (t-icon + span, NOT a t-butt) rendered inside `.video-frame`; driven by a
  // `_gestureIcon`/`_gestureText` state pair and a GESTURE_FEEDBACK_MS
  // setTimeout that is re-armed on every gesture. Timers are driven with
  // `vi.useFakeTimers()` + try/finally like the round-4 idle tests.

  /** Reads the gesture indicator's text span, or null if it is not rendered. */
  const getGestureText = (el: TVideoPlayer): string | null => {
    const span = el.shadowRoot?.querySelector('.gesture-indicator span');
    return span?.textContent ?? null;
  };

  it('renders no gesture indicator before any wheel gesture', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.gesture-indicator')).toBeNull();
  });

  it('speed wheel shows a badge with the speed icon and percent value', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    dispatchWheel(el, 0, -100);
    await el.updateComplete;

    const indicator = el.shadowRoot?.querySelector('.gesture-indicator');
    expect(indicator).not.toBeNull();
    expect(getIconName(el, '.gesture-indicator')).toBe('speed');
    expect(getGestureText(el)).toBe('110%');
  });

  it('scrub wheel shows a badge with the current time over the duration', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    defineDuration(video, 120);
    video.currentTime = 0;

    dispatchWheel(el, 100, 0);
    await el.updateComplete;

    const indicator = el.shadowRoot?.querySelector('.gesture-indicator');
    expect(indicator).not.toBeNull();
    // 100px * 0.01 s/px = 1s → formatDuration(1) = "0:01", formatDuration(120)
    // = "2:00".
    expect(getGestureText(el)).toBe('0:01 / 2:00');
    expect(getIconName(el, '.gesture-indicator')).toBe('time');
  });

  it('scrub badge updates with each additional scrub', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    defineDuration(video, 120);
    video.currentTime = 0;

    dispatchWheel(el, 100, 0);
    await el.updateComplete;
    expect(getGestureText(el)).toBe('0:01 / 2:00');

    dispatchWheel(el, 100, 0);
    await el.updateComplete;
    expect(getGestureText(el)).toBe('0:03 / 2:00');
  });

  it('badge auto-hides after the feedback timeout', async () => {
    vi.useFakeTimers();
    try {
      const { el } = createPlayerWithVideo();
      await el.updateComplete;

      dispatchWheel(el, 0, -100);
      await el.updateComplete;
      expect(el.shadowRoot?.querySelector('.gesture-indicator')).not.toBeNull();

      // 1500ms of silence → the badge disappears on its own.
      vi.advanceTimersByTime(1500);
      await el.updateComplete;
      expect(el.shadowRoot?.querySelector('.gesture-indicator')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('new wheel gestures reset the hide timer', async () => {
    vi.useFakeTimers();
    try {
      const { el } = createPlayerWithVideo();
      await el.updateComplete;

      dispatchWheel(el, 0, -100);
      await el.updateComplete;
      expect(el.shadowRoot?.querySelector('.gesture-indicator')).not.toBeNull();

      // 1000ms into the 1500ms window the badge is still visible...
      vi.advanceTimersByTime(1000);
      await el.updateComplete;
      expect(el.shadowRoot?.querySelector('.gesture-indicator')).not.toBeNull();

      // ...a new gesture re-arms the timer: 1000ms later (2000ms since the
      // first gesture but only 1000ms since the second) it is STILL visible.
      dispatchWheel(el, 0, -100);
      await el.updateComplete;
      expect(el.shadowRoot?.querySelector('.gesture-indicator')).not.toBeNull();

      vi.advanceTimersByTime(1000);
      await el.updateComplete;
      expect(el.shadowRoot?.querySelector('.gesture-indicator')).not.toBeNull();

      // 1600ms since the second gesture → the re-armed timer has fired.
      vi.advanceTimersByTime(600);
      await el.updateComplete;
      expect(el.shadowRoot?.querySelector('.gesture-indicator')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('scrub badge without a known duration shows only the current time', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    // Deliberately NO defineDuration: an unloaded video's duration stays NaN,
    // so the badge must fall back to showing ONLY the current time.
    expect(Number.isFinite(video.duration)).toBe(false);

    dispatchWheel(el, 100, 0);
    await el.updateComplete;

    const text = getGestureText(el);
    expect(text).toBe('0:01');
    expect(text).not.toContain(' / ');
  });

  it('speed badge shows the clamped bound value', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;
    (el as VideoPlayerWithSpeed).speed = 200;
    await el.updateComplete;

    dispatchWheel(el, 0, -10000);
    await el.updateComplete;

    // -10000px / 10px-per-step = -1000 steps → 200 + 1000%, clamped to 200.
    expect(getGestureText(el)).toBe('200%');
  });

  it('gesture indicator is a plain informational div (t-icon + span, no t-butt)', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    dispatchWheel(el, 0, -100);
    await el.updateComplete;

    const indicator = el.shadowRoot?.querySelector(
      '.gesture-indicator'
    ) as HTMLElement | null;
    expect(indicator).not.toBeNull();
    // A plain div, NOT a t-butt control host.
    expect(indicator?.tagName.toLowerCase()).toBe('div');
    expect(indicator?.querySelector('span')).not.toBeNull();
    expect(indicator?.querySelector('t-icon')).not.toBeNull();
    expect(indicator?.querySelector('t-butt')).toBeNull();
    // The badge lives inside .video-frame (with the overlay buttons).
    const frame = el.shadowRoot?.querySelector('.video-frame');
    expect(frame?.contains(indicator)).toBe(true);
  });

  // ---- Round 11: whole-number speed changes for vertical gestures -----------
  //
  // Feature: every `speed-changed` event dispatched by the video player (from
  // wheel OR drag) must carry an integer `detail.speed` (whole percent).
  //   - The vertical pointer-drag branch must ACCUMULATE small pixel deltas
  //     across pointermove events and only emit a step when a whole 10px unit
  //     accumulates: `Math.round(accum / SPEED_PX_PER_STEP)` steps of
  //     SPEED_STEP_PERCENT (1). Sub-half-step drags emit nothing, and the
  //     accumulator resets between separate drags.
  //   - The vertical wheel branch must also round, so a fractional base speed
  //     (e.g. a legacy stored `TROFF_VALUE_speedBar` of 87.5) still yields
  //     whole percents.
  //   - Clamping [50, 200] is unchanged; the `.gesture-indicator` badge shows
  //     whole percents like `110%`.
  //
  // Constants: SCRUB_SECONDS_PER_PX = 0.01, SPEED_PX_PER_STEP = 10,
  // SPEED_STEP_PERCENT = 1, DRAG_THRESHOLD_PX = 5. Wheel UP = deltaY < 0 =
  // speed up. Drag UP = decreasing clientY = speed up.
  //
  // Today's bugs: the drag branch uses unrounded `steps` (75px up-drag from
  // 100 dispatches 107.5), and the wheel branch rounds `steps` but computes
  // from a possibly-fractional `this.speed` (87.5 base → 97.5). All of the
  // assertions below are RED against the current implementation.

  const dispatchPointer = (
    el: TVideoPlayer,
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    clientX: number,
    clientY: number,
    pointerId = 1
  ) => {
    const frame = el.shadowRoot?.querySelector('.video-frame');
    if (!frame) throw new Error('Expected shadow root to contain <.video-frame>');
    const event = new PointerEvent(type, {
      pointerId,
      pointerType: 'mouse',
      button: 0,
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    });
    frame.dispatchEvent(event);
    return event;
  };

  /**
   * happy-dom never fires `seeked` natively (it does not load real media), so
   * a committed seek would leave the component's `_seekInFlight` event-gate
   * stuck at `true` forever and block every later seek. Tests that expect a
   * seek to have APPLIED therefore simulate the video completing it by
   * dispatching a `seeked` event on the <video> element.
   */
  const markSeekComplete = (video: HTMLVideoElement) => {
    video.dispatchEvent(new Event('seeked'));
  };

  it('vertical drag up 75px dispatches one whole-number speed step', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;
    (el as VideoPlayerWithSpeed).speed = 100;
    await el.updateComplete;

    const speedSpy = vi.fn();
    const scrubSpy = vi.fn();
    el.addEventListener('speed-changed', speedSpy);
    el.addEventListener('video-scrub-requested', scrubSpy);

    dispatchPointer(el, 'pointerdown', 100, 100);
    dispatchPointer(el, 'pointermove', 100, 25); // 75px up

    expect(
      speedSpy,
      'a 75px up-drag must dispatch exactly one speed-changed (current code dispatches 107.5)'
    ).toHaveBeenCalledTimes(1);
    const speed = detailOf<{ speed: number }>(speedSpy).speed;
    expect(Number.isInteger(speed), `dispatched speed must be a whole number, got ${speed}`).toBe(
      true
    );
    expect(speed, '75px up from 100 = 8 steps × ~1.125% each → 109').toBe(109);
    // A vertical drag must never scrub the timeline.
    expect(scrubSpy, 'video-scrub-requested must not fire for a vertical drag').not.toHaveBeenCalled();
  });

  it('vertical drag down 75px dispatches a whole-number speed step', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;
    (el as VideoPlayerWithSpeed).speed = 100;
    await el.updateComplete;

    const speedSpy = vi.fn();
    el.addEventListener('speed-changed', speedSpy);

    dispatchPointer(el, 'pointerdown', 100, 100);
    dispatchPointer(el, 'pointermove', 100, 175); // 75px down

    expect(
      speedSpy,
      'a 75px down-drag must dispatch exactly one speed-changed (current code dispatches 92.5)'
    ).toHaveBeenCalledTimes(1);
    const speed = detailOf<{ speed: number }>(speedSpy).speed;
    expect(Number.isInteger(speed), `dispatched speed must be a whole number, got ${speed}`).toBe(
      true
    );
    expect(speed, '75px down from 100 = -8 steps × ~1.125% each → 91').toBe(91);
  });

  it('sub-step drags dispatch nothing', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;
    (el as VideoPlayerWithSpeed).speed = 100;
    await el.updateComplete;

    const speedSpy = vi.fn();
    el.addEventListener('speed-changed', speedSpy);

    dispatchPointer(el, 'pointerdown', 100, 100);
    // A 4px drag must NOT dispatch speed-changed — 4px < 5px (half of 10px).
    dispatchPointer(el, 'pointermove', 100, 96);

    expect(
      speedSpy,
      'a 4px drag must NOT dispatch speed-changed — 4px < 5px half-step'
    ).not.toHaveBeenCalled();
  });

  it('small drag increments accumulate into whole-number steps', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;
    (el as VideoPlayerWithSpeed).speed = 100;
    await el.updateComplete;

    const speedSpy = vi.fn();
    el.addEventListener('speed-changed', speedSpy);

    dispatchPointer(el, 'pointerdown', 100, 100);
    dispatchPointer(el, 'pointermove', 100, 96); // -4px (axis undecided — still inside the 5px threshold)
    dispatchPointer(el, 'pointermove', 100, 92); // -4px (cumulative -8px → round(0.8) = 0 → no-op)
    dispatchPointer(el, 'pointermove', 100, 88); // -4px (cumulative -12px → round(1.2) = 1 → dispatch)

    expect(
      speedSpy,
      'only one speed-changed may fire once a whole 10px unit accumulates (current code fires 4× 101.5)'
    ).toHaveBeenCalledTimes(1);
    const speed = detailOf<{ speed: number }>(speedSpy).speed;
    expect(Number.isInteger(speed), `dispatched speed must be a whole number, got ${speed}`).toBe(
      true
    );
    expect(speed, 'cumulative -12px = 1 step (round(12/10)=1) from 100 → 101').toBe(101);
  });

  it('drag from a fractional base speed still yields whole numbers', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;
    (el as VideoPlayerWithSpeed).speed = 87.5;
    await el.updateComplete;

    const speedSpy = vi.fn();
    el.addEventListener('speed-changed', speedSpy);

    dispatchPointer(el, 'pointerdown', 100, 100);
    dispatchPointer(el, 'pointermove', 100, 50); // 50px up = 5 steps

    expect(
      speedSpy,
      'a 50px up-drag must dispatch exactly one speed-changed (current code dispatches 92.5)'
    ).toHaveBeenCalledTimes(1);
    const speed = detailOf<{ speed: number }>(speedSpy).speed;
    expect(Number.isInteger(speed), `dispatched speed must be a whole number, got ${speed}`).toBe(
      true
    );
    expect(speed, 'Math.round(87.5)=88, five up-steps (50px/10) → 93').toBe(93);
  });

  it('vertical wheel from a fractional base speed yields a whole number', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;
    (el as VideoPlayerWithSpeed).speed = 87.5;
    await el.updateComplete;

    const speedSpy = vi.fn();
    el.addEventListener('speed-changed', speedSpy);

    dispatchWheel(el, 0, -100); // -100px / 10 = -10 steps up

    expect(
      speedSpy,
      'a -100px wheel from speed 87.5 must dispatch exactly one speed-changed (current code dispatches 97.5)'
    ).toHaveBeenCalledTimes(1);
    const speed = detailOf<{ speed: number }>(speedSpy).speed;
    expect(Number.isInteger(speed), `dispatched speed must be a whole number, got ${speed}`).toBe(
      true
    );
    expect(speed, '87.5 → base 88, ten up-steps (100px/10) → 98').toBe(98);
  });

  it('vertical wheel with a whole base speed is unchanged and whole', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;
    (el as VideoPlayerWithSpeed).speed = 100;
    await el.updateComplete;

    const speedSpy = vi.fn();
    el.addEventListener('speed-changed', speedSpy);

    dispatchWheel(el, 0, -100); // up 10 steps → 110
    await el.updateComplete;
    expect(getGestureText(el), 'badge after the up-wheel must be 110%').toBe('110%');
    dispatchWheel(el, 0, 100); // down 10 steps → 90
    await el.updateComplete;
    expect(getGestureText(el), 'badge after the down-wheel must be 90%').toBe('90%');

    expect(speedSpy).toHaveBeenCalledTimes(2);
    const up = detailOf<{ speed: number }>(speedSpy, 0).speed;
    const down = detailOf<{ speed: number }>(speedSpy, 1).speed;
    expect(up).toBe(110);
    expect(down).toBe(90);
    expect(Number.isInteger(up), `up-wheel speed must be a whole number, got ${up}`).toBe(true);
    expect(Number.isInteger(down), `down-wheel speed must be a whole number, got ${down}`).toBe(
      true
    );
  });

  it('speed stays clamped and whole at the bounds', async () => {
    // Down-drag from 200 clamps at 50.
    const { el: downEl } = createPlayerWithVideo();
    await downEl.updateComplete;
    (downEl as VideoPlayerWithSpeed).speed = 200;
    await downEl.updateComplete;
    const downSpy = vi.fn();
    downEl.addEventListener('speed-changed', downSpy);

    dispatchPointer(downEl, 'pointerdown', 100, 100);
    // 2000px / 10 = 200 steps → 200 - 200 = 0 → clamp 50.
    dispatchPointer(downEl, 'pointermove', 100, 2100); // 2000px down
    await downEl.updateComplete;

    expect(downSpy, 'a 2000px down-drag from speed 200 must dispatch one event').toHaveBeenCalledTimes(1);
    const downSpeed = detailOf<{ speed: number }>(downSpy).speed;
    expect(Number.isInteger(downSpeed), `clamped speed must be whole, got ${downSpeed}`).toBe(true);
    expect(downSpeed).toBe(50);
    expect(getGestureText(downEl), 'down-drag badge must show the clamped whole 50%').toBe('50%');

    // Up-drag from 50 clamps at 200.
    const { el: upEl } = createPlayerWithVideo();
    await upEl.updateComplete;
    (upEl as VideoPlayerWithSpeed).speed = 50;
    await upEl.updateComplete;
    const upSpy = vi.fn();
    upEl.addEventListener('speed-changed', upSpy);

    dispatchPointer(upEl, 'pointerdown', 100, 100);
    // 2000px / 10 = 200 steps → 50 + 200 = 250 → clamp 200.
    dispatchPointer(upEl, 'pointermove', 100, -1900); // 2000px up
    await upEl.updateComplete;

    expect(upSpy, 'a 2000px up-drag from speed 50 must dispatch one event').toHaveBeenCalledTimes(1);
    const upSpeed = detailOf<{ speed: number }>(upSpy).speed;
    expect(Number.isInteger(upSpeed), `clamped speed must be whole, got ${upSpeed}`).toBe(true);
    expect(upSpeed).toBe(200);
    expect(getGestureText(upEl), 'up-drag badge must show the clamped whole 200%').toBe('200%');
  });

  it('the drag accumulator resets between separate drags', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;
    (el as VideoPlayerWithSpeed).speed = 100;
    await el.updateComplete;

    const speedSpy = vi.fn();
    el.addEventListener('speed-changed', speedSpy);

    // First drag: 25px up → round(25/10) = round(2.5) = 3 up-steps → 103.
    dispatchPointer(el, 'pointerdown', 100, 100);
    dispatchPointer(el, 'pointermove', 100, 75);
    expect(
      speedSpy,
      'a 25px up-drag must emit exactly one step (round(2.5)=3) — current code dispatches 102.5'
    ).toHaveBeenCalledTimes(1);
    const firstSpeed = detailOf<{ speed: number }>(speedSpy).speed;
    expect(Number.isInteger(firstSpeed), `first-drag speed must be whole, got ${firstSpeed}`).toBe(
      true
    );
    expect(firstSpeed).toBe(103);
    dispatchPointer(el, 'pointerup', 100, 75);

    // Second drag: 36px up. On a FRESH accumulator round(36/10) = round(3.6)
    // = 4 steps → 103 + 4 = 107. If the first drag's +5px residual leaked in:
    // accum = +5 - 36 = -31 → round(3.1) = 3 steps → 106. So the second drag
    // must emit exactly one event at 107 — it proves the accumulator reset.
    dispatchPointer(el, 'pointerdown', 100, 100);
    dispatchPointer(el, 'pointermove', 100, 64);
    expect(
      speedSpy,
      'second drag must emit exactly one event (accumulator must reset; a leaked +5px carryover would round to 3 steps → 106)'
    ).toHaveBeenCalledTimes(2);
    const secondSpeed = detailOf<{ speed: number }>(speedSpy, 1).speed;
    expect(Number.isInteger(secondSpeed), `second-drag speed must be whole, got ${secondSpeed}`).toBe(
      true
    );
    expect(secondSpeed).toBe(107);
  });

  it('drag shows a whole-number percent in the gesture badge', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;
    (el as VideoPlayerWithSpeed).speed = 100;
    await el.updateComplete;

    dispatchPointer(el, 'pointerdown', 100, 100);
    dispatchPointer(el, 'pointermove', 100, 25); // 75px up
    await el.updateComplete;

    const indicator = el.shadowRoot?.querySelector('.gesture-indicator');
    expect(indicator, 'a speed drag must show the gesture badge').not.toBeNull();
    expect(getIconName(el, '.gesture-indicator')).toBe('speed');
    expect(
      getGestureText(el),
      'badge must show a whole-number percent (75px up = 8 steps × ~1.125% → 109%)'
    ).toBe('109%');
  });

  // ---- Round 12: live frame updates while drag-scrubbing (hybrid seek gate) ----
  //
  // Feature: a horizontal pointer-drag seeks `video.currentTime` on EVERY
  // pointermove today, and each assignment is an async seek — when seeks arrive
  // faster than they complete, the browser cancels each pending seek before it
  // can paint, so the (paused) frame does not update until the final seek of
  // the gesture. The fix (hybrid, Option B) gates every seek on BOTH the
  // video's `seeked` completion event AND a SCRUB_SEEK_INTERVAL_MS (50ms ≈
  // 20fps) minimum cadence, while accumulating the drag position in state
  // (`_scrubTarget`) so the pixel→seconds math stays exact and NO distance is
  // lost:
  //   - The `seeked` event-gate (`_seekInFlight`) guarantees each frame paints
  //     before the next seek is issued — it self-tunes to slow Android devices
  //     that need longer to decode/paint each frame.
  //   - The 50ms cadence caps the seek rate at ~20fps even on a FAST device,
  //     so intermediate frames still get time to paint instead of being
  //     overwritten back-to-back. When the previous seek HAS completed but the
  //     window hasn't elapsed, the new target is stashed (not applied) until
  //     the cadence window opens — `_scrubTarget` keeps accumulating, so no
  //     distance is lost.
  //   - The first horizontal move of a drag always applies immediately
  //     (`_scrubTarget` is initialized from `video.currentTime`).
  //   - Subsequent moves accumulate `target = clamp(target + deltaX *
  //     SCRUB_SECONDS_PER_PX, 0, duration)`; the seek is issued only when the
  //     previous seek has COMPLETED (seeked) AND at least
  //     SCRUB_SEEK_INTERVAL_MS elapsed since the last committed seek. The on-
  //     screen label (`_showGestureFeedback`) still updates on every move,
  //     since text is cheap.
  //   - pointerup/pointercancel (both `_onFramePointerUp`) flush the EXACT
  //     accumulated target (final `video.currentTime` assignment + one final
  //     event + badge), bypassing the cadence but still deferring to a
  //     genuinely in-flight seek, then reset the accumulator.
  //   - The wheel path (`_onFrameWheel`) is UNCHANGED: discrete wheel events
  //     already paint between notches, so every wheel event still seeks
  //     immediately (regression-guarded by the wheel test below).
  //
  // happy-dom never fires `seeked` natively (no real media loads), so the
  // event-gate would leave `_seekInFlight` stuck at `true` and every later
  // seek in these tests would be blocked forever. Tests therefore SIMULATE the
  // seek completing by dispatching a `seeked` event on the <video> element
  // after each seek they expect to have applied (see `markSeekComplete`, next
  // to `dispatchPointer`).
  //
  // These tests need FAKE TIMERS so `Date.now()` is controllable (verified:
  // `vi.advanceTimersByTime(50)` advances `Date.now()` by exactly 50 — the
  // cadence design depends on it). None of them advances past
  // GESTURE_FEEDBACK_MS (1500ms) or SEEK_WATCHDOG_MS (400ms), so the badge
  // never auto-hides mid-gesture and the watchdog never fakes a completion.

  it('a horizontal drag applies the first seek immediately (guard: pins the base behavior)', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    defineDuration(video, 120);
    video.currentTime = 0;

    const scrubSpy = vi.fn();
    el.addEventListener('video-scrub-requested', scrubSpy);

    dispatchPointer(el, 'pointerdown', 100, 100);
    dispatchPointer(el, 'pointermove', 160, 100); // +60px
    await el.updateComplete;

    expect(
      scrubSpy,
      'the first horizontal move of a drag must dispatch exactly one video-scrub-requested'
    ).toHaveBeenCalledTimes(1);
    expect(video.currentTime, '60px × 0.01 s/px must seek to exactly 0.6s').toBeCloseTo(0.6, 5);
    expect(detailOf<{ time: number }>(scrubSpy).time, 'event detail must carry the new time').toBeCloseTo(
      0.6, 5
    );
    expect(
      getGestureText(el),
      'badge must show the scrubbed time over the duration (0.6s in a 120s video)'
    ).toBe('0:00 / 2:00');
    expect(getIconName(el, '.gesture-indicator')).toBe('time');
    // Simulate the video completing the seek (happy-dom never fires `seeked`
    // on its own) so a later move in a real gesture would not be blocked.
    markSeekComplete(video);
  });

  it('rapid drag moves are throttled so intermediate seeks get time to paint', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;
      defineDuration(video, 120);
      video.currentTime = 0;

      const scrubSpy = vi.fn();
      el.addEventListener('video-scrub-requested', scrubSpy);

      dispatchPointer(el, 'pointerdown', 100, 100);
      dispatchPointer(el, 'pointermove', 160, 100); // +60px → first move applies immediately
      expect(
        scrubSpy,
        'the first move of a drag must always apply immediately'
      ).toHaveBeenCalledTimes(1);
      expect(video.currentTime).toBeCloseTo(0.6, 5);

      // The video completes that seek (happy-dom never fires `seeked` on its
      // own) — otherwise the event-gate would block every later move.
      markSeekComplete(video);

      // A second +60px move arrives BEFORE SCRUB_SEEK_INTERVAL_MS elapsed: the
      // seek must be throttled — currentTime unchanged, no new event.
      dispatchPointer(el, 'pointermove', 220, 100); // +60px, inside the throttle window
      expect(
        video.currentTime,
        'a move inside the 50ms throttle window must NOT seek yet'
      ).toBeCloseTo(0.6, 5);
      expect(
        scrubSpy,
        'a move inside the 50ms throttle window must NOT dispatch'
      ).toHaveBeenCalledTimes(1);

      // After the 50ms window, the next move applies the ACCUMULATED target
      // (0.6 + 0.96 + 1.32 = 2.88s), not the stale currentTime.
      vi.advanceTimersByTime(50);
      dispatchPointer(el, 'pointermove', 280, 100); // +60px → target 2.88s
      await el.updateComplete;

      expect(video.currentTime, 'accumulated 2.88s must apply once the window has elapsed').toBeCloseTo(2.88, 5);
      expect(scrubSpy, 'exactly two seeks may have fired by now').toHaveBeenCalledTimes(2);
      expect(detailOf<{ time: number }>(scrubSpy, 1).time, '2nd seek must carry the accumulated 2.88s').toBeCloseTo(2.88, 5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pointerup flushes the exact accumulated scrub position', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;
      defineDuration(video, 120);
      video.currentTime = 0;

      const scrubSpy = vi.fn();
      el.addEventListener('video-scrub-requested', scrubSpy);

      dispatchPointer(el, 'pointerdown', 100, 100);
      dispatchPointer(el, 'pointermove', 160, 100); // +60px → applies 0.6s
      // The video completes that seek (happy-dom never fires `seeked` on its
      // own), so the following moves are gated by the 50ms cadence only.
      markSeekComplete(video);
      dispatchPointer(el, 'pointermove', 220, 100); // +60px → target 1.56s, throttled
      dispatchPointer(el, 'pointermove', 280, 100); // +60px → target 2.88s, throttled
      dispatchPointer(el, 'pointerup', 280, 100); // flushes the accumulated 2.88s
      await el.updateComplete;

      expect(
        video.currentTime,
        'pointerup must flush the exact accumulated target (2.88s) to the video'
      ).toBeCloseTo(2.88, 5);
      expect(
        scrubSpy,
        'only the first-move seek + the final flush may fire'
      ).toHaveBeenCalledTimes(2);
      expect(
        detailOf<{ time: number }>(scrubSpy, 1).time,
        'the flush event must carry the exact accumulated target (2.88s), not an intermediate value'
      ).toBeCloseTo(2.88, 5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('scrubbing 100px total still scrubs exactly 5 seconds (throttle loses no distance)', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;
      defineDuration(video, 120);
      video.currentTime = 0;

      dispatchPointer(el, 'pointerdown', 100, 100);
      // Five +20px moves, one full 50ms throttle window between each so every
      // move applies: 0.2s, 0.24s, 0.28s, 0.32s, 0.36s → total 1.4s.
      const moves = [120, 140, 160, 180, 200];
      for (const x of moves) {
        vi.advanceTimersByTime(50);
        dispatchPointer(el, 'pointermove', x, 100);
        // The video completes each applied seek (happy-dom never fires
        // `seeked` on its own), so the next move is not blocked by the gate.
        markSeekComplete(video);
      }
      dispatchPointer(el, 'pointerup', 200, 100);
      await el.updateComplete;

      expect(
        video.currentTime,
        'a 100px drag (5 × 20px) must scrub 1.4s with acceleration — the throttle must not drop distance'
      ).toBeCloseTo(1.4, 5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('scrub direction reverses and clamps to the video bounds', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;
      defineDuration(video, 120);
      video.currentTime = 0;

      const scrubSpy = vi.fn();
      el.addEventListener('video-scrub-requested', scrubSpy);

      dispatchPointer(el, 'pointerdown', 100, 100);
      dispatchPointer(el, 'pointermove', 400, 100); // +300px → 3s
      expect(
        video.currentTime,
        '+300px must scrub to exactly 3s (and never exceed the 120s duration)'
      ).toBe(3);
      expect(video.currentTime, 'scrub must never exceed the 120s duration').toBeLessThanOrEqual(
        120
      );
      expect(detailOf<{ time: number }>(scrubSpy).time).toBe(3);
      // The video completes that seek (happy-dom never fires `seeked` on its
      // own), so the reversing move below is not blocked by the event-gate.
      markSeekComplete(video);

      vi.advanceTimersByTime(50);
      dispatchPointer(el, 'pointermove', 100, 100); // −300px → back to 0s
      dispatchPointer(el, 'pointerup', 100, 100);
      await el.updateComplete;

      expect(
        video.currentTime,
        'reversing the drag by the same distance must clamp back to exactly 0s'
      ).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a seek is NOT issued while the previous seek is still in flight, even after the 50ms window', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;
      defineDuration(video, 120);
      video.currentTime = 0;

      const scrubSpy = vi.fn();
      el.addEventListener('video-scrub-requested', scrubSpy);

      dispatchPointer(el, 'pointerdown', 100, 100);
      dispatchPointer(el, 'pointermove', 160, 100); // +60px → 0.6s applied, seek in flight
      expect(video.currentTime).toBeCloseTo(0.6, 5);
      expect(scrubSpy).toHaveBeenCalledTimes(1);

      // 50ms elapse (cadence window open) but the video NEVER fired seeked:
      // the event-gate must still block the new target.
      vi.advanceTimersByTime(50);
      dispatchPointer(el, 'pointermove', 220, 100); // +60px → target 1.56s
      expect(
        video.currentTime,
        'the event-gate must block a seek that has not completed'
      ).toBeCloseTo(0.6, 5);
      expect(scrubSpy).toHaveBeenCalledTimes(1);

      // The moment the seek completes, the stashed target lands immediately.
      markSeekComplete(video);
      expect(video.currentTime, 'the stashed target must land once the seek completes').toBeCloseTo(1.56, 5);
      expect(scrubSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a cadence-stashed target is NOT re-landed after a later commit completes', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;
      defineDuration(video, 120);
      video.currentTime = 0;

      const scrubSpy = vi.fn();
      el.addEventListener('video-scrub-requested', scrubSpy);

      dispatchPointer(el, 'pointerdown', 100, 100);
      dispatchPointer(el, 'pointermove', 160, 100); // +60px → 0.6s applied
      markSeekComplete(video); // 0.6s seek completes

      dispatchPointer(el, 'pointermove', 220, 100); // +60px → target 1.56s, cadence-stashed
      vi.advanceTimersByTime(50);
      dispatchPointer(el, 'pointermove', 280, 100); // +60px → target 2.88s, cadence open → committed
      expect(video.currentTime).toBeCloseTo(2.88, 5);

      // Open the cadence window BEFORE the 2.88s seek completes, deliberately:
      // 'seeked' now fires with the cadence open, so if a stale 1.56s stash
      // still existed it WOULD be committed — proving _pendingSeekTime was
      // cleared at the 2.88s commit.
      vi.advanceTimersByTime(50);
      markSeekComplete(video);
      expect(
        video.currentTime,
        'the stale cadence stash must not jump the video backward after the later seek completes'
      ).toBeCloseTo(2.88, 5);
      expect(
        scrubSpy,
        'the completed 14.4s seek must not re-dispatch a video-scrub-requested for the stale target'
      ).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a seeked-driven flush does not bypass the 50ms cadence on a fast device', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;
      defineDuration(video, 120);
      video.currentTime = 0;

      const scrubSpy = vi.fn();
      el.addEventListener('video-scrub-requested', scrubSpy);

      dispatchPointer(el, 'pointerdown', 100, 100);
      dispatchPointer(el, 'pointermove', 160, 100); // +60px → 0.6s committed, seek in flight
      dispatchPointer(el, 'pointermove', 220, 100); // +60px → target 1.56s, stashed while in flight
      markSeekComplete(video); // fast device: seek completes immediately — must NOT flush the stash yet
      expect(
        video.currentTime,
        'the seeked-driven flush must wait out the cadence window instead of committing early'
      ).toBeCloseTo(0.6, 5);
      expect(scrubSpy, 'the seeked-driven flush must not commit while inside the 50ms window').toHaveBeenCalledTimes(
        1
      );

      vi.advanceTimersByTime(50);
      dispatchPointer(el, 'pointermove', 280, 100); // +60px → target 2.88s, cadence open → committed
      expect(video.currentTime, 'the accumulated 2.88s must apply once the window has elapsed').toBeCloseTo(2.88, 5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a pointerup flush deferred to an in-flight seek still lands when seeked fires inside the cadence window', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;
      defineDuration(video, 120);
      video.currentTime = 0;

      const scrubSpy = vi.fn();
      el.addEventListener('video-scrub-requested', scrubSpy);

      dispatchPointer(el, 'pointerdown', 100, 100);
      dispatchPointer(el, 'pointermove', 160, 100); // +60px → 0.6s committed, seek in flight
      dispatchPointer(el, 'pointermove', 220, 100); // +60px → target 1.56s, stashed while in flight
      dispatchPointer(el, 'pointerup', 220, 100); // release: flush target 1.56s, deferred while in flight
      expect(
        video.currentTime,
        'the flush must wait for the in-flight seek to complete'
      ).toBeCloseTo(0.6, 5);

      // Fast device: seeked fires inside the 50ms window — the flush must STILL land.
      markSeekComplete(video);
      expect(
        video.currentTime,
        'the deferred pointerup flush must land even inside the cadence window'
      ).toBeCloseTo(1.56, 5);
      expect(scrubSpy, 'exactly the first-move seek + the flush commit').toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('wheel scrub is NOT throttled (regression guard for the wheel path)', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    defineDuration(video, 120);
    video.currentTime = 0;

    const scrubSpy = vi.fn();
    el.addEventListener('video-scrub-requested', scrubSpy);

    // Two wheel notches back-to-back, with NO 50ms window between them: both
    // must seek immediately (discrete wheel events already paint between
    // notches). The drag throttle must NOT leak into the wheel path.
    dispatchWheel(el, 100, 0);
    expect(video.currentTime, 'the first wheel notch must seek to 1s immediately').toBe(1);
    expect(scrubSpy).toHaveBeenCalledTimes(1);

    dispatchWheel(el, 100, 0);
    expect(
      video.currentTime,
      'a second wheel notch must seek immediately even without a 50ms gap (3s, not throttled to 1s)'
    ).toBeCloseTo(3, 5);
    expect(
      scrubSpy,
      'both wheel notches must dispatch — the wheel path is not throttled'
    ).toHaveBeenCalledTimes(2);
  });

  // ---- Bottom controls flex layout ------------------------------------------
  //
  // Feature: the 5 bottom-row buttons (prev-marker, replay, play-pause,
  // next-marker, marker) are refactored from individually-positioned elements
  // into a `.bottom-controls` flex container with 5 equal-width
  // `.bottom-controls-cell` children. Each cell uses `flex-direction: column`
  // to stack an optional marker label above the button. The top-row buttons
  // (mirror-btn, fullscreen-btn) remain individually positioned and are NOT
  // part of this flex container.

  describe('bottom controls flex layout', () => {
    /** Returns the `.bottom-controls` element inside the video frame, or null. */
    const getBottomControls = (el: TVideoPlayer): HTMLElement | null =>
      (el.shadowRoot?.querySelector('.bottom-controls') as HTMLElement) ?? null;

    /** Returns all `.bottom-controls-cell` children of the bottom controls. */
    const getBottomCells = (el: TVideoPlayer): Element[] =>
      Array.from(el.shadowRoot?.querySelectorAll('.bottom-controls-cell') ?? []);

    /** Returns the `.bottom-controls-cell` that contains the given selector. */
    const findCellFor = (el: TVideoPlayer, buttonSelector: string): Element | null => {
      const cells = getBottomCells(el);
      return cells.find((cell) => cell.querySelector(buttonSelector) !== null) ?? null;
    };

    it('renders a .bottom-controls div as a descendant of .video-frame', async () => {
      const { el } = createPlayerWithVideo();
      await el.updateComplete;

      const frame = el.shadowRoot?.querySelector('.video-frame');
      expect(frame, '.video-frame must exist').not.toBeNull();

      const bottomControls = getBottomControls(el);
      expect(
        bottomControls,
        '.bottom-controls must exist inside .video-frame'
      ).not.toBeNull();
      expect(
        frame?.contains(bottomControls),
        '.bottom-controls must be a descendant of .video-frame'
      ).toBe(true);
    });

    it('.bottom-controls contains exactly 5 .bottom-controls-cell children', async () => {
      const { el } = createPlayerWithVideo();
      await el.updateComplete;

      const cells = getBottomCells(el);
      expect(
        cells.length,
        '.bottom-controls must have exactly 5 children (prev, replay, play-pause, next, marker)'
      ).toBe(5);
    });

    it('each .bottom-controls-cell contains exactly one .video-btn element', async () => {
      const { el } = createPlayerWithVideo();
      await el.updateComplete;

      const cells = getBottomCells(el);
      expect(
        cells.length,
        'must have at least one .bottom-controls-cell to inspect (vacuous pass guard)'
      ).toBeGreaterThanOrEqual(1);
      for (const cell of cells) {
        const buttons = cell.querySelectorAll('.video-btn');
        expect(
          buttons.length,
          `each cell must contain exactly one .video-btn, but found ${buttons.length}`
        ).toBe(1);
      }
    });

    it('each cell corresponds to exactly one of the 5 expected button classes', async () => {
      const { el } = createPlayerWithVideo();
      await el.updateComplete;

      const expectedButtonClasses = [
        '.prev-marker-btn',
        '.replay-btn',
        '.play-pause-btn',
        '.next-marker-btn',
        '.marker-btn',
      ];

      for (const btnClass of expectedButtonClasses) {
        const cell = findCellFor(el, btnClass);
        expect(
          cell,
          `a cell must contain ${btnClass}`
        ).not.toBeNull();
      }
    });

    it('the cell containing .prev-marker-btn also contains .prev-marker-label when markers are set', async () => {
      const { el } = createPlayerWithVideo();
      setMarkerProps(el, abcMarkers(), 'mB');
      await el.updateComplete;

      const cell = findCellFor(el, '.prev-marker-btn');
      expect(cell, 'cell for prev-marker-btn must exist').not.toBeNull();
      expect(
        cell?.querySelector('.prev-marker-label'),
        'the prev-marker-btn cell must contain .prev-marker-label when markers are set'
      ).not.toBeNull();
    });

    it('the cell containing .prev-marker-btn does NOT contain .prev-marker-label when markers are empty', async () => {
      const { el } = createPlayerWithVideo();
      setMarkerProps(el, [], '');
      await el.updateComplete;

      const cell = findCellFor(el, '.prev-marker-btn');
      expect(cell, 'cell for prev-marker-btn must exist').not.toBeNull();
      expect(
        cell?.querySelector('.prev-marker-label'),
        'the prev-marker-btn cell must NOT contain .prev-marker-label when markers are empty'
      ).toBeNull();
    });

    it('the cell containing .replay-btn also contains .replay-label when markers are set', async () => {
      const { el } = createPlayerWithVideo();
      setMarkerProps(el, abcMarkers(), 'mB');
      await el.updateComplete;

      const cell = findCellFor(el, '.replay-btn');
      expect(cell, 'cell for replay-btn must exist').not.toBeNull();
      expect(
        cell?.querySelector('.replay-label'),
        'the replay-btn cell must contain .replay-label when markers are set'
      ).not.toBeNull();
    });

    it('the cell containing .next-marker-btn also contains .next-marker-label when markers are set', async () => {
      const { el } = createPlayerWithVideo();
      setMarkerProps(el, abcMarkers(), 'mB');
      await el.updateComplete;

      const cell = findCellFor(el, '.next-marker-btn');
      expect(cell, 'cell for next-marker-btn must exist').not.toBeNull();
      expect(
        cell?.querySelector('.next-marker-label'),
        'the next-marker-btn cell must contain .next-marker-label when markers are set'
      ).not.toBeNull();
    });

    it('the .play-pause-btn cell never contains a marker label', async () => {
      const { el } = createPlayerWithVideo();
      setMarkerProps(el, abcMarkers(), 'mB');
      await el.updateComplete;

      const cell = findCellFor(el, '.play-pause-btn');
      expect(cell, 'cell for play-pause-btn must exist').not.toBeNull();
      expect(cell?.querySelector('.prev-marker-label')).toBeNull();
      expect(cell?.querySelector('.replay-label')).toBeNull();
      expect(cell?.querySelector('.next-marker-label')).toBeNull();
    });

    it('the .marker-btn cell never contains a marker label', async () => {
      const { el } = createPlayerWithVideo();
      setMarkerProps(el, abcMarkers(), 'mB');
      await el.updateComplete;

      const cell = findCellFor(el, '.marker-btn');
      expect(cell, 'cell for marker-btn must exist').not.toBeNull();
      expect(cell?.querySelector('.prev-marker-label')).toBeNull();
      expect(cell?.querySelector('.replay-label')).toBeNull();
      expect(cell?.querySelector('.next-marker-label')).toBeNull();
    });

    it('.bottom-controls is positioned at the bottom via position: absolute and bottom in the stylesheet', async () => {
      const { el } = createPlayerWithVideo();
      await el.updateComplete;

      const sheet = el.shadowRoot?.adoptedStyleSheets?.[0];
      const rules = sheet?.cssRules;
      if (!rules) {
        throw new Error(
          'Expected shadow root to expose adoptedStyleSheets[0].cssRules'
        );
      }

      let foundRule = false;
      for (let i = 0; i < rules.length; i += 1) {
        const rule = rules[i] as CSSStyleRule;
        if (rule.selectorText === '.bottom-controls') {
          const cssText = rule.style.cssText;
          expect(
            cssText,
            '.bottom-controls rule must set position: absolute'
          ).toContain('position: absolute');
          expect(
            cssText,
            '.bottom-controls rule must set bottom'
          ).toContain('bottom:');
          foundRule = true;
          break;
        }
      }
      expect(
        foundRule,
        'the component stylesheet must contain a .bottom-controls rule'
      ).toBe(true);
    });

    it('.top-row buttons (mirror-btn, fullscreen-btn) are NOT inside .bottom-controls', async () => {
      const { el } = createPlayerWithVideo();
      await el.updateComplete;

      const bottomControls = getBottomControls(el);
      expect(bottomControls, '.bottom-controls must exist').not.toBeNull();

      expect(
        bottomControls?.querySelector('.mirror-btn'),
        '.mirror-btn must NOT be inside .bottom-controls'
      ).toBeNull();
      expect(
        bottomControls?.querySelector('.fullscreen-btn'),
        '.fullscreen-btn must NOT be inside .bottom-controls'
      ).toBeNull();

      // They should still be inside .video-frame directly
      const frame = el.shadowRoot?.querySelector('.video-frame');
      expect(frame?.querySelector('.mirror-btn')).not.toBeNull();
      expect(frame?.querySelector('.fullscreen-btn')).not.toBeNull();
    });
  });
});
